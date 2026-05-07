import { type DocumentNode, Kind } from 'graphql'
import {
  type Client,
  type Exchange,
  type Operation,
  type OperationResult,
  makeOperation,
  makeResult,
} from 'urql'
import { filter, map, merge, pipe, tap } from 'wonka'

import getDocumentIdentifier from '../getDocumentIdentifier.ts'

function shouldSkip({ kind }: Operation) {
  if (kind === 'subscription' || kind === 'teardown') {
    return true
  }

  return false
}

function getOperationName(operation: Operation) {
  return operation.query.definitions.find(
    (definition) => definition.kind === Kind.OPERATION_DEFINITION,
  )?.name?.value
}

// a variant of the cache exchange that does not automatically invalidates live queries
export default function cacheExchange() {
  const resultCache = new Map<number, OperationResult>()
  const operationCache = new Map<string, Set<number>>()
  let urqlClient: Client

  return {
    invalidate: (target: string | DocumentNode | (string | DocumentNode)[]) => {
      const pendingOperations = new Set<number>()

      const operationNames = (Array.isArray(target) ? target : [target])
        .map((v) => (typeof v === 'string' ? v : getDocumentIdentifier(v)))
        .filter(Boolean) as string[]
      for (const operationName of operationNames) {
        let operations = operationCache.get(operationName)
        if (!operations) {
          operationCache.set(operationName, (operations = new Set()))
        }
        for (const key of operations.values()) {
          pendingOperations.add(key)
        }
        operations.clear()
      }
      for (const key of pendingOperations.values()) {
        if (resultCache.has(key)) {
          const operation = resultCache.get(key)!.operation
          resultCache.delete(key)
          reexecuteOperation(urqlClient, operation)
        }
      }
    },
    exchange: (({ forward, client }) => {
      urqlClient = client

      const isOperationCached = (operation: Operation) =>
        operation.kind === 'query' &&
        operation.context.requestPolicy !== 'network-only' &&
        (operation.context.requestPolicy === 'cache-only' ||
          resultCache.has(operation.key))

      return (ops$) => {
        const cachedOps$ = pipe(
          ops$,
          filter((op) => !shouldSkip(op) && isOperationCached(op)),
          map((operation) => {
            const cachedResult = resultCache.get(operation.key)

            const result: OperationResult =
              cachedResult ||
              makeResult(operation, {
                data: null,
              })

            if (operation.context.requestPolicy === 'cache-and-network') {
              result.stale = true
              reexecuteOperation(client, operation)
            }

            return result
          }),
        )

        const forwardedOps$ = pipe(
          merge([
            pipe(
              ops$,
              filter((op) => !shouldSkip(op) && !isOperationCached(op)),
            ),
            pipe(
              ops$,
              filter((op) => shouldSkip(op)),
            ),
          ]),
          filter(
            (op) =>
              op.kind !== 'query' || op.context.requestPolicy !== 'cache-only',
          ),
          tap((op) => {
            if (op.kind === 'teardown') {
              resultCache.delete(op.key)
            }
          }),
          forward,
          tap((result) => {
            let { operation } = result
            if (!operation) {
              return
            }

            if (
              result.operation.kind === 'mutation' ||
              result.operation.kind === 'subscription'
            ) {
              const invalidate: Array<string> =
                operation.context.invalidate ?? []
              const pendingOperations = new Set<number>()

              for (const operationName of invalidate) {
                let operations = operationCache.get(operationName)
                if (!operations) {
                  operationCache.set(operationName, (operations = new Set()))
                }
                for (const key of operations.values()) {
                  pendingOperations.add(key)
                }
                operations.clear()
              }
              for (const key of pendingOperations.values()) {
                if (resultCache.has(key)) {
                  operation = resultCache.get(key)!.operation
                  resultCache.delete(key)
                  reexecuteOperation(client, operation)
                }
              }
              return
            }

            const operationName = getOperationName(operation)
            if (!operationName) {
              return
            }

            if (operation.kind === 'query' && result.data) {
              resultCache.set(operation.key, result)
              let operations = operationCache.get(operationName)
              operationCache.set(operationName, (operations = new Set()))
              operations.add(operation.key)
            }
          }),
        )

        return merge([cachedOps$, forwardedOps$])
      }
    }) satisfies Exchange,
  }
}

const reexecuteOperation = (client: Client, operation: Operation) =>
  client.reexecuteOperation(
    makeOperation(operation.kind, operation, {
      requestPolicy: 'network-only',
    }),
  )
