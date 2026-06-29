import type { DocumentNode } from 'graphql'
import { useCallback } from 'react'
import {
  type AnyVariables,
  type DocumentInput,
  type OperationResult,
  useMutation as useUrqlMutation,
} from 'urql'

import { useSuspensePromise } from './useSuspensePromise.ts'
import {
  waitForResult,
  waitForResultWithMutation,
} from '../exchanges/emitExchange.ts'
import getDocumentIdentifier from '../getDocumentIdentifier.ts'

export type { UseMutationState, UseMutationExecute } from 'urql'

export type UseMutationArgs<
  Data = any,
  Variables extends AnyVariables = AnyVariables,
> = {
  query: DocumentInput<Data, Variables>
  invalidate?: string | DocumentNode | (string | DocumentNode)[]
  suspense?: boolean
  waitOn?:
    | string
    | DocumentNode
    | (string | DocumentNode)[]
    | ((
        mutationResult: OperationResult<Data, Variables>,
        result: OperationResult,
        operationName: string | undefined,
      ) => boolean)
  waitOnTimeout?: number
}

export function useMutation<
  Data = any,
  Variables extends AnyVariables = AnyVariables,
>(args: UseMutationArgs<Data, Variables>) {
  const [result, execute] = useUrqlMutation(args.query)
  const triggerSuspense = useSuspensePromise()
  return [
    result,
    useCallback(async (variables, context) => {
      const resolveSuspense =
        args.suspense === false ? () => {} : triggerSuspense()

      // Register listener BEFORE the mutation fires to avoid race conditions
      // where the subscription event arrives before the HTTP response.
      let resolveMutation: ((r: OperationResult<Data, Variables>) => void) | undefined
      let cancelWait: (() => void) | undefined

      const resultsReady: Promise<void> = (() => {
        if (!args.waitOn) return Promise.resolve()
        if (typeof args.waitOn === 'function') {
          const { promise, resolveMutation: rm, cancel } = waitForResultWithMutation(
            args.waitOn,
            args.waitOnTimeout,
          )
          resolveMutation = rm
          cancelWait = cancel
          return promise
        }
        return waitForResult(args.waitOn, args.waitOnTimeout)
      })()

      const response = await execute(variables, {
        ...context,
        invalidate: (args.invalidate
          ? Array.isArray(args.invalidate)
            ? args.invalidate
            : [args.invalidate]
          : []
        ).map((v) => (typeof v === 'string' ? v : getDocumentIdentifier(v))),
      })

      if (!response.error) {
        resolveMutation?.(response)
        await resultsReady
      } else {
        // Clean up the listener to avoid a memory leak
        cancelWait?.()
      }

      resolveSuspense()
      return response
    }, []) as typeof execute,
  ] as const
}
