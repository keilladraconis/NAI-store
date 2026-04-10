/*
 NAIStore - [0.2.0]
*/

// ==================================================
// Store Types
// ==================================================

export type Action<T = string> = {
  type: T;
  payload?: unknown;
};

type Reducer<S> = (state: S | undefined, action: Action) => S;

type Selector<S, T> = (state: S) => T;

type SelectorListener<T> = (value: T) => void;

type EffectPredicate = (action: Action) => boolean;

type TypedEffectPredicate<A extends Action> = (action: Action) => action is A;

type EffectContext<S> = {
  dispatch(action: Action): void;
  getState(): S;
};

type Effect<S, A extends Action = Action> = (action: A, ctx: EffectContext<S>) => void;

// ==================================================
// Store Interface
// ==================================================

export interface Store<S> {
  getState(): S;
  dispatch(action: Action): void;
  /** Batch multiple dispatches: listeners are notified once after fn() completes. */
  batch(fn: () => void): void;
  subscribeSelector<T>(
    selector: Selector<S, T>,
    listener: SelectorListener<T>,
    equals?: (a: T, b: T) => boolean,
  ): () => void;
  subscribeEffect<A extends Action>(when: TypedEffectPredicate<A>, run: Effect<S, A>): () => void;
  subscribeEffect(when: EffectPredicate, run: Effect<S>): () => void;
}

// ==================================================
// createStore
// ==================================================

