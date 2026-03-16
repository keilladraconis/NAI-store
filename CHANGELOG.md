# Changelog

## [0.2.0] - 2026-03-16

### Changed

- **`Action` type tightened**: removed the open `[key: string]: any` index signature. `Action<T>` now only exposes `type` and `payload?: unknown`. This is a **breaking change** for any code accessing arbitrary properties directly on an unnarrowed `Action` — use typed action creators and `matchesAction` to narrow action payloads safely.
- **Debug log label fixed**: the `debug` mode log was incorrectly tagged `"NAIACT"` (copy-paste from nai-act). Now correctly logs `"NAISTORE"`.

### Added

- **Dispatch cascade guard**: `dispatch` now tracks call depth. If depth exceeds 10 (caused by effects that dispatch actions that trigger more effects, etc.), the offending action is dropped and a warning is logged via `api.v1.log`. Prevents infinite dispatch loops.

---

## [0.1.0] - Initial release

- `createStore` with reducer, selector subscriptions, and effects
- `createSlice` for auto-generated actions and reducers
- `createReducer` for map-based reducers
- `combineReducers` for composing slices
- `matchesAction` type-safe effect predicate helper
