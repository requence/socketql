---
"@requence/socketql": minor
---

### Connection lifecycle & error handling

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
