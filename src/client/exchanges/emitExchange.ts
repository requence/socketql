import type { DocumentNode } from 'graphql'
import type { Exchange, OperationResult } from 'urql'
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
