---
'@requence/socketql': minor
---

Fixed a bug where `SocketQLProvider` would call `client.connect()` again whenever `onConnect` or `onConnectError` prop references changed, causing a race condition that broke WebSocket auto-reconnect. The `client.connect()` call is now in its own `[client]`-only effect. Callbacks are wrapped with `useEffectEvent` internally so callers never need to worry about referential stability. React peer dependency updated to `^19.2.0` where `useEffectEvent` became stable.
