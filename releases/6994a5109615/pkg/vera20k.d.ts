/* tslint:disable */
/* eslint-disable */

/**
 * Whether `start_spawn` may run now: before the first launch and after a
 * clean exit, not while a game runs, after `start_game` or after a panic.
 */
export function can_start_spawn(): boolean;

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
 * after exit. It loads the rules synchronously (seconds).
 */
export function probe(map_name?: string | null): string;

export function restore_user_file(path: string, bytes: Uint8Array, modified_ms: number, deleted: boolean): void;

/**
 * Install before starting. Receives structured match-ended, engine-exited,
 * and engine-error objects. Callback exceptions never veto engine shutdown.
 */
export function set_lifecycle_callback(callback: Function): void;

/**
 * Install durability callbacks before starting. A callback queues asynchronous host storage;
 * a successful engine write means the in-memory write completed, not that storage was flushed.
 */
export function set_persistence_callbacks(write: Function, remove: Function): void;

/**
 * Install before starting to receive each closed replay segment as `(name, bytes)`.
 * Persistence is separate: whatever its callbacks report must be restorable.
 */
export function set_replay_callback(callback: Function): void;

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
 * Start directly into spawn.ini's match. Its match-ended callback is
 * followed by engine-exited; once that has returned, another launch may
 * import its files and call this again. A panic requires a new instance.
 */
export function start_spawn(canvas: HTMLCanvasElement, on_status: Function, spawn_ini: string): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly can_start_spawn: () => number;
    readonly import_file: (a: number, b: number, c: number, d: number) => [number, number];
    readonly import_spawn_file: (a: number, b: number, c: number, d: number) => [number, number];
    readonly initialize: () => void;
    readonly prepare_audio: () => [number, number];
    readonly probe: (a: number, b: number) => [number, number, number, number];
    readonly restore_user_file: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly set_lifecycle_callback: (a: any) => void;
    readonly set_persistence_callbacks: (a: any, b: any) => void;
    readonly set_replay_callback: (a: any) => void;
    readonly spawn_leave: () => [number, number];
    readonly spawn_resign: () => [number, number];
    readonly start_game: (a: any, b: any) => [number, number];
    readonly start_spawn: (a: any, b: any, c: number, d: number) => [number, number];
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___wasm_bindgen_789235d5778e9c72___JsValue__core_7d5f0a2ba6a62c33___result__Result_____wasm_bindgen_789235d5778e9c72___JsError___true_: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___js_sys_f5cd97c8605e1911___Array__web_sys_c1709993bd2a60fe___features__gen_ResizeObserver__ResizeObserver______true_: (a: number, b: number, c: any, d: any) => void;
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___wasm_bindgen_789235d5778e9c72___sys__JsNullable_wgpu_8b7697eeedacb418___backend__webgpu__webgpu_sys__gen_GpuError__GpuError___core_7d5f0a2ba6a62c33___result__Result_____wasm_bindgen_789235d5778e9c72___JsError___true_: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___wasm_bindgen_789235d5778e9c72___sys__JsNullable_wgpu_8b7697eeedacb418___backend__webgpu__webgpu_sys__gen_GpuError__GpuError___core_7d5f0a2ba6a62c33___result__Result_____wasm_bindgen_789235d5778e9c72___JsError___true__11: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___wasm_bindgen_789235d5778e9c72___sys__JsNullable_wgpu_8b7697eeedacb418___backend__webgpu__webgpu_sys__gen_GpuError__GpuError___core_7d5f0a2ba6a62c33___result__Result_____wasm_bindgen_789235d5778e9c72___JsError___true__12: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___wasm_bindgen_789235d5778e9c72___JsValue______true_: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___wasm_bindgen_789235d5778e9c72___JsValue______true__3: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___wasm_bindgen_789235d5778e9c72___JsValue______true__4: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___wasm_bindgen_789235d5778e9c72___JsValue______true__5: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___wasm_bindgen_789235d5778e9c72___JsValue______true__7: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___wasm_bindgen_789235d5778e9c72___JsValue______true__8: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___wasm_bindgen_789235d5778e9c72___JsValue______true__9: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke___wasm_bindgen_789235d5778e9c72___JsValue______true__10: (a: number, b: number, c: any) => void;
    readonly wasm_bindgen_789235d5778e9c72___convert__closures_____invoke_______true_: (a: number, b: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
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
