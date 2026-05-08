# @requence/socketql

Socket.IO-based GraphQL transport with live queries, URQL client, and React hooks.

## Installation

```bash
npm install @requence/socketql
```

## Exports

| Path                     | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `@requence/socketql/server`       | Server-side: `createServer`, live query store   |
| `@requence/socketql/client`       | Client-side: `createClient` with URQL exchanges |
| `@requence/socketql/client/react` | React hooks: `useQuery`, `useMutation`          |

## Quick Start

### Server

```ts
import { createServer, defineSchema } from '@requence/socketql/server'

const mySchema = defineSchema({
  typeDefs: /* your schema */,
  resolvers: /* your resolvers */,
})

const { attach } = createServer({
  path: '/ws/',
  transports: ['websocket'],
  schemas: [mySchema],
})

attach(httpServer)
```

### Client

```ts
import { createClient } from '@requence/socketql/client'

const { client, invalidate } = createClient({
  path: '/ws/',
  transports: ['websocket'],
})
```

### React Hooks

```tsx
import { useQuery, useMutation } from '@requence/socketql/client/react'
```

## License

MIT
