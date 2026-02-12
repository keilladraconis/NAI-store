# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NAI-store is a NovelAI Script module — a minimal synchronous Redux-inspired state management library for NovelAI scripts and similar single-threaded JavaScript environments. It runs inside NovelAI's scripting runtime, not as a standalone Node.js application.

## Package

- **npm name:** `nai-store`
- **Distribution:** Raw TypeScript source (no compilation)
- **Exports:** `./src/nai-store.ts`

## Build & Type Checking

There is no build step or bundler — the project uses `noEmit` TypeScript for type-checking only.

```bash
npm install              # Install devDependencies (typescript)
npm run typecheck        # Type-check the project (tsc --noEmit)
```

## Release Workflow

Publishing is automated via GitHub Actions (`.github/workflows/publish.yml`):
- **Trigger:** Creating a GitHub Release
- **Method:** OIDC trusted publishing (no NPM_TOKEN secret needed)
- **Steps:** checkout → install → type-check → dry-run pack → publish
- **First publish** must be done manually (`npm publish --access public`), then configure trusted publishing on npmjs.com

## Architecture

- **`src/nai-store.ts`** — The entire library. Exports `createStore`, `createSlice`, `createReducer`, `combineReducers`, `matchesAction`, and the `Store`, `Action` types.
- **`external/script-types.d.ts`** — Ambient type declarations for the NovelAI Scripting API (`api.v1`, etc.). These types are globally available — no imports needed.

### State Management

- `createStore(reducer, debug?)` — Create a store with a root reducer
- `createSlice({ name, initialState, reducers })` — Generate reducers and typed action creators; action types formatted as `"sliceName/actionName"`
- `createReducer(initialState, handlers)` — Create reducer from handler map
- `combineReducers(reducers)` — Compose multiple slice reducers into root reducer
- `matchesAction(actionCreator, predicate?)` — Type-safe action matcher for `subscribeEffect`

### Key Principles

- **Synchronous only** — No async rendering, predictable state updates
- **Reducers must be pure** — Side effects go in `subscribeEffect`
- **Selectors run on every state change** — Only fire listener when selected value changes (`Object.is`)
- **Effects run synchronously** after reducer completes
- **Avoid high-frequency dispatches** — Handle token streams/animations imperatively

## TypeScript Conventions

- Strict mode with `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`
- Target ES2023, module resolution `bundler`
- Avoid `any` type assertions
- Adhere to KISS principle
