# NAIStore

**NAIStore** is a small, synchronous state management library designed for **NovelAI scripts** and similar single-threaded JavaScript environments.

It provides a predictable way to manage application state using:

- Reducers (and Slices)
- Actions
- Selector-based subscriptions
- Explicit side effects (Effects)

NAIStore is intentionally minimal, dependency-free, and safe to embed directly into a script without build tooling.

---

## Why NAIStore?

NovelAI scripts often need to manage state such as:

- Configuration options
- Script modes
- UI selections
- Message lists
- Persistent counters

NAIStore exists to make that state:

- Centralized
- Predictable
- Easy to reason about
- Cheap to observe

It avoids abstractions that are unnecessary or harmful in a scripting environment.

---

## Design Principles

NAIStore is built around a few strict principles:

- **State updates are synchronous**
- **Effects are synchronously invoked**
- **Reducers are pure**
- **Subscriptions are selector-based**
- **Side effects are explicit**
- **No framework or rendering assumptions**

This makes NAIStore suitable for:

- UI scripts
- Background logic
- Generator hooks
- Mono-script environments

---

## Installation

NAIStore is designed to be **copied directly into your script**.

There is no required module system, bundler, or runtime dependency.

---

## Performance Notes

NAIStore is synchronous and efficient, but it is **not designed for high-frequency updates**.

Do **not** dispatch actions for:

- Token streams
- Partial text updates
- Animation frames
- Rapid progress updates

Handle those imperatively instead.

---

## Core Concepts

### Actions

Actions are plain objects that describe _what happened_. They typically have a `type` and a `payload`.

```ts
type Action<T = string> = {
  type: T;
  payload?: any;
  [key: string]: any;
};
```

### Reducers

Reducers are pure functions that compute the next state based on the previous state and an action.

```ts
type Reducer<S> = (state: S | undefined, action: Action) => S;
```

---

## Creating a Store

```ts
const store = createStore(reducer);
```

A store owns:

- The current state
- The reducer
- Subscriptions
- Effects

An optional `debug` flag enables action logging:

```ts
const store = createStore(reducer, true);
// Logs every dispatched action via api.v1.log
```

---

## Modern Usage: `createSlice`

While you can write reducers manually with `switch` statements, NAIStore provides `createSlice` to generate reducers and actions automatically. This reduces boilerplate and ensures type safety.

```ts
const counterSlice = createSlice({
  name: "counter",
  initialState: 0,
  reducers: {
    increment: (state) => state + 1,
    decrement: (state) => state - 1,
    add: (state, amount: number) => state + amount,
  },
});

const { actions, reducer } = counterSlice;

// actions.increment() -> { type: 'counter/increment', payload: undefined }
// actions.add(5)      -> { type: 'counter/add', payload: 5 }
```

---

## Alternative: `createReducer`

For cases where you want a map-based reducer without auto-generated action creators, use `createReducer`:

```ts
type MyAction =
  | { type: "INC" }
  | { type: "ADD"; amount: number };

const reducer = createReducer<number, MyAction>(0, {
  INC: (state) => state + 1,
  ADD: (state, action) => state + action.amount,
});
```

This is useful when you need custom action shapes or want to handle actions from multiple sources.

---

## Reading State

```ts
const state = store.getState();
```

This is synchronous and side-effect free.

---

## Dispatching Actions

```ts
store.dispatch(actions.increment());
```

Dispatching an action:

1. Runs the reducer
2. Updates state if it changed
3. Notifies selector subscribers
4. Runs matching effects

Reducer execution, subscriptions, and effect invocation all happen synchronously and in order.

---

## Selector Subscriptions (Reactive Logic)

NAIStore supports **selector-based subscriptions**. They take a pair of functions as arguments.
The first function is the _selector_. Its job is to select, collect, or reduce values from the store. When the result changes during an action dispatch, the _listener_ will be called with the selection.

```ts
store.subscribeSelector(
  (state) => state.count,
  (count) => {
    api.v1.log("Count is now:", count);
  },
);
```

### Change Detection

When you subscribe, the selector is evaluated immediately to capture the **initial value**. On subsequent dispatches, the selector is re-evaluated and the listener is called only if the new value differs from the previous one (compared using `Object.is`).

This means the listener is **not** called at subscription time — only on future state changes that produce a new selected value.

---

## Effects (Side Effects)

Effects allow you to respond to **actions** with **imperative behavior**. Unlike reducers, effects can be impure.

```ts
store.subscribeEffect(
  // 1. Predicate: When to run
  (action) => action.type === 'SAVE',

  // 2. Effect: What to do
  (action, ctx) => {
    api.v1.storage.set("state", ctx.getState());
  },
);
```

