//! Same-origin transport for the existing serial lobby worker. Credentials stay
//! in its private memory; redirects and ambient browser credentials are disabled.
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::JsFuture;

use super::{MAX_BODY_BYTES, RequestFailure};
use serde_json::Value;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = globalThis, js_name = veraLobbyRequest)]
    fn fetch(path: &str, token: Option<&str>, body: Option<&str>, limit: u32) -> js_sys::Promise;
    #[wasm_bindgen(js_namespace = globalThis, js_name = veraLobbyDelay)]
    fn timeout(ms: u32) -> js_sys::Promise;
}

pub(super) async fn delay(ms: u32) {
    let _ = JsFuture::from(timeout(ms)).await;
}

pub(super) async fn request(
    path: &str,
    token: Option<&str>,
    body: Option<&Value>,
) -> Result<Value, RequestFailure> {
    let body = body.map(Value::to_string);
    // Never report the JS exception: fetch failures can include credentials or
    // server text. The existing retry owner consumes only this numeric failure.
    let response = JsFuture::from(fetch(path, token, body.as_deref(), MAX_BODY_BYTES as u32))
        .await
        .map_err(|_| RequestFailure::Status(0))?;
    let response = response.as_string().ok_or(RequestFailure::Status(0))?;
    let (status, body): (u16, String) =
        serde_json::from_str(&response).map_err(|_| RequestFailure::Status(0))?;
    if !(200..300).contains(&status) {
        return Err(RequestFailure::response(status, body.as_bytes()));
    }
    serde_json::from_str(&body).map_err(|_| RequestFailure::Status(0))
}
