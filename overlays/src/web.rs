//! Browser entry point. The existing App owns the frontend and match lifecycle.
use wasm_bindgen::prelude::*;

pub(crate) fn set_status(message: &str) {
    if let Some(element) = web_sys::window()
        .and_then(|w| w.document())
        .and_then(|d| d.get_element_by_id("status"))
    {
        element.set_text_content(Some(message));
    }
}

/// Reveal the canvas only after the renderer actually presented a frame.
pub(crate) fn frame_presented() {
    thread_local! { static PRESENTED: std::cell::Cell<bool> = const { std::cell::Cell::new(false) }; }
    if !PRESENTED.with(|shown| shown.replace(true)) {
        set_status("已启动");
    }
}

#[wasm_bindgen(start)]
pub fn initialize() {
    crate::util::file_system::set_persistence_callbacks(
        |path, bytes, modified_ms| persist_write(path, bytes, modified_ms as f64),
        persist_remove,
    );
    console_error_panic_hook::set_once();
    let console_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        set_status(&format!("运行错误：{info}。请刷新页面后重试。"));
        console_hook(info);
    }));
    let _ = console_log::init_with_level(log::Level::Info);
}

/// The page supplies only user-selected files, before starting the event loop.
#[wasm_bindgen]
pub fn import_file(name: &str, bytes: Vec<u8>) -> Result<(), JsValue> {
    if name.split('/').any(|part| part == "..") || name.starts_with('/') {
        return Err(JsValue::from_str("Invalid relative resource path"));
    }
    crate::util::file_system::import_file(format!("/retail/{name}"), bytes);
    Ok(())
}

// Open CPAL's Web Audio contexts during the launcher click, before file reads
// yield user activation. App initialization later takes these same outputs.
thread_local! {
    static MUSIC: std::cell::RefCell<Option<crate::audio::music::MusicPlayer>> = const { std::cell::RefCell::new(None) };
    static SFX: std::cell::RefCell<Option<crate::audio::sfx::SfxPlayer>> = const { std::cell::RefCell::new(None) };
}

#[wasm_bindgen]
pub fn prepare_audio() -> Result<(), JsValue> {
    MUSIC.with(|slot| {
        if slot.borrow().is_none() {
            *slot.borrow_mut() = crate::audio::music::MusicPlayer::new();
        }
    });
    SFX.with(|slot| {
        if slot.borrow().is_none() {
            *slot.borrow_mut() = crate::audio::sfx::SfxPlayer::new();
        }
    });
    if MUSIC.with(|slot| slot.borrow().is_some()) && SFX.with(|slot| slot.borrow().is_some()) {
        Ok(())
    } else {
        Err(JsValue::from_str(
            "无法初始化浏览器音频输出，请检查浏览器的声音权限后重试。",
        ))
    }
}

pub(crate) fn take_music_output() -> Option<crate::audio::music::MusicPlayer> {
    MUSIC.with(|slot| slot.borrow_mut().take())
}

pub(crate) fn take_sfx_output() -> Option<crate::audio::sfx::SfxPlayer> {
    SFX.with(|slot| slot.borrow_mut().take())
}

#[wasm_bindgen]
pub fn start_game() -> Result<(), JsValue> {
    use winit::platform::web::EventLoopExtWebSys;
    thread_local! { static STARTED: std::cell::Cell<bool> = const { std::cell::Cell::new(false) }; }
    if STARTED.with(|started| started.replace(true)) {
        return Err(JsValue::from_str("Game already started; reload to restart"));
    }
    if !crate::util::file_system::is_file("/config.toml") {
        crate::util::file_system::import_file(
            "/config.toml",
            b"[paths]\nra2_dir = \"/retail\"\n".to_vec(),
        );
    }
    let event_loop =
        winit::event_loop::EventLoop::new().map_err(|e| JsValue::from_str(&e.to_string()))?;
    let options = crate::app::frontend::startup_options::RetailStartupOptions::default();
    event_loop.spawn_app(crate::app::App::new(options));
    Ok(())
}

// The launcher owns the asynchronous durability queue; the virtual filesystem
// stays synchronous for existing engine readers and writers.
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = globalThis, js_name = vera20kPersistWrite)]
    pub(crate) fn persist_write(path: &str, bytes: &[u8], modified_ms: f64);
    #[wasm_bindgen(js_namespace = globalThis, js_name = vera20kPersistRemove)]
    pub(crate) fn persist_remove(path: &str);
}

#[wasm_bindgen]
pub fn restore_user_file(
    path: &str,
    bytes: Vec<u8>,
    modified_ms: f64,
    deleted: bool,
) -> Result<(), JsValue> {
    if !(path == "/config.toml" || path.starts_with("/retail/") || path.starts_with("/saves/"))
        || path.split('/').any(|part| part == "..")
        || !modified_ms.is_finite()
        || modified_ms < 0.0
    {
        return Err(JsValue::from_str("Invalid user data path or timestamp"));
    }
    if deleted {
        crate::util::file_system::restore_deleted_file(path);
    } else {
        crate::util::file_system::restore_file(path, bytes, modified_ms as u64);
    }
    Ok(())
}
