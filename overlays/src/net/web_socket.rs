//! Browser datagram adapter. One WebSocket message is one original encrypted
//! relay datagram. Reliability, authentication and simulation remain upstream.
use std::io;
use std::net::{SocketAddr, SocketAddrV4};
use std::sync::Mutex;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(catch, js_namespace = globalThis, js_name = veraSocketOpen)]
    fn open(channel: &str) -> Result<u32, JsValue>;
    #[wasm_bindgen(js_namespace = globalThis, js_name = veraSocketSend)]
    fn send(id: u32, bytes: &[u8]) -> u32;
    #[wasm_bindgen(js_namespace = globalThis, js_name = veraSocketReceive)]
    fn receive(id: u32) -> JsValue;
    #[wasm_bindgen(js_namespace = globalThis, js_name = veraSocketClose)]
    fn close(id: u32);
}

#[derive(Debug)]
pub(super) struct UdpSocket {
    id: u32,
    local: SocketAddrV4,
    remote: Mutex<Option<SocketAddrV4>>,
}
impl UdpSocket {
    pub fn bind(local: SocketAddrV4, channel: &str) -> io::Result<Self> {
        let id = open(channel).map_err(|_| io::Error::other("Web gateway unavailable"))?;
        Ok(Self {
            id,
            local,
            remote: Mutex::new(None),
        })
    }
    pub fn set_nonblocking(&self, _: bool) -> io::Result<()> {
        Ok(())
    }
    pub fn set_broadcast(&self, _: bool) -> io::Result<()> {
        Ok(())
    }
    pub fn take_error(&self) -> io::Result<Option<io::Error>> {
        Ok(None)
    }
    pub fn local_addr(&self) -> io::Result<SocketAddr> {
        Ok(self.local.into())
    }
    pub fn send_to(&self, bytes: &[u8], endpoint: SocketAddrV4) -> io::Result<usize> {
        *self.remote.lock().expect("browser endpoint") = Some(endpoint);
        match send(self.id, bytes) {
            0 => Ok(bytes.len()),
            1 => Err(io::ErrorKind::WouldBlock.into()),
            _ => Err(io::Error::new(
                io::ErrorKind::ConnectionAborted,
                "Web gateway disconnected",
            )),
        }
    }
    pub fn recv_from(&self, buffer: &mut [u8]) -> io::Result<(usize, SocketAddr)> {
        let value = receive(self.id);
        if value.is_null() {
            return Err(io::ErrorKind::WouldBlock.into());
        }
        if value.is_undefined() {
            return Err(io::Error::new(
                io::ErrorKind::ConnectionAborted,
                "Web gateway disconnected",
            ));
        }
        let packet = js_sys::Uint8Array::new(&value);
        let length = packet.length() as usize;
        if length > buffer.len() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "oversized gateway datagram",
            ));
        }
        packet.copy_to(&mut buffer[..length]);
        let source = self
            .remote
            .lock()
            .expect("browser endpoint")
            .ok_or(io::ErrorKind::WouldBlock)?;
        Ok((length, source.into()))
    }
}
impl Drop for UdpSocket {
    fn drop(&mut self) {
        close(self.id);
    }
}
