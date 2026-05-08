import { AsyncLocalStorage } from 'node:async_hooks'

import { InMemoryLiveQueryStore } from '@n1ru4l/in-memory-live-query-store'

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

export function buildIdentifiers(rawIdentifier: LiveQueryStoreIdentifier) {
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

export function buildInvalidationHandler() {
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

export default class LiveQueryStore
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
