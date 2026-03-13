# TypeScript Style Guide

Reference: [TypeScript Style Guide](https://mkosir.github.io/typescript-style-guide/)

## TLDR

- **Organize code by feature** and collocate related code.
- **Use named exports.**
- **Consistent naming**: camelCase (vars, functions), PascalCase (types, components), CONST_CASE (constants).
- **Pure, stateless, single-responsibility functions.**
- **Avoid type assertions**; use proper types.
- **Embrace discriminated unions** instead of many optional props.
- **Required over optional** object properties where possible.
- **Immutability**: `Readonly`, `ReadonlyArray`, `as const`.
- **Const assertions** for type safety and immutability.

## Types

- **Narrow types**; prefer explicit types only when they narrow (e.g. `Map<K,V>`, literal unions).
- **Immutability**: use `Readonly` / `ReadonlyArray`; return new data (e.g. `.slice()` not `.splice()`).
- **Required > optional**; use **discriminated unions** when you have multiple shapes.
- **`as const satisfies Type`** for type-safe, immutable constants.
- **Template literal types** for API routes, version strings, etc.
- **Use `unknown`**, never `any`; narrow with type guards before use.
- **Avoid `as` and `!`** except when necessary (e.g. third-party types).
- **Use `@ts-expect-error` with a comment** instead of `@ts-ignore`.
- **Prefer `type` over `interface`** (use one consistently).
- **Array types**: `Array<T>` and `ReadonlyArray<T>` (generic form).
- **`import type`** for type-only imports.

## Functions

- Single responsibility, stateless, pure (no side effects when possible).
- Prefer **single options object** as argument instead of many parameters.
- **Discriminated union args** over many optional params.
- **Explicit return types** on public/API boundaries.

## Variables

- **`as const`** for constants (objects, arrays, template literals).
- **Literal types** and **const assertion arrays/objects** instead of enums.
- **Type unions** (e.g. `'pending' | 'done'`) instead of multiple boolean flags.
- **`null`** for “no value”; **`undefined`** for “not present”.

## Naming

- **Named exports** only (no default exports except when required, e.g. some pages).
- **Booleans**: prefix `is`, `has`, `can`, etc.
- **Constants**: UPPER_SNAKE_CASE; object/array constants: singular name + `as const`.
- **Generics**: `T` + PascalCase (e.g. `TRequest`, `TResponse`).

## Source organization

- **By feature**; collocate related code; relative imports within feature, absolute for shared.
- **Sort imports** (e.g. Prettier/ESLint).

## Node/backend specifics (this project)

- Use **dot notation** for env: `process.env.PORT` (never `process.env['PORT']`) for Mochahost.
- **Single dotenv load** with try/catch and explicit path (see MOCHAHOST-QUICKSTART).
- **One entry point** in `dist/` (e.g. `dist/server.js`); minimal `web.config` for IIS/iisnode.
