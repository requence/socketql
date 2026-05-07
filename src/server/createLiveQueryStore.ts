import { AsyncLocalStorage } from 'node:async_hooks'

import {
  InMemoryLiveQueryStore,
  type InMemoryLiveQueryStoreParameter,
} from '@n1ru4l/in-memory-live-query-store'
import { Redis } from 'ioredis'

import buildLiveIdentifier from './buildLiveIdentifier.ts'

export interface LiveQueryStoreIdentifierBuilderTools {
  id: (type: string | string[], id: string | number) => string
  args: (type: string | string[], args: Record<string, any>) => string
}

const liveQueryStoreIdentifierBuilderTools: LiveQueryStoreIdentifierBuilderTools =
  {
    id: (type, id) => `${Array.isArray(type) ? type.join('.') : type}:${id}`,
    args: (type, args) => buildLiveIdentifier(type, args),
  }

type Falsy = null | undefined | false | 0 | ''

export type LiveQueryStoreIdentifier =
  | string
  | Falsy
  | (string | Falsy)[]
  | ((
      tools: LiveQueryStoreIdentifierBuilderTools,
    ) => string | Falsy | (string | Falsy)[])

function buildIdentifiers(rawIdentifier: LiveQueryStoreIdentifier) {
  let identifier: string | Falsy | (string | Falsy)[]
  if (typeof rawIdentifier === 'function') {
    identifier = rawIdentifier(liveQueryStoreIdentifierBuilderTools)
  } else {
    identifier = rawIdentifier
  }

  return (Array.isArray(identifier) ? identifier : [identifier]).filter(
    Boolean,
  ) as string[]
}

type InvalidationHandler = (identifier: string) => void

export interface ExtendedLiveQueryStore extends InMemoryLiveQueryStore {
  invalidate(identifier: LiveQueryStoreIdentifier): Promise<void>
  beforeInvalidate(
    before: (identifiers: Array<string>) => any,
    execute: () => any,
  ): Promise<void>
  onInvalidate(
    identifier: LiveQueryStoreIdentifier,
    handler: InvalidationHandler,
  ): () => void
}

function buildInvalidationHandler() {
  const invalidationHandler = new Map<string, Set<InvalidationHandler>>()

  return {
    trigger(identifier: string) {
      invalidationHandler
        .get(identifier)
        ?.forEach((handler) => handler(identifier))
    },
    subscribe(
      identifier: LiveQueryStoreIdentifier,
      handler: InvalidationHandler,
    ) {
      const identifiers = buildIdentifiers(identifier)

      identifiers.forEach((identifier) => {
        if (!invalidationHandler.has(identifier)) {
          invalidationHandler.set(identifier, new Set())
        }
        invalidationHandler.get(identifier)!.add(handler)
      })

      return () => {
        identifiers.forEach((identifier) => {
          const set = invalidationHandler.get(identifier)!
          set.delete(handler)
          if (set.size === 0) {
            invalidationHandler.delete(identifier)
          }
        })
      }
    },
  }
}

class LiveQueryStore
  extends InMemoryLiveQueryStore
  implements ExtendedLiveQueryStore
{
  private invalidation = buildInvalidationHandler()
  private identifierStore = new AsyncLocalStorage<Set<string>>()

  async beforeInvalidate(
    before: (identifiers: string[]) => any,
    execute: () => any,
  ) {
    const identifierSet = new Set<string>()
    await this.identifierStore.run(identifierSet, execute)
    if (identifierSet.size > 0) {
      const identifiers = Array.from(identifierSet)
      await before(identifiers)
      super.invalidate(identifiers)
      identifiers.forEach(this.invalidation.trigger)
    }
  }

  async invalidate(identifier: LiveQueryStoreIdentifier) {
    const identifiers = buildIdentifiers(identifier)
    const store = this.identifierStore.getStore()
    if (store) {
      identifiers.forEach((identifier) => store.add(identifier))
    } else {
      super.invalidate(identifiers)
      identifiers.forEach(this.invalidation.trigger)
    }
  }
  onInvalidate(
    identifier: LiveQueryStoreIdentifier,
    handler: InvalidationHandler,
  ) {
    return this.invalidation.subscribe(identifier, handler)
  }
}

interface RedisLiveQueryStoreParamters extends InMemoryLiveQueryStoreParameter {
  redisUrl: string
  channel: string
}

class RedisLiveQueryStore
  extends InMemoryLiveQueryStore
  implements ExtendedLiveQueryStore
{
  private pubRedis: Redis
  private invalidation = buildInvalidationHandler()
  private identifierStore = new AsyncLocalStorage<Set<string>>()

  constructor(private params: RedisLiveQueryStoreParamters) {
    super(params)
    this.pubRedis = new Redis(params.redisUrl)
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
    const subRedis = this.pubRedis.duplicate()
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
    handler: InvalidationHandler,
  ) {
    return this.invalidation.subscribe(identifier, handler)
  }
}

export interface LiveQueryStoreOptions {
  redisUrl?: string
  redisChannel?: string
}
export default function createLiveQueryStore({
  redisUrl,
  redisChannel = 'requence-socketql-sync',
}: LiveQueryStoreOptions) {
  return redisUrl
    ? new RedisLiveQueryStore({
        includeIdentifierExtension: process.env.NODE_ENV !== 'production',
        redisUrl,
        channel: redisChannel,
      })
    : new LiveQueryStore({
        includeIdentifierExtension: process.env.NODE_ENV !== 'production',
      })
}
