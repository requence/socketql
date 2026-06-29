---
'@requence/socketql': minor
---

Extend `waitOn` in `useMutation` to accept a predicate function `(result: OperationResult, operationName: string | undefined) => boolean` in addition to the existing `string | DocumentNode | Array` forms. Subscription results already flow through `emitExchange`, so the predicate works equally for queries and subscriptions. This enables mutations to wait for a specific subscription event (e.g. matching a returned entity ID) rather than a named live query re-emission.
