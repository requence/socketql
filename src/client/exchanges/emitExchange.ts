import type { DocumentNode } from 'graphql'
import type { AnyVariables, Exchange, OperationResult } from 'urql'
import { pipe, tap } from 'wonka'

import getDocumentIdentifier from '../getDocumentIdentifier.ts'

type ResultHandler = (result: OperationResult) => void

const resultHandlers = new Set<ResultHandler>()

function onResult(handler: ResultHandler) {
  resultHandlers.add(handler)
  return () => {
    resultHandlers.delete(handler)
  }
}

export function waitForResultWithMutation<
  Data = any,
  Variables extends AnyVariables = AnyVariables,
>(
  predicate: (
    mutationResult: OperationResult<Data, Variables>,
    result: OperationResult,
    operationName: string | undefined,
  ) => boolean,
  timeout?: number,
): {
  promise: Promise<void>
  resolveMutation: (result: OperationResult<Data, Variables>) => void
  cancel: () => void
} {
  const buffered: OperationResult[] = []
  let mutationResult: OperationResult<Data, Variables> | null = null
  let resolvePromise!: () => void
  let unsubscribeFn!: () => void
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let settled = false

  function settle() {
    if (settled) return
    settled = true
    if (timeoutId) clearTimeout(timeoutId)
    unsubscribeFn()
    resolvePromise()
  }

  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve

    unsubscribeFn = onResult((result) => {
      if (mutationResult !== null) {
        // mutationResult is available — evaluate in real-time
        const name = getDocumentIdentifier(result.operation.query)
        if (predicate(mutationResult, result, name)) settle()
      } else {
        // mutationResult not yet known — buffer for later evaluation
        buffered.push(result)
      }
    })

    if (timeout && timeout > 0) {
      timeoutId = setTimeout(settle, timeout)
    }
  })

  function resolveMutation(mr: OperationResult<Data, Variables>) {
    mutationResult = mr
    // Flush buffer — check if any already satisfy the predicate
    for (const result of buffered) {
      const name = getDocumentIdentifier(result.operation.query)
      if (predicate(mutationResult, result, name)) {
        settle()
        return
      }
    }
    // No match in buffer — continue listening in real-time
    buffered.length = 0
  }

  return { promise, resolveMutation, cancel: settle }
}

export function waitForResult(
  document: string | DocumentNode | (string | DocumentNode)[],
  timeout?: number,
) {

  const documents = Array.isArray(document) ? document : [document]

  const names = new Set(
    documents
      .map((docOrString) =>
        typeof docOrString === 'string'
          ? docOrString
          : getDocumentIdentifier(docOrString),
      )
      .filter(Boolean),
  )

  return new Promise<void>((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const unsubscribe = onResult((result) => {
      const name = getDocumentIdentifier(result.operation.query)
      if (name) {
        names.delete(name)
        if (names.size === 0) {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          unsubscribe()
          resolve()
        }
      }
    })

    if (timeout && timeout > 0) {
      timeoutId = setTimeout(() => {
        unsubscribe()
        resolve()
      }, timeout)
    }
  })
}

const emitExchange: Exchange =
  ({ forward }) =>
  (ops$) =>
    pipe(
      ops$,
      forward,
      tap((result) => {
        resultHandlers.forEach((handler) => handler(result))
      }),
    )

export default emitExchange
