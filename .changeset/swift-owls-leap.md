---
'@requence/socketql': minor
---

The `waitOn` option on `useMutation` now accepts a predicate function with the signature `(mutationResult, result, operationName) => boolean`. The mutation result is passed as the first argument, making it straightforward to match incoming subscription events against data returned by the mutation (e.g. waiting for an `ItemCreated` event whose `id` matches the newly created entity). The listener is registered before the mutation fires and buffers results in-flight, so no events are missed even when the server broadcasts before the HTTP response returns.
