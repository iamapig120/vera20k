//! Browser-only, explicit resource waits. Never fetch from a synchronous VFS read.
use super::{App, AppState};
use js_sys::Function;
use serde::Deserialize;
use std::{
    cell::RefCell,
    collections::{HashMap, HashSet, VecDeque},
    sync::Arc,
};
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

#[derive(Clone, Deserialize)]
struct Descriptor {
    size: usize,
    sha256: String,
    #[serde(default)]
    duration_seconds: Option<u32>,
    #[serde(default)]
    bank: Option<crate::assets::deferred_assets::BankMetadata>,
}
type Continuation = Box<dyn FnOnce(&mut AppState, Option<Arc<[u8]>>)>;
struct Request {
    id: u32,
    key: String,
    descriptor: Descriptor,
    continuation: Continuation,
    dispatched: bool,
    result: Option<Option<Arc<[u8]>>>,
    previous: Option<Arc<[u8]>>,
}
#[derive(Default)]
struct Host {
    catalog: HashMap<String, Descriptor>,
    handler: Option<Function>,
    queue: VecDeque<Request>,
    next: u32,
    installed: HashSet<String>,
    graphics_ready: bool,
}
thread_local! { static HOST: RefCell<Host> = RefCell::new(Host::default()); }

fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 1024
        && !name.contains(['\\', ':', '\0'])
        && !name.chars().any(char::is_control)
        && name
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != "..")
}
fn key(kind: &str, name: &str) -> String {
    format!("{kind}:{}", name.to_uppercase())
}

#[wasm_bindgen]
pub fn configure_remote_assets(catalog: &str, handler: Function) -> Result<(), JsValue> {
    if crate::web::started() {
        return Err(JsValue::from_str("Configure remote assets before starting"));
    }
    if catalog.len() > 2 * 1024 * 1024 {
        return Err(JsValue::from_str("Remote catalog too large"));
    }
    let parsed: HashMap<String, Descriptor> =
        serde_json::from_str(catalog).map_err(|e| JsValue::from_str(&e.to_string()))?;
    if parsed.len() > 12000
        || parsed.iter().any(|(key, row)| {
            let Some((kind, name)) = key.split_once(':') else {
                return true;
            };
            !matches!(kind, "map" | "movie" | "music" | "audio" | "archive")
                || !valid_name(name)
                || row.size == 0
                || row.size > 1024 * 1024 * 1024
                || !crate::map::source::valid_source_sha256(&row.sha256)
        })
    {
        return Err(JsValue::from_str("Invalid remote catalog"));
    }
    let mut music = HashMap::new();
    let mut bank = None;
    for (id, row) in &parsed {
        let (kind, name) = id.split_once(':').unwrap();
        if matches!(kind, "audio" | "archive")
            && (name.contains('/') || !name.to_ascii_lowercase().ends_with(".mix"))
        {
            return Err(JsValue::from_str("Staged archives must be root MIX files"));
        }
        if kind == "music" {
            let duration = row
                .duration_seconds
                .filter(|v| *v <= 86400)
                .ok_or_else(|| JsValue::from_str("Music metadata needs duration_seconds"))?;
            if !name.to_ascii_lowercase().ends_with(".wav") {
                return Err(JsValue::from_str("Remote music must be WAV"));
            }
            music.insert(
                name.to_uppercase(),
                crate::assets::deferred_assets::MusicMetadata {
                    size: row.size,
                    sha256: row.sha256.clone(),
                    duration_seconds: duration,
                },
            );
        }
        if kind == "audio" {
            let metadata = row
                .bank
                .clone()
                .ok_or_else(|| JsValue::from_str("Missing selected bank metadata"))?;
            if cfg!(feature = "ares")
                || bank.is_some()
                || !metadata.archive_name.eq_ignore_ascii_case(name)
                || !valid_name(&metadata.source_archive)
                || metadata.size == 0
                || metadata.size > 1024 * 1024 * 1024
                || !crate::map::source::valid_source_sha256(&metadata.sha256)
                || !crate::map::source::valid_source_sha256(&metadata.index_sha256)
            {
                return Err(JsValue::from_str(
                    "Invalid or unsupported deferred sound bank",
                ));
            }
            bank = Some(metadata);
        }
    }
    crate::assets::deferred_assets::configure(music, bank);
    HOST.with(|host| {
        let mut host = host.borrow_mut();
        host.catalog = parsed
            .into_iter()
            .map(|(k, v)| {
                let (kind, name) = k.split_once(':').unwrap();
                (key(kind, name), v)
            })
            .collect();
        host.handler = Some(handler);
        host.graphics_ready = !host.catalog.keys().any(|key| key.starts_with("archive:"));
        host.installed.clear();
    });
    Ok(())
}

