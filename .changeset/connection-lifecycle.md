---
"@requence/socketql": minor
---

- `ConnectionError` is now a class (enables `instanceof` checks at runtime)
- Added `disconnect()` and `reconnect()` methods to the client
- `SocketQLProvider` accepts `onConnect` and `onConnectError` callback props. When `onConnectError` is set, errors are forwarded to the callback instead of being thrown to the error boundary.
