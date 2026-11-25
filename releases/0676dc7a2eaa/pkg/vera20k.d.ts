/* tslint:disable */
/* eslint-disable */

/**
 * Whether `start_spawn` may run now: before the first launch and after a
 * clean exit, not while a game runs, after `start_game` or after a panic.
 */
export function can_start_spawn(): boolean;

export function configure_remote_assets(catalog: string, handler: Function): void;

/**
 * Only the active ticket may publish a complete, independently verified payload.
 */
export function finish_remote_asset(id: number, bytes: Uint8Array, cancelled: boolean): void;

/**
 * Resolves once the fonts the engine's first text draws with have been
 * fetched from `pkg/fonts/` (`render::text_engine::web_fonts`); rejects if
 * one cannot be. Await it before `start_game` or `start_spawn`.
 */
export function fonts_ready(): Promise<any>;

/**
 * docs/spawn.md "Random maps": the random map a share code (`VR1-…`) or
 * `.SED` text describes, made from the retail files imported with
 * `import_file` (never a mod), as `{ report, bytes }`: `report` is the JSON
 * line desktop `vera20k --generate-map` prints, `bytes` the map file. It
 * rejects with an Error saying what is wrong. It needs no running engine.
 * On the threaded package with its pool started it runs on a pool worker
 * and the page's thread goes on; otherwise it runs here (seconds).
 */
export function generate_map(input: string): Promise<{ report: string; bytes: Uint8Array }>;

/**
 * Begin importing a file in parts, so a large one need not be held whole in
 * the page as well: `kind` is "retail" (as `import_file`), "spawn" (as
 * `import_spawn_file`) or "mod:<folder>" (as `import_mod_file`). The engine
 * sets aside `length` bytes at once; `import_part` fills them in order and
 * the last part stores the file. A new begin drops an unfinished one.
 */
export function import_begin(kind: string, name: string, length: number): void;

/**
 * Import user-selected bytes before starting. The engine never fetches retail assets.
 */
export function import_file(name: string, bytes: Uint8Array): void;

/**
 * Import one file of a mod into the in-memory Mods folder, as `name` inside
 * its folder. Between launches, as launch files are: a page plays one mod
 * in one game and another in the next (`set_mod`, `remove_mod`).
 */
export function import_mod_file(folder: string, name: string, bytes: Uint8Array): void;

/**
 * The next part of the file `import_begin` started. Returns whether the
 * file is now whole and imported.
 */
export function import_part(bytes: Uint8Array): boolean;

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

/**
 * Inspect the original RA2 rules and resolved campaign strings without starting
 * a game or changing the mode/config used by the next YR launch.
 */
export function probe_ra2(): string;

/**
 * Drop a mod's files from engine memory, before importing another. Returns
 * how many went. wasm memory does not shrink, but the next import reuses it.
 */
export function remove_mod(folder: string): number;

export function restore_user_file(path: string, bytes: Uint8Array, modified_ms: number, deleted?: boolean | null): void;

/**
 * Install before starting. Receives structured engine-ready, match-ended,
 * engine-exited and engine-error objects. Callback exceptions do not affect the engine.
 */
export function set_lifecycle_callback(callback: Function): void;

/**
 * The mod the next `start_spawn`, `start_game` or `probe` plays: a folder
 * imported with `import_mod_file`, or none for the original game. It reads
 * as config.toml's `[paths] mod` does on the desktop (app::mods).
 */
export function set_mod(folder?: string | null): void;

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
 * Start the original Red Alert 2 rules and asset family, like native -ra2.
 */
export function start_ra2(canvas: HTMLCanvasElement, on_status: Function): void;

/**
 * Start directly into spawn.ini's match. Its match-ended callback is
 * followed by engine-exited; once that has returned, another launch may
 * import its files and call this again. A panic requires a new instance.
 */
export function start_spawn(canvas: HTMLCanvasElement, on_status: Function, spawn_ini: string): void;

/**
 * docs/spawn.md "Version": the same JSON line as desktop `vera20k --version`
 * (the build's `version` and `build_identity`). It needs no retail files and
 * no running engine.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly can_start_spawn: () => number;
    readonly fonts_ready: () => number;
    readonly generate_map: (a: number, b: number) => number;
    readonly import_begin: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly import_file: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly import_mod_file: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly import_part: (a: number, b: number, c: number) => void;
    readonly import_spawn_file: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly initialize: () => void;
    readonly prepare_audio: (a: number) => void;
    readonly probe: (a: number, b: number, c: number) => void;
    readonly probe_ra2: (a: number) => void;
    readonly remove_mod: (a: number, b: number, c: number) => void;
    readonly restore_user_file: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly set_lifecycle_callback: (a: number) => void;
    readonly set_mod: (a: number, b: number, c: number) => void;
    readonly set_persistence_callbacks: (a: number, b: number) => void;
    readonly set_replay_callback: (a: number) => void;
    readonly spawn_leave: (a: number) => void;
    readonly spawn_resign: (a: number) => void;
    readonly start_game: (a: number, b: number, c: number) => void;
    readonly start_ra2: (a: number, b: number, c: number) => void;
    readonly start_spawn: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly version: (a: number) => void;
    readonly configure_remote_assets: (a: number, b: number, c: number, d: number) => void;
    readonly finish_remote_asset: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly __wasm_bindgen_func_elem_81518: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_28887: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_30134: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_30131: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_30132: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_30133: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_81520: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_28879: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_28880: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_28886: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_28881: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_28884: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_28885: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_28883: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_28882: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_28878: (a: number, b: number, c: number) => void;
    readonly __wasm_bindgen_func_elem_28877: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export5: (a: number, b: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
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
