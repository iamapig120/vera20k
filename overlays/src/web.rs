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

#[wasm_bindgen(start)]
pub fn initialize() {
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

#[wasm_bindgen]
pub fn start_game() -> Result<(), JsValue> {
    use winit::platform::web::EventLoopExtWebSys;
    thread_local! { static STARTED: std::cell::Cell<bool> = const { std::cell::Cell::new(false) }; }
    if STARTED.with(|started| started.replace(true)) {
        return Err(JsValue::from_str("Game already started; reload to restart"));
    }
    crate::util::file_system::import_file(
        "/config.toml",
        b"[paths]\nra2_dir = \"/retail\"\n".to_vec(),
    );
    let event_loop =
        winit::event_loop::EventLoop::new().map_err(|e| JsValue::from_str(&e.to_string()))?;
    let mut options = crate::app::frontend::startup_options::RetailStartupOptions::default();
    options.audio_enabled = false;
    event_loop.spawn_app(crate::app::App::new(options));
    Ok(())
}