/// Only the active ticket may publish a complete, independently verified payload.
#[wasm_bindgen]
pub fn finish_remote_asset(id: u32, bytes: Vec<u8>, cancelled: bool) -> Result<(), JsValue> {
    HOST.with(|host| {
        let mut host = host.borrow_mut();
        let request = host
            .queue
            .front_mut()
            .filter(|r| r.id == id && r.result.is_none())
            .ok_or_else(|| JsValue::from_str("Expired remote request"))?;
        if !cancelled
            && (bytes.len() != request.descriptor.size
                || crate::util::sha256::sha256_hex(&bytes) != request.descriptor.sha256)
        {
            return Err(JsValue::from_str("Remote resource integrity failure"));
        }
        let bytes: Arc<[u8]> = bytes.into();
        if !cancelled {
            if request.key.starts_with("map:") {
                crate::map::map_file::load_from_bytes(bytes.to_vec())
                    .map_err(|e| JsValue::from_str(&format!("Invalid remote map: {e}")))?;
            } else if request.key.starts_with("movie:") {
                let movie = crate::assets::bink_file::BinkFile::parse(Arc::clone(&bytes))
                    .map_err(|e| JsValue::from_str(&format!("Invalid remote movie: {e}")))?;
                if movie.header.file_size > bytes.len() as u64
                    || movie.frame_index.iter().any(|frame| {
                        (frame.offset as usize)
                            .checked_add(frame.size as usize)
                            .is_none_or(|end| end > bytes.len())
                    })
                {
                    return Err(JsValue::from_str("Incomplete remote movie"));
                }
            } else if request.key.starts_with("music:") {
                let wav = crate::assets::wav_file::WavFile::parse(&bytes)
                    .ok_or_else(|| JsValue::from_str("Invalid remote WAV"))?;
                if wav.native_duration_seconds() != request.descriptor.duration_seconds {
                    return Err(JsValue::from_str("Remote music metadata mismatch"));
                }
            } else {
                let archive =
                    crate::assets::mix_archive::MixArchive::from_shared(Arc::clone(&bytes))
                        .map_err(|e| JsValue::from_str(&e.to_string()))?;
                if let Some(previous) = &request.previous {
                    crate::assets::asset_manager::AssetManager::validate_archive_expansion(
                        Arc::clone(previous),
                        Arc::clone(&bytes),
                    )
                    .map_err(|e| JsValue::from_str(&e.to_string()))?;
                }
                if let Some(bank) = &request.descriptor.bank {
                    let idx = archive
                        .get_by_name("audio.idx")
                        .ok_or_else(|| JsValue::from_str("Missing staged audio.idx"))?;
                    let bag = archive
                        .get_by_name("audio.bag")
                        .ok_or_else(|| JsValue::from_str("Missing staged audio.bag"))?;
                    if bag.len() != bank.size
                        || crate::util::sha256::sha256_hex(bag) != bank.sha256
                        || crate::util::sha256::sha256_hex(idx) != bank.index_sha256
                    {
                        return Err(JsValue::from_str("Staged sound source metadata mismatch"));
                    }
                }
            }
        }
        request.result = Some(if cancelled { None } else { Some(bytes) });
        if cancelled {
            host.queue.truncate(1);
        }
        Ok(())
    })?;
    crate::web::wake();
    Ok(())
}

