# Changelog

## [0.4.0] - 2026-04-10

### Added

- **`store.batch(fn)`** — Run multiple dispatches inside a single batch. Listeners are notified once after `fn()` completes using the final state. Effects still run once per batched action in order, after listeners have been notified. Nested `batch` calls collapse into the outermost batch.

  ```ts
  store.batch(() => {
    store.dispatch(actions.setName("Alice"));
    store.dispatch(actions.setAge(30));
  });
  // Subscribers notified once, effects run for each action
  ```

- **`shallowEqual`** — Exported shallow equality helper for plain objects. Compares own keys with `Object.is` on their values. Convenient as the `equals` argument to `subscribeSelector` when selectors return derived objects.

  ```ts
  store.subscribeSelector(
    (state) => ({ x: state.x, y: state.y }),
    (pos) => renderAt(pos),
    shallowEqual,
  );
  ```

- **`createSelector`** — Creates a memoized selector from an array of input selectors and a combiner function. Re-runs the combiner only when input values change (by `Object.is`); returns the cached result otherwise, preventing unnecessary listener notifications.

  ```ts
  const selectVisible = createSelector(
    [(s: RootState) => s.todos.items, (s: RootState) => s.todos.filter],
    (items, filter) =>
      filter === "all" ? items : items.filter((t) => t.done === (filter === "completed")),
  );

  store.subscribeSelector(selectVisible, (visible) => {
    api.v1.log("Visible todos:", visible.length);
  });
  ```

---

## [0.3.0] - 2026-03-18

### Added

- **Optional `equals` parameter on `subscribeSelector`** — callers can now supply a custom equality function `(a: T, b: T) => boolean` to control when the listener fires. Defaults to `Object.is` (no behavior change). This is essential for derived values (arrays, objects) where reference equality would cause the listener to fire on every dispatch even when the logical value hasn't changed.

  ```ts
  store.subscribeSelector(
    (state) => state.items.map((item) => item.id),
    (ids) => { /* only fires when the id list actually changes */ },
    (a, b) => a.length === b.length && a.every((k, i) => k === b[i]),
  );
  ```

---

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
