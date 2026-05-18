import { applyLiveQueryJSONDiffPatch } from '@n1ru4l/graphql-live-query-patch-jsondiffpatch'
// @ts-expect-error missing types
import { applyAsyncIterableIteratorToSink } from '@n1ru4l/push-pull-async-iterable-iterator'
import { createSocketIOGraphQLClient } from '@n1ru4l/socket-io-graphql-client'
import { type ManagerOptions, Manager as SocketManager } from 'socket.io-client'
import {
  type Operation,
  Client as UrqlClient,
  subscriptionExchange,
} from 'urql'

import cacheExchange from './exchanges/cacheExchange.ts'
import emitExchange from './exchanges/emitExchange.ts'
import holdSubscriptionExchange from './exchanges/holdSubscriptionExchange.ts'

interface ClientOptions extends Partial<
  Pick<ManagerOptions, 'path' | 'transports' | 'withCredentials'>
> {
  graphqlNamespace?: string
  onConnect?: () => Record<string, any>
}

export function createClient({
  path = '/ws/',
  transports = ['websocket'],
  graphqlNamespace = 'graphql',
  withCredentials,
  onConnect,
}: ClientOptions = {}) {
  const manager = new SocketManager({
    path,
    transports,
    withCredentials,
  })

  const graphQLSocket = manager.socket(`/${graphqlNamespace}`, {
    auth(cb) {
      const data = onConnect?.() ?? {}
      cb(data)
    },
  })

  const ioGraphQLClient = createSocketIOGraphQLClient(graphQLSocket)

  const mapVariables = <T extends Operation['variables']>(variables: T) => {
    if (!variables) {
      return variables
    }

    const mapValue = (value: any): any => {
      if (value instanceof File) {
        return {
          name: value.name,
          type: value.type,
          size: value.size,
          data: value,
        }
      }

      if (Array.isArray(value)) {
        return value.map(mapValue)
      }

      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([propertyName, propertyValue]) => [
            propertyName,
            mapValue(propertyValue),
          ]),
        )
      }

      return value
    }

    return mapValue(variables)
  }
  const cache = cacheExchange()
  const client = new UrqlClient({
    url: 'noop',
    suspense: true,
    requestPolicy: 'cache-first',
    exchanges: [
      holdSubscriptionExchange,
      emitExchange,
      cache.exchange,
      subscriptionExchange({
        enableAllOperations: true,
        forwardSubscription: (operation) => ({
          subscribe: (sink) => ({
            unsubscribe: applyAsyncIterableIteratorToSink(
              applyLiveQueryJSONDiffPatch(
                ioGraphQLClient.execute({
                  operation: operation.query!,
                  variables: mapVariables(operation.variables),
                }),
              ),
              // structuredClone ensures patched results are new references,
              // required because @n1ru4l/json-patch-plus mutates in place
              {
                ...sink,
                next: (value: any) => sink.next(structuredClone(value)),
              },
            ),
          }),
        }),
      }),
    ],
  })

  return {
    client,
    manager,
    invalidate: cache.invalidate,
  }
}
