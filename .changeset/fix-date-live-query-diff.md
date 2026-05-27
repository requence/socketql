---
'@requence/socketql': patch
---

Deep-serialize live query execution results to JSON-safe primitives before generating diff patches. This ensures custom scalars (such as JS `Date` objects) are correctly serialized to strings and can be compared properly by the diffing engine.
