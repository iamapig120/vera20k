/* tslint:disable */
/* eslint-disable */

/**
 * Import user-selected bytes before starting. The engine never fetches retail assets.
 */
export function import_file(name: string, bytes: Uint8Array): void;

export function initialize(): void;

/**
 * Call synchronously from the user's Start click, before asynchronous file/storage work.
 */
export function prepare_audio(): void;

export function restore_user_file(path: string, bytes: Uint8Array, modified_ms: number, deleted: boolean): void;

/**
 * Install durability callbacks before starting. A callback queues asynchronous host storage;
 * a successful engine write means the in-memory write completed, not that storage was flushed.
 */
export function set_persistence_callbacks(write: Function, remove: Function): void;

export function start_game(canvas: HTMLCanvasElement, on_status: Function): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly import_file: (a: number, b: number, c: number, d: number) => [number, number];
    readonly initialize: () => void;
    readonly prepare_audio: () => [number, number];
    readonly restore_user_file: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly set_persistence_callbacks: (a: any, b: any) => void;
    readonly start_game: (a: any, b: any) => [number, number];
    readonly wasm_bindgen_1497b49e3f902d81___closure__destroy___dyn_core_7d5f0a2ba6a62c33___ops__function__FnMut__core_7d5f0a2ba6a62c33___option__Option_web_sys_a2ab6a6de277ed20___features__gen_Blob__Blob_____Output_______: (a: number, b: number) => void;
    readonly wasm_bindgen_1497b49e3f902d81___closure__destroy___dyn_core_7d5f0a2ba6a62c33___ops__function__FnMut__wasm_bindgen_1497b49e3f902d81___JsValue____Output_______: (a: number, b: number) => void;
    readonly wasm_bindgen_1497b49e3f902d81___closure__destroy___dyn_core_7d5f0a2ba6a62c33___ops__function__FnMut__wasm_bindgen_1497b49e3f902d81___JsValue____Output___core_7d5f0a2ba6a62c33___result__Result_____wasm_bindgen_1497b49e3f902d81___JsError___: (a: number, b: number) => void;
    readonly wasm_bindgen_1497b49e3f902d81___convert__closures_____invoke___js_sys_13bf0e9b98266822___Array__web_sys_a2ab6a6de277ed20___features__gen_ResizeObserver__ResizeObserver______true_: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen_1497b49e3f902d81___convert__closures_____invoke___wasm_bindgen_1497b49e3f902d81___JsValue__core_7d5f0a2ba6a62c33___result__Result_____wasm_bindgen_1497b49e3f902d81___JsError___true_: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_1497b49e3f902d81___convert__closures_____invoke___wasm_bindgen_1497b49e3f902d81___JsValue______true_: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_1497b49e3f902d81___convert__closures_____invoke___wasm_bindgen_1497b49e3f902d81___JsValue______true__2: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_1497b49e3f902d81___convert__closures_____invoke___wasm_bindgen_1497b49e3f902d81___JsValue______true__3: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_1497b49e3f902d81___convert__closures_____invoke___wasm_bindgen_1497b49e3f902d81___JsValue______true__4: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_1497b49e3f902d81___convert__closures_____invoke___wasm_bindgen_1497b49e3f902d81___JsValue______true__5: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_1497b49e3f902d81___convert__closures_____invoke___wasm_bindgen_1497b49e3f902d81___JsValue______true__6: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_1497b49e3f902d81___convert__closures_____invoke___wasm_bindgen_1497b49e3f902d81___JsValue______true__7: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_1497b49e3f902d81___convert__closures_____invoke___wasm_bindgen_1497b49e3f902d81___JsValue______true__8: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_1497b49e3f902d81___convert__closures_____invoke___wasm_bindgen_1497b49e3f902d81___JsValue______true__1_: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_1497b49e3f902d81___convert__closures_____invoke_______true_: (a: number, b: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
