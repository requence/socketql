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

export class ConnectionError extends Error {
  data?: Record<string, any>

  constructor(
    message: string,
    options?: { data?: Record<string, any>; cause?: unknown },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'ConnectionError'
    this.data = options?.data
  }
}

interface ClientOptions extends Partial<
  Pick<
    ManagerOptions,
    'path' | 'transports' | 'withCredentials' | 'autoConnect'
  >
> {
  graphqlNamespace?: string
  auth?: () => Record<string, any>
  onConnect?: () => void
  onConnectError?: (error: ConnectionError) => void
  /**
   * Wraps the callback that pushes live query results into the URQL
   * pipeline.  The React layer can pass `startTransition` here so
   * that live query push updates are treated as transition updates
   * instead of urgent ones.
   */
  wrapLiveQueryUpdate?: (fn: () => void) => void
}

export function createClient({
  path = '/ws/',
  transports = ['websocket'],
  graphqlNamespace = 'graphql',
  withCredentials,
  autoConnect = false,
  auth,
  onConnect: initialOnConnect,
  onConnectError: initialOnConnectError,
  wrapLiveQueryUpdate = (fn) => fn(),
}: ClientOptions = {}) {
  const manager = new SocketManager({
    path,
    transports,
    withCredentials,
    autoConnect,
  })

  const graphQLSocket = manager.socket(`/${graphqlNamespace}`, {
    auth(cb) {
      const data = auth?.() ?? {}
      cb(data)
    },
  })

  const errorListeners = new Set<(error: ConnectionError) => void>()
  const connectListeners = new Set<() => void>()

  if (initialOnConnect) {
    connectListeners.add(initialOnConnect)
  }

  if (initialOnConnectError) {
    errorListeners.add(initialOnConnectError)
  }

  graphQLSocket.on('connect_error', (err) => {
    const connectionError = new ConnectionError(err.message, {
      data: (err as any).data,
      cause: err,
    })
    for (const listener of errorListeners) {
      listener(connectionError)
    }
  })

  graphQLSocket.on('connect', () => {
    for (const listener of connectListeners) {
      listener()
    }
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
          subscribe: (sink) => {
            let disposed = false
            let currentUnsubscribe: (() => void) | undefined

            const startSubscription = () => {
              currentUnsubscribe = applyAsyncIterableIteratorToSink(
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
                  next: (value: any) =>
                    wrapLiveQueryUpdate(() =>
                      sink.next(structuredClone(value)),
                    ),
                  error: (error: any) => {
                    if (
                      !disposed &&
                      error instanceof Error &&
                      error.message === 'Wrong revision received.'
                    ) {
                      startSubscription()
                      return
                    }
                    sink.error(error)
                  },
                },
              )
            }

            startSubscription()

            return {
              unsubscribe: () => {
                disposed = true
                currentUnsubscribe?.()
              },
            }
          },
        }),
      }),
    ],
  })

  return Object.assign(client, {
    invalidate: cache.invalidate,
    socket: manager.socket.bind(manager),
    connect: () => graphQLSocket.connect(),
    disconnect: () => graphQLSocket.disconnect(),
    reconnect: () => {
      graphQLSocket.disconnect()
      graphQLSocket.connect()
    },
    onConnect: (cb: () => void) => {
      connectListeners.add(cb)
      return () => {
        connectListeners.delete(cb)
      }
    },
    onConnectError: (cb: (error: ConnectionError) => void) => {
      errorListeners.add(cb)
      return () => {
        errorListeners.delete(cb)
      }
    },
    onReconnect: (cb: () => void) => {
      manager.on('reconnect', cb)
      return () => {
        manager.off('reconnect', cb)
      }
    },
    onReconnectAttempt: (cb: (attempt: number) => void) => {
      manager.on('reconnect_attempt', cb)
      return () => {
        manager.off('reconnect_attempt', cb)
      }
    },
    onReconnectError: (cb: (error: Error) => void) => {
      manager.on('reconnect_error', cb)
      return () => {
        manager.off('reconnect_error', cb)
      }
    },
    onReconnectFailed: (cb: () => void) => {
      manager.on('reconnect_failed', cb)
      return () => {
        manager.off('reconnect_failed', cb)
      }
    },
  })
}
