/* tslint:disable */
/* eslint-disable */

/**
 * Import user-selected bytes before starting. The engine never fetches retail assets.
 */
export function import_file(name: string, bytes: Uint8Array): void;

/**
 * Import a file an external launch references, such as its client map.
 */
export function import_spawn_file(name: string, bytes: Uint8Array): void;

export function initialize(): void;

/**
 * Call synchronously from the user's Start click, before asynchronous file/storage work.
 */
export function prepare_audio(): void;

/**
 * docs/spawn.md "Probe": the same report as desktop `vera20k --probe`, as a
 * JSON string, from the retail files imported with `import_file` and, when
 * `map_name` is given, the launch file imported with `import_spawn_file`.
 * It needs no running engine: call it before `start_game`/`start_spawn` or
 * between launches. It loads the rules synchronously (seconds).
 */
export function probe(map_name?: string | null): string;

export function restore_user_file(path: string, bytes: Uint8Array, modified_ms: number, deleted: boolean): void;

/**
 * Install durability callbacks before starting. A callback queues asynchronous host storage;
 * a successful engine write means the in-memory write completed, not that storage was flushed.
 */
export function set_persistence_callbacks(write: Function, remove: Function): void;

/**
 * docs/spawn.md "Scripted leave and resign": leave the running multiplayer
 * launch as the abort box's Leave does (on the score screen: Continue).
 * The request waits while the match loads or an outcome is being shown.
 */
export function spawn_leave(): void;

/**
 * docs/spawn.md "Scripted leave and resign": resign the running multiplayer
 * launch as the abort box's Observe does (the local House is destroyed and
 * the player keeps watching); ignored when the box offers no Observe.
 */
export function spawn_resign(): void;

export function start_game(canvas: HTMLCanvasElement, on_status: Function): void;

/**
 * Start directly into the match a launcher described. The text is read exactly
 * like the desktop `-SPAWN` file, with the map resolved in the spawn directory;
 * `on_status` receives `spawn:finished:<json>` once the match ends. After
 * that, the same page may call it again with the same canvas: the running
 * engine (and its imported retail files) starts the next launch.
 */
export function start_spawn(canvas: HTMLCanvasElement, on_status: Function, spawn_ini: string): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly import_file: (a: number, b: number, c: number, d: number) => [number, number];
    readonly import_spawn_file: (a: number, b: number, c: number, d: number) => [number, number];
    readonly initialize: () => void;
    readonly prepare_audio: () => [number, number];
    readonly probe: (a: number, b: number) => [number, number, number, number];
    readonly restore_user_file: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly set_persistence_callbacks: (a: any, b: any) => void;
    readonly spawn_leave: () => [number, number];
    readonly spawn_resign: () => [number, number];
    readonly start_game: (a: any, b: any) => [number, number];
    readonly start_spawn: (a: any, b: any, c: number, d: number) => [number, number];
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
