---
'@requence/socketql': patch
---

fix errors thrown during live query streaming being serialized as `{}` over Socket.IO (causing `[GraphQL] [object Object]` on the client). Errors are now wrapped in proper `GraphQLError` instances with string messages and routed through `formatError`.
