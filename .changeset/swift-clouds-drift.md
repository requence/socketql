---
'@requence/socketql': minor
---

Wrap subscription async iteration in wrapExecute so that nested field
resolvers run within the execution context (e.g. AsyncLocalStorage).
Previously only the initial subscribe call was wrapped, causing resolvers
for subscription result types to lose context like socket or branch state.
