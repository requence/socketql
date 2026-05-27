# @requence/socketql

## 1.6.3

### Patch Changes

- [`eb69753`](https://github.com/requence/socketql/commit/eb6975385caf8a609753f9688ecda6e5b249b1a4) Thanks [@Torsten85](https://github.com/Torsten85)! - Deep-serialize live query execution results to JSON-safe primitives before generating diff patches. This ensures custom scalars (such as JS `Date` objects) are correctly serialized to strings and can be compared properly by the diffing engine.

## 1.6.2

### Patch Changes

- [`bab3e1d`](https://github.com/requence/socketql/commit/bab3e1d48ba1935d411f088f53676c2a05029621) Thanks [@Torsten85](https://github.com/Torsten85)! - Fix dist being built with the development JSX transform (`jsxDEV` from `react/jsx-dev-runtime`), which broke consumers in both `vite dev` and `vite build`. The build now explicitly uses `jsx: { development: false }` to emit the production transform (`jsx` from `react/jsx-runtime`).

## 1.6.1

### Patch Changes

- [`26b20cc`](https://github.com/requence/socketql/commit/26b20cc6ffc589f086921a4319f9ade6062d961c) Thanks [@Torsten85](https://github.com/Torsten85)! - Fix production build by using the production JSX transform (`react/jsx-runtime`) instead of the development transform (`react/jsx-dev-runtime`)

## 1.6.0

### Minor Changes

- [`407a891`](https://github.com/requence/socketql/commit/407a891871c4afd383e296bceca46a91185ebcd3) Thanks [@Torsten85](https://github.com/Torsten85)! - exported useSubscription hook

## 1.5.0

### Minor Changes

- [`024d60a`](https://github.com/requence/socketql/commit/024d60af625429333f051fac684516744b790451) Thanks [@Torsten85](https://github.com/Torsten85)! - - `ConnectionError` is now a class (enables `instanceof` checks at runtime)
  - Added `disconnect()` and `reconnect()` methods to the client
  - `SocketQLProvider` accepts `onConnect` and `onConnectError` callback props. When `onConnectError` is set, errors are forwarded to the callback instead of being thrown to the error boundary.

## 1.4.0

### Minor Changes

- [`a8ff751`](https://github.com/requence/socketql/commit/a8ff7511414fe4fb3eb45dcd92df8affd01c4bcf) Thanks [@Torsten85](https://github.com/Torsten85)! - ### Connection lifecycle & error handling
  - **`SocketQLProvider`** — New React provider that wraps URQL's `Provider`, calls `connect()` on mount, and throws connection errors to the nearest error boundary.
  - **`ConnectionRejectedError`** now accepts an optional `data` parameter for structured error context sent to the client.
  - **`ConnectionError`** — New client-side type with `data?: Record<string, any>`, exported from `@requence/socketql/client`.

  ### `createClient` API changes
  - **Returns an extended URQL `Client`** directly instead of `{ client, manager, invalidate }`.
  - **`autoConnect`** now defaults to `false`. Use `SocketQLProvider` or call `client.connect()` manually.
  - **`auth`** option (new) — replaces the previous `onConnect` option for providing auth data.
  - **`onConnect`** option — now a connection success handler (`() => void`), no longer used for auth.
  - **`onConnectError`** option — registers an initial connection error handler.
  - **`client.connect()`** — Initiate the WebSocket connection.
  - **`client.onConnect(cb)`** — Subscribe to successful connections. Returns unsubscribe function.
  - **`client.onConnectError(cb)`** — Subscribe to connection errors. Returns unsubscribe function.
  - **`client.invalidate(target)`** — Unchanged, now a method on the client directly.

  ### Migration

  ```diff
  -const { client, manager, invalidate } = createClient({
  -  onConnect: () => ({ token: getAccessToken() }),
  -})
  +const client = createClient({
  +  auth: () => ({ token: getAccessToken() }),
  +})

  -<Provider value={client}>
  +<SocketQLProvider client={client}>
     <App />
  -</Provider>
  +</SocketQLProvider>

  -invalidate('Users')
  +client.invalidate('Users')
  ```

## 1.3.4

### Patch Changes

- [`f6149d2`](https://github.com/requence/socketql/commit/f6149d27a9392c9eae4a1b91103dddd116f3560e) Thanks [@Torsten85](https://github.com/Torsten85)! - added autoConnect option to client and correctly handle reject connection in onConnect

## 1.3.3

### Patch Changes

- [`02a2e5d`](https://github.com/requence/socketql/commit/02a2e5d6756ae25dfc907c17ed540725ce1c835b) Thanks [@Torsten85](https://github.com/Torsten85)! - allow createClient to be called with no arguments

## 1.3.2

### Patch Changes

- [`7ae6c20`](https://github.com/requence/socketql/commit/7ae6c20a322d221a10ef1004ef1e8fb2abc4b321) Thanks [@Torsten85](https://github.com/Torsten85)! - resolved context typing issue, added "withCredentials" pass through

## 1.3.1

### Patch Changes

- [`c6f5257`](https://github.com/requence/socketql/commit/c6f5257557850fd48e7586cee4d405573a8c877e) Thanks [@Torsten85](https://github.com/Torsten85)! - ensure query results are not mutated

## 1.3.0

### Minor Changes

- [`7b84c4a`](https://github.com/requence/socketql/commit/7b84c4ac913cdc0ea8062f0d3e437217986d8e2a) Thanks [@Torsten85](https://github.com/Torsten85)! - added http endpoint

## 1.2.1

### Patch Changes

- [`704dcc8`](https://github.com/requence/socketql/commit/704dcc852147bc7ac555fb45dac65ef8e68c38f2) Thanks [@Torsten85](https://github.com/Torsten85)! - correctly externalized redis

## 1.2.0

### Minor Changes

- [`23d92c9`](https://github.com/requence/socketql/commit/23d92c91f6ee0159e14fd2d6332147a4784076ad) Thanks [@Torsten85](https://github.com/Torsten85)! - additional way of adding schemas

## 1.1.0

### Minor Changes

- [`342bd59`](https://github.com/requence/socketql/commit/342bd59b523f2e14494605f5207ed61ef0e0e8e1) Thanks [@Torsten85](https://github.com/Torsten85)! - added bun support

## 1.0.0

### Major Changes

- [`a565dc9`](https://github.com/requence/socketql/commit/a565dc93d30c5fa24ee1c8cc4a5456c6b244956a) Thanks [@Torsten85](https://github.com/Torsten85)! - Initial commit