fn dispatch() {
    let call = HOST.with(|host| {
        let mut host = host.borrow_mut();
        let handler = host.handler.clone()?;
        let request = host.queue.front_mut()?;
        if request.dispatched {
            return None;
        }
        request.dispatched = true;
        Some((handler, request.id, request.key.clone()))
    });
    if let Some((handler, id, key)) = call {
        let (kind, name) = key.split_once(':').unwrap();
        if handler
            .call3(&JsValue::NULL, &id.into(), &kind.into(), &name.into())
            .is_err()
        {
            let _ = finish_remote_asset(id, Vec::new(), true);
        }
    }
}

fn declared(kind: &str, name: &str) -> bool {
    HOST.with(|host| host.borrow().catalog.contains_key(&key(kind, name)))
}
fn begin(kind: &str, name: &str, continuation: Continuation) {
    begin_with_previous(kind, name, None, continuation);
}
fn begin_with_previous(
    kind: &str,
    name: &str,
    previous: Option<Arc<[u8]>>,
    continuation: Continuation,
) {
    HOST.with(|host| {
        let mut host = host.borrow_mut();
        host.next = host.next.wrapping_add(1).max(1);
        let key = key(kind, name);
        let descriptor = host.catalog[&key].clone();
        let id = host.next;
        host.queue.push_back(Request {
            id,
            key,
            descriptor,
            continuation,
            dispatched: false,
            result: None,
            previous,
        });
    });
    dispatch();
}
pub(super) fn pending() -> bool {
    HOST.with(|host| !host.borrow().queue.is_empty())
}
pub(crate) fn clear() {
    crate::assets::deferred_assets::configure(HashMap::new(), None);
    let handler = HOST.with(|host| {
        let mut h = host.borrow_mut();
        h.queue.clear();
        h.handler.clone()
    });
    if let Some(handler) = handler {
        let _ = handler.call3(&JsValue::NULL, &0u32.into(), &"cancel".into(), &"".into());
    }
}

fn queued(kind: &str, name: &str) -> bool {
    HOST.with(|h| h.borrow().queue.iter().any(|r| r.key == key(kind, name)))
}
fn back_to_menu(state: &mut AppState) {
    state.frontend.screen = crate::ui::game_screen::GameScreen::MainMenu;
    App::commit_campaign_back(state);
}
fn incompatible(state: &mut AppState, error: String) {
    log::error!("Resource stage incompatible: {error}");
    crate::assets::deferred_assets::cancel_audio_request();
    if let Some(sfx) = state.audio.sfx_player.as_mut() {
        sfx.stop_all();
    }
    state.audio.stop_theme();
    let handler = HOST.with(|h| {
        let mut h = h.borrow_mut();
        h.queue.clear();
        h.handler.clone()
    });
    back_to_menu(state);
    if let Some(handler) = handler {
        let _ = handler.call3(&JsValue::NULL, &0u32.into(), &"error".into(), &error.into());
    }
}
fn archive_request(
    state: &mut AppState,
    kind: &str,
    name: &str,
    after: Box<dyn FnOnce(&mut AppState, bool)>,
) {
    archive_request_with_policy(state, kind, name, false, after);
}

// Saved loads keep the current world and its browser on resource failure.
fn initial_library_error(state: &mut AppState, error: String, preserve_page: bool) {
    if preserve_page {
        log::warn!("Saved-game resources: {error}");
    } else {
        incompatible(state, error);
    }
}

fn archive_request_with_policy(
    state: &mut AppState,
    kind: &str,
    name: &str,
    preserve_page: bool,
    after: Box<dyn FnOnce(&mut AppState, bool)>,
) {
    let Some(root) = state
        .platform
        .game_config
        .as_ref()
        .map(|c| c.paths.ra2_dir.clone())
    else {
        after(state, false);
        return;
    };
    let Some(path) = crate::util::case_insensitive_path::find(&root, name) else {
        initial_library_error(
            state,
            format!("Missing bootstrap archive placeholder: {name}"),
            preserve_page,
        );
        after(state, false);
        return;
    };
    let previous = crate::util::file_system::read_shared(&path).ok();
    let audio = kind == "audio";
    let id = key(kind, name);
    begin_with_previous(
        kind,
        name,
        previous,
        Box::new(move |state, bytes| {
            if let Some(bytes) = bytes {
                crate::util::file_system::import_shared_file(path, bytes);
                if audio {
                    if let Err(error) = state.process_assets.complete_initial_library(&root, true) {
                        initial_library_error(state, error, preserve_page);
                        after(state, false);
                        return;
                    }
                    crate::assets::deferred_assets::mark_audio_ready();
                }
                HOST.with(|h| {
                    h.borrow_mut().installed.insert(id);
                });
                after(state, true);
            } else {
                if audio {
                    crate::assets::deferred_assets::cancel_audio_request();
                    if let Some(sfx) = state.audio.sfx_player.as_mut() {
                        sfx.stop_all();
                    }
                }
                after(state, false);
            }
        }),
    );
}

