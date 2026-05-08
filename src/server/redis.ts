import { AsyncLocalStorage } from 'node:async_hooks'

import { InMemoryLiveQueryStore } from '@n1ru4l/in-memory-live-query-store'
import { createAdapter } from '@socket.io/redis-adapter'
import { Redis } from 'ioredis'

import {
  type ExtendedLiveQueryStore,
  type LiveQueryStoreIdentifier,
  buildIdentifiers,
  buildInvalidationHandler,
} from './createLiveQueryStore.ts'

class RedisLiveQueryStore
  extends InMemoryLiveQueryStore
  implements ExtendedLiveQueryStore
{
  private pubRedis: Redis
  private invalidation = buildInvalidationHandler()
  private identifierStore = new AsyncLocalStorage<Set<string>>()

  constructor(
    private params: {
      includeIdentifierExtension?: boolean
      pub: Redis
      sub: Redis
      channel: string
    },
  ) {
    super(params)
    this.pubRedis = params.pub
    this.subscribe()
  }

  async beforeInvalidate(
    before: (identifiers: string[]) => any,
    execute: () => any,
  ) {
    const identifierSet = new Set<string>()
    await this.identifierStore.run(identifierSet, execute)
    if (identifierSet.size > 0) {
      const identifiers = Array.from(identifierSet)
      await before(identifiers)
      await Promise.all(
        identifiers.map((identifier) =>
          this.pubRedis.publish(this.params.channel, identifier),
        ),
      )
    }
  }

  private async subscribe() {
    const subRedis = this.params.sub
    await subRedis.subscribe(this.params.channel)
    subRedis.on('message', (channel, resourceIdentifier) => {
      if (channel === this.params.channel && resourceIdentifier) {
        super.invalidate(resourceIdentifier)
        this.invalidation.trigger(resourceIdentifier)
      }
    })
  }

  async invalidate(identifier: LiveQueryStoreIdentifier) {
    const identifiers = buildIdentifiers(identifier)
    const store = this.identifierStore.getStore()
    if (store) {
      identifiers.forEach((identifier) => store.add(identifier))
    } else {
      await Promise.all(
        identifiers.map((identifier) =>
          this.pubRedis.publish(this.params.channel, identifier),
        ),
      )
    }
  }

  onInvalidate(
    identifier: LiveQueryStoreIdentifier,
    handler: (identifier: string) => void,
  ) {
    return this.invalidation.subscribe(identifier, handler)
  }
}

export interface RedisAdapterOptions {
  url: string
  liveQueryChannel?: string
}

export interface RedisAdapter {
  adapter: ReturnType<typeof createAdapter>
  liveQueryStore: ExtendedLiveQueryStore
}

/**
 * Creates a Redis adapter for SocketQL.
 *
 * This provides the Socket.IO Redis adapter (for multi-instance
 * socket coordination) and a Redis-backed live query store for
 * cross-instance invalidation.
 *
 * @example
 * ```ts
 * import { createRedisAdapter } from '@requence/socketql/server/redis'
 *
 * const redis = createRedisAdapter({ url: 'redis://localhost:6379' })
 *
 * const server = createServer({
 *   redis,
 *   // ...
 * })
 * ```
 */
export function createRedisAdapter({
  url,
  liveQueryChannel = 'requence-socketql-sync',
}: RedisAdapterOptions): RedisAdapter {
  const pubRedis = new Redis(url)
  const subRedis = pubRedis.duplicate()

  const liveQueryPub = new Redis(url)
  const liveQuerySub = liveQueryPub.duplicate()

  return {
    adapter: createAdapter(pubRedis, subRedis),
    liveQueryStore: new RedisLiveQueryStore({
      includeIdentifierExtension: process.env.NODE_ENV !== 'production',
      pub: liveQueryPub,
      sub: liveQuerySub,
      channel: liveQueryChannel,
    }),
  }
}
