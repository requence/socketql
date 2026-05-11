import type { BatchLoadFn } from 'dataloader'
import type DataLoader from 'dataloader'
import type { Namespace, Socket } from 'socket.io'

import type { liveContextSymbol } from './const.ts'
import type { ExtendedLiveQueryStore } from './createLiveQueryStore.ts'
import type { unauthorized } from './errors.ts'
import type { QueriedFields } from './getQueriedFields.ts'

type BaseGraphQLContext = {
  queriedFields: QueriedFields
  unauthorized: typeof unauthorized
  loader: <V, K = string>(
    load: BatchLoadFn<K, V>,
    loaderName?: string,
  ) => DataLoader<K, V>
  liveQueryStore: ExtendedLiveQueryStore & {
    addIdentifier: (
      identifier:
        | string
        | string[]
        | ((tools: {
            id: (id: string | number) => string
            args: (args: Record<string, any>) => string
          }) => string | string[]),
    ) => void
  }
  [liveContextSymbol]: {
    addResourceIdentifier: (identifer: string | string[]) => void
  }
}

export type WebSocketGraphQLContext = BaseGraphQLContext & {
  transport: 'websocket'
  namespace: Namespace
  socket: Socket
}

export type HttpGraphQLContext = BaseGraphQLContext & {
  transport: 'http'
}

export type GraphQLContext = WebSocketGraphQLContext | HttpGraphQLContext
