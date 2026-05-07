import {
  type AnyVariables,
  type UseQueryArgs,
  useQuery as useUrqlQuery,
} from 'urql'

export function useQuery<
  Data = any,
  Variables extends AnyVariables = AnyVariables,
>(args: UseQueryArgs<Variables, Data>): Data {
  const [result] = useUrqlQuery({
    ...args,
  })

  if (result.error) {
    throw result.error
  }

  return result.data!
}