fn discover_media_requests(state: &mut AppState) {
    if crate::assets::deferred_assets::audio_requested()
        && state.process_assets.has_deferred_audio()
        && let Some(bank) = crate::assets::deferred_assets::bank_metadata()
        && !queued("audio", &bank.archive_name)
    {
        archive_request(state, "audio", &bank.archive_name, Box::new(|_, _| {}));
    }
    let music = state
        .audio
        .music_player
        .as_ref()
        .and_then(|p| p.pending_remote())
        .map(str::to_owned);
    if let Some(name) = music
        && declared("music", &name)
        && !queued("music", &name)
    {
        begin(
            "music",
            &name.clone(),
            Box::new(move |state, bytes| {
                if let Some(bytes) = bytes {
                    crate::assets::deferred_assets::publish_music(&name, Arc::clone(&bytes));
                    if let Some(player) = state.audio.music_player.as_mut()
                        && player.pending_remote() == Some(name.as_str())
                        && !player.fulfill_remote(&name, bytes)
                    {
                        state.audio.stop_theme();
                    }
                } else if state
                    .audio
                    .music_player
                    .as_ref()
                    .is_some_and(|p| p.pending_remote() == Some(name.as_str()))
                {
                    state.audio.stop_theme();
                }
            }),
        );
    }
}

/// Runs on the app thread; no AppState borrow crosses fetch or a JS callback.
pub(super) fn pump(state: &mut AppState) -> bool {
    let completed = HOST.with(|host| {
        let mut host = host.borrow_mut();
        if host.queue.front().is_some_and(|r| r.result.is_some()) {
            host.queue.pop_front()
        } else {
            None
        }
    });
    if let Some(mut request) = completed {
        state.platform.frame_pacer.reset_for_immediate_frame();
        if let Some(movie) = state.frontend.fullscreen_movie.as_mut() {
            movie.set_active(state.platform.window.has_focus());
        }
        state
            .match_state
            .match_presentation
            .radar_movies
            .set_active(state.platform.window.has_focus());
        (request.continuation)(state, request.result.take().unwrap());
        super::match_runtime::scenario_pause::resume(
            state,
            super::match_runtime::frame_pacer::wall_clock_ms(),
        );
        dispatch();
        state.platform.window.request_redraw();
    }
    discover_media_requests(state);
    let waiting = pending();
    if waiting {
        let now = super::match_runtime::frame_pacer::wall_clock_ms();
        state.platform.frame_pacer.reanchor(now);
        if let Some(movie) = state.frontend.fullscreen_movie.as_mut() {
            movie.set_active(false);
        }
        state
            .match_state
            .match_presentation
            .radar_movies
            .set_active(false);
        state.match_state.scenario_elapsed_clock.pause(now);
    }
    waiting
}

/// Complete process libraries before any consumer can activate a theater.
/// Keep the map request or RMG options owned across the explicit async wait;
/// neither the frozen INI roots nor AssetManager's sticky-cache checks change.
pub(super) fn initial_library<T: 'static>(
    state: &mut AppState,
    input: T,
    resume: impl FnOnce(&mut AppState, T, bool) + 'static,
) -> Option<T> {
    initial_library_with_policy(state, input, false, resume)
}

pub(super) fn initial_library_for_saved_load<T: 'static>(
    state: &mut AppState,
    input: T,
    resume: impl FnOnce(&mut AppState, T, bool) + 'static,
) -> Option<T> {
    if saved_load_library_ready(state) {
        return Some(input);
    }
    initial_library_with_policy(state, input, true, resume)
}