### Effect execution rules

Effects:

- Run **after** the reducer completes
- Run synchronously
- Run for every dispatched action that matches the predicate
- Can dispatch new actions

---

## Action Matching with `matchesAction`

The `matchesAction` helper provides type-safe action matching for use with `subscribeEffect`. It extracts the action type from a slice action creator and returns a type guard.

```ts
store.subscribeEffect(
  matchesAction(todosSlice.actions.add),
  (action, ctx) => {
    // action is typed as PayloadAction<AddPayload>
    api.v1.log("Todo added:", action.payload);
  },
);
```

### Payload Predicate

You can optionally provide a predicate to match only specific payloads:

```ts
store.subscribeEffect(
  matchesAction(todosSlice.actions.toggle, (payload) => payload.id === "special"),
  (action, ctx) => {
    // Only fires when the "special" todo is toggled
  },
);
```

---

## Examples

### Example 1: Simple Counter (using `createSlice`)

This example demonstrates the core data flow with minimal boilerplate.

```ts
// 1. Define the Slice
const counterSlice = createSlice({
  name: "counter",
  initialState: { value: 0 },
  reducers: {
    increment: (state) => ({ value: state.value + 1 }),
    decrement: (state) => ({ value: state.value - 1 }),
    reset: () => ({ value: 0 }),
  },
});

// 2. Create Store
const store = createStore(counterSlice.reducer);

// 3. Subscribe
store.subscribeSelector(
  (state) => state.value,
  (val) => api.v1.log(`Counter: ${val}`),
);

// 4. Dispatch
const { increment, decrement, reset } = counterSlice.actions;

store.dispatch(increment()); // Counter: 1
store.dispatch(increment()); // Counter: 2
store.dispatch(decrement()); // Counter: 1
store.dispatch(reset());     // Counter: 0
```

---

### Example 2: Complex TODO List (Full Architecture)

This example demonstrates:
- TypeScript type inference for State and Actions
- `createSlice` for feature-based logic
- `combineReducers` for composing state
- Effects for persistence
- `matchesAction` for type-safe effect predicates
- Handling complex data structures

#### 1. Define Types and Slices

```ts
// --- Domain Types ---
type Todo = { id: string; text: string; done: boolean };
type Filter = "all" | "active" | "completed";

// --- Todos Slice ---
const todosSlice = createSlice({
  name: "todos",
  initialState: {
    items: [] as Todo[],
    filter: "all" as Filter,
  },
  reducers: {
    add: (state, todo: Todo) => ({
      ...state,
      items: [...state.items, todo],
    }),
    toggle: (state, id: string) => ({
      ...state,
      items: state.items.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t
      ),
    }),
    setFilter: (state, filter: Filter) => ({
      ...state,
      filter,
    }),
    // Bulk load for hydration
    load: (state, items: Todo[]) => ({
      ...state,
      items,
    }),
  },
});

// Extract actions for ease of use
const { add, toggle, setFilter, load } = todosSlice.actions;
```

#### 2. Compose the Store

```ts
// Combine reducers (extensible for more features)
const rootReducer = combineReducers({
  todos: todosSlice.reducer,
  // settings: settingsSlice.reducer,
});

// Infer RootState from the reducer itself
type RootState = ReturnType<typeof rootReducer>;

const store = createStore(rootReducer);
```

#### 3. Persistence Effect

```ts
// Persist whenever a todo is added or toggled
store.subscribeEffect(
  (action) =>
    [add.type, toggle.type].includes(action.type),

  (_action, ctx) => {
    api.v1.storage.set("todos", ctx.getState())
    .catch((err) => api.v1.error("Failed to save todos:", err))
  }
);
```

#### 4. Usage

```ts
// Subscribe to filtered view
store.subscribeSelector(
  (state) => {
    const { items, filter } = state.todos;
    if (filter === "all") return items;
    return items.filter((t) => (filter === "completed" ? t.done : !t.done));
  },
  (visibleTodos) => {
    api.v1.log("Visible Todos Updated:", visibleTodos.map((t) => t.text));
  }
);

// Dispatch Actions
store.dispatch(add({ id: "1", text: "Learn NAIStore", done: false }));
store.dispatch(add({ id: "2", text: "Build something cool", done: false }));
store.dispatch(toggle("1"));

store.dispatch(setFilter("active"));
// Listener fires with only active todos
```

---

### What this shows:

- **Type Safety**: `RootState` is inferred, `Payload` types are enforced by `createSlice`.
- **Modularity**: Logic is encapsulated in slices.
- **Predictability**: Data flows one way: Action -> Reducer -> Store -> Selectors.
