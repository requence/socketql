import {
  type AnyVariables,
  type UseQueryArgs,
  useQuery as useUrqlQuery,
  type OperationContext,
} from 'urql'

export type Reexecute = (opts?: Partial<OperationContext>) => void

export function useQuery<
  Data = any,
  Variables extends AnyVariables = AnyVariables,
>(
  args: UseQueryArgs<Variables, Data>,
): readonly [Data, Reexecute] {
  const [result, reexecute] = useUrqlQuery({
    ...args,
  })

  if (result.error) {
    throw result.error
  }

  return [result.data!, reexecute] as const
}