export function createStore<S>(
  reducer: Reducer<S>,
  debug: boolean = false,
): Store<S> {
  // Initialize state by dispatching the init action.
  let currentState = reducer(undefined, { type: "@@NAISTORE/INIT" });

  const listeners = new Set<(state: S) => void>();
  const effects = new Set<{ when: EffectPredicate; run: Effect<S> }>();

  let dispatchDepth = 0;
  let _batching = false;
  let _batchedActions: Action[] = [];

  function getState() {
    return currentState;
  }

  function dispatch(action: Action) {
    if (dispatchDepth > 10) {
      api.v1.log("[NAISTORE] Dispatch cascade depth > 10, dropping action:", action.type);
      return;
    }
    dispatchDepth++;
    try {
      if (debug) api.v1.log("NAISTORE", action);
      currentState = reducer(currentState, action);

      if (_batching) {
        _batchedActions.push(action);
        return;
      }

      for (const l of listeners) {
        l(currentState);
      }

      const ctx: EffectContext<S> = { dispatch, getState };
      for (const e of effects) {
        if (e.when(action)) e.run(action, ctx);
      }
    } finally {
      dispatchDepth--;
    }
  }

  function batch(fn: () => void): void {
    if (_batching) {
      // Nested batch — just run; the outer batch handles notifications
      fn();
      return;
    }
    _batching = true;
    _batchedActions = [];
    try {
      fn();
    } finally {
      _batching = false;
      const actions = _batchedActions;
      _batchedActions = [];

      // Notify listeners once with the final state
      for (const l of listeners) {
        l(currentState);
      }

      // Run effects for each batched action
      const ctx: EffectContext<S> = { dispatch, getState };
      for (const action of actions) {
        for (const e of effects) {
          if (e.when(action)) e.run(action, ctx);
        }
      }
    }
  }

  function subscribe(listener: (state: S) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function subscribeSelector<T>(
    selector: Selector<S, T>,
    listener: SelectorListener<T>,
    equals: (a: T, b: T) => boolean = Object.is,
  ) {
    let current = selector(currentState);

    return subscribe((state) => {
      const next = selector(state);
      if (equals(next, current)) return;
      current = next;
      listener(next);
    });
  }

  function subscribeEffect(when: EffectPredicate, run: Effect<S, any>) {
    const effect = { when, run };
    effects.add(effect);
    return () => {
      effects.delete(effect);
    };
  }

  return {
    getState,
    dispatch,
    batch,
    subscribeSelector,
    subscribeEffect,
  };
}

// ==================================================
// Reducer Helpers
// ==================================================

type PayloadAction<P = void> = {
  type: string;
  payload: P;
};

type CaseReducer<S, P = any> = (state: S, payload: P) => S;

type ActionCreator<P> = (void extends P
  ? (payload?: P) => PayloadAction<P>
  : (payload: P) => PayloadAction<P>) & { type: string };

type Slice<S, CR extends Record<string, CaseReducer<S, any>>> = {
  reducer: Reducer<S>;
  actions: {
    [K in keyof CR]: CR[K] extends (state: any, payload: infer P) => any
      ? ActionCreator<P>
      : (() => PayloadAction<void>) & { type: string };
  };
};

/**
 * Creates a slice of state with auto-generated actions and reducer.
 */
export function createSlice<
  S,
  CR extends Record<string, CaseReducer<S, any>>,
>(options: { name: string; initialState: S; reducers: CR }): Slice<S, CR> {
  const { name, initialState, reducers } = options;
  const actions = {} as Slice<S, CR>["actions"];
  const handlers: Record<string, CaseReducer<S, any>> = {};

  for (const key of Object.keys(reducers)) {
    const actionType = `${name}/${key}`;
    handlers[actionType] = reducers[key];
    const creator = (payload: any) => ({ type: actionType, payload });
    creator.type = actionType;
    // @ts-ignore: Dynamic action creator assignment
    actions[key] = creator;
  }

  const reducer = (state: S | undefined, action: Action) => {
    if (state === undefined) return initialState;
    const handler = handlers[action.type];
    if (handler) {
      return handler(state, action.payload);
    }
    return state;
  };

  return { reducer, actions };
}

/**
 * Creates a reducer from a map of action handlers.
 */
export function createReducer<S, A extends Action = Action>(
  initialState: S,
  handlers: {
    [K in A["type"]]?: (state: S, action: Extract<A, { type: K }>) => S;
  },
): Reducer<S> {
  return (state = initialState, action: Action) => {
    // Cast action type to keyof handlers to safely index
    const handler = handlers[action.type as keyof typeof handlers];
    if (handler) {
      return handler(state, action as any);
    }
    return state;
  };
}

/**
 * Combines multiple slice reducers into a single root reducer.
 */
export function combineReducers<R extends Record<string, Reducer<any>>>(
  reducers: R,
): Reducer<{ [K in keyof R]: ReturnType<R[K]> }> {
  return function combinedReducer(state: any, action: Action) {
    let changed = false;
    const nextState: any = {};

    for (const key in reducers) {
      const prevSlice = state ? state[key] : undefined;
      const nextSlice = reducers[key](prevSlice, action);
      nextState[key] = nextSlice;
      if (!state || nextSlice !== prevSlice) changed = true;
    }

    return changed ? nextState : state;
  };
}

// ==================================================
// Effect Helpers
// ==================================================

/**
 * Type-safe action matcher for use with subscribeEffect.
 * Extracts the action type string from an action creator.
 *
 * @example
 * subscribeEffect(
 *   matchesAction(myAction),
 *   (action, ctx) => {
 *     // action.payload is properly typed
 *   }
 * );
 */
export function matchesAction<P>(
  actionCreator: ActionCreator<P>,
  payloadPredicate?: (payload: P) => boolean,
): (action: Action) => action is PayloadAction<P> {
  const actionType = actionCreator.type;
  return (action): action is PayloadAction<P> =>
    action.type === actionType &&
    (!payloadPredicate || payloadPredicate((action as PayloadAction<P>).payload));
}

// ==================================================
// Equality Helpers
// ==================================================

/**
 * Shallow equality check for plain objects. Returns true if both objects
 * have the same keys with reference-equal values. Useful as the `equals`
 * argument to `subscribeSelector` when selectors return derived objects.
 */
export function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  if (a === b) return true;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}

// ==================================================
// Selector Memoization
// ==================================================

/**
 * Creates a memoized selector. Re-runs the combiner only when input values change
 * (by reference equality). Returns the cached result otherwise, preventing
 * unnecessary downstream listener notifications.
 *
 * @example
 * const selectDerived = createSelector(
 *   [(s: MyState) => s.a, (s: MyState) => s.b],
 *   (a, b) => ({ combined: a + b }),
 * );
 */
export function createSelector<S, I extends readonly unknown[], R>(
  inputSelectors: { [K in keyof I]: (state: S) => I[K] },
  combiner: (...inputs: { [K in keyof I]: I[K] }) => R,
): (state: S) => R {
  let lastInputs: unknown[] | undefined;
  let lastResult: R;

  return (state: S): R => {
    const inputs = (inputSelectors as Array<(s: S) => unknown>).map((sel) => sel(state));
    if (
      lastInputs !== undefined &&
      inputs.length === lastInputs.length &&
      inputs.every((v, i) => Object.is(v, lastInputs![i]))
    ) {
      return lastResult;
    }
    lastInputs = inputs;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lastResult = (combiner as (...args: any[]) => R)(...inputs);
    return lastResult;
  };
}

/*
 * END NAIStore
 */
