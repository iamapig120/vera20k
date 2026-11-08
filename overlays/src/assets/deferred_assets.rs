//! Explicit web media metadata. No synchronous asset read performs network I/O.
use serde::{Deserialize, Serialize};
use std::{cell::RefCell, collections::HashMap, sync::Arc};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct MusicMetadata {
    pub size: usize,
    pub sha256: String,
    pub duration_seconds: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct BankMetadata {
    pub size: usize,
    pub sha256: String,
    pub index_sha256: String,
    pub source_archive: String,
    pub archive_name: String,
}

#[derive(Default)]
struct Registry {
    music: HashMap<String, MusicMetadata>,
    bank: Option<BankMetadata>,
    audio_ready: bool,
    ready_music: Option<(String, Arc<[u8]>)>,
    audio_requested: bool,
}
thread_local! { static REGISTRY: RefCell<Registry> = RefCell::new(Registry::default()); }

pub fn configure(music: HashMap<String, MusicMetadata>, bank: Option<BankMetadata>) {
    REGISTRY.with(|r| {
        *r.borrow_mut() = Registry {
            music,
            bank,
            ..Default::default()
        }
    });
}
pub fn music_metadata(name: &str) -> Option<MusicMetadata> {
    REGISTRY.with(|r| r.borrow().music.get(&name.to_uppercase()).cloned())
}
pub fn bank_metadata() -> Option<BankMetadata> {
    REGISTRY.with(|r| r.borrow().bank.clone())
}
pub fn audio_ready() -> bool {
    REGISTRY.with(|r| r.borrow().audio_ready)
}
pub fn mark_audio_ready() {
    REGISTRY.with(|r| {
        let mut r = r.borrow_mut();
        r.audio_ready = true;
        r.audio_requested = false;
    });
}
pub fn request_audio() {
    REGISTRY.with(|r| {
        let mut r = r.borrow_mut();
        if r.bank.is_some() && !r.audio_ready {
            r.audio_requested = true;
        }
    });
}
pub fn audio_requested() -> bool {
    REGISTRY.with(|r| r.borrow().audio_requested)
}
pub fn cancel_audio_request() {
    REGISTRY.with(|r| r.borrow_mut().audio_requested = false);
}
pub fn publish_music(name: &str, bytes: Arc<[u8]>) {
    REGISTRY.with(|r| r.borrow_mut().ready_music = Some((name.to_uppercase(), bytes)));
}
pub fn music_bytes(name: &str) -> Option<Arc<[u8]>> {
    REGISTRY.with(|r| {
        r.borrow()
            .ready_music
            .as_ref()
            .filter(|(n, _)| n == &name.to_uppercase())
            .map(|(_, bytes)| Arc::clone(bytes))
    })
}