/// Synchronous diagnostic callers cannot wait for host I/O. Production UI
/// enters request_saved_game_load, which owns the asynchronous wait instead.
pub(super) fn saved_load_library_ready(state: &AppState) -> bool {
    HOST.with(|host| {
        let host = host.borrow();
        host.handler.is_none()
            || (host.graphics_ready
                && !state.process_assets.has_deferred_audio()
                && !host
                    .catalog
                    .keys()
                    .any(|key| key.starts_with("archive:") && !host.installed.contains(key)))
    })
}

fn initial_library_with_policy<T: 'static>(
    state: &mut AppState,
    input: T,
    preserve_page: bool,
    resume: impl FnOnce(&mut AppState, T, bool) + 'static,
) -> Option<T> {
    if state.process_assets.has_deferred_audio()
        && let Some(bank) = crate::assets::deferred_assets::bank_metadata()
    {
        archive_request_with_policy(
            state,
            "audio",
            &bank.archive_name,
            preserve_page,
            Box::new(move |state, ready| {
                resume(state, input, ready);
            }),
        );
        return None;
    }
    let next = HOST.with(|h| {
        let h = h.borrow();
        h.catalog
            .keys()
            .filter(|k| k.starts_with("archive:") && !h.installed.contains(*k))
            .min()
            .cloned()
    });
    if let Some(next) = next {
        let (_, name) = next.split_once(':').unwrap();
        archive_request_with_policy(
            state,
            "archive",
            name,
            preserve_page,
            Box::new(move |state, ready| {
                resume(state, input, ready);
            }),
        );
        return None;
    }
    if !HOST.with(|h| h.borrow().graphics_ready) {
        if let Some(root) = state
            .platform
            .game_config
            .as_ref()
            .map(|c| c.paths.ra2_dir.clone())
        {
            if let Err(error) = state.process_assets.complete_initial_library(&root, false) {
                initial_library_error(state, error, preserve_page);
                resume(state, input, false);
                return None;
            }
            HOST.with(|h| h.borrow_mut().graphics_ready = true);
        }
    }
    Some(input)
}

pub(super) fn map(
    state: &mut AppState,
    request: super::loading::pump::LoadingRequest,
    campaign: bool,
) -> Option<super::loading::pump::LoadingRequest> {
    let request = if request.remote_allowed() {
        initial_library(state, request, move |state, request, ready| {
            if !ready {
                back_to_menu(state);
            } else if campaign {
                App::start_campaign_scenario(state, request);
            } else {
                super::loading::pump::begin_loading(state, request);
            }
        })?
    } else {
        request
    };
    let name = request.selected_map_file().to_owned();
    if !request.remote_allowed() || !declared("map", &name) {
        return Some(request);
    }
    let Some(config) = state.platform.game_config.as_ref() else {
        return Some(request);
    };
    let root = config.paths.ra2_dir.clone();
    let available = crate::map::source::local_map_path(&root, &name).is_ok()
        || state.process_assets.manager().is_some_and(|assets| {
            crate::map::source::asset_map_candidates(&name)
                .iter()
                .any(|n| assets.contains(n))
        });
    if available {
        return Some(request);
    }
    begin(
        "map",
        &name.clone(),
        Box::new(move |state, bytes| {
            if let Some(bytes) = bytes {
                let path = root.join(&name);
                if let Some(parent) = path.parent() {
                    let _ = crate::util::file_system::create_dir_all(parent);
                }
                crate::util::file_system::import_file(path, bytes.to_vec());
                if campaign {
                    App::start_campaign_scenario(state, request);
                } else {
                    super::loading::pump::begin_loading(state, request);
                }
            } else {
                state.frontend.screen = crate::ui::game_screen::GameScreen::MainMenu;
                App::commit_campaign_back(state);
            }
        }),
    );
    None
}

pub(super) fn movie_missing(state: &AppState, name: &str) -> bool {
    state.match_state.live_network.is_none()
        && !state.match_state.match_diagnostics.is_replay_playback()
        && declared("movie", name)
        && !state
            .process_assets
            .manager()
            .is_some_and(|a| a.contains(name))
}
pub(super) fn movie(name: &str, continuation: Continuation) {
    begin("movie", name, continuation);
}
