import type { DocumentNode } from 'graphql'
import { useCallback } from 'react'
import {
  type AnyVariables,
  type DocumentInput,
  useMutation as useUrqlMutation,
} from 'urql'

import { useSuspensePromise } from './useSuspensePromise.ts'
import { waitForResult } from '../exchanges/emitExchange.ts'
import getDocumentIdentifier from '../getDocumentIdentifier.ts'

export type { UseMutationState, UseMutationExecute } from 'urql'

export type UseMutationArgs<
  Data = any,
  Variables extends AnyVariables = AnyVariables,
> = {
  query: DocumentInput<Data, Variables>
  invalidate?: string | DocumentNode | (string | DocumentNode)[]
  suspense?: boolean
  waitOn?: string | DocumentNode | (string | DocumentNode)[]
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
      const resultsReady = args.waitOn
        ? waitForResult(args.waitOn, args.waitOnTimeout)
        : Promise.resolve()

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
        await resultsReady
      }
      resolveSuspense()
      return response
    }, []) as typeof execute,
  ] as const
}
