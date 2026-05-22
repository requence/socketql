import {
  type AnyVariables,
  type SubscriptionHandler,
  type UseSubscriptionArgs,
  useSubscription as useUrqlSubscription,
} from 'urql'

export function useSubscription<
  Data = any,
  Result = Data,
  Variables extends AnyVariables = AnyVariables,
>(
  args: UseSubscriptionArgs<Variables, Data>,
  handler?: SubscriptionHandler<Data, Result>,
) {
  const [result, execute] = useUrqlSubscription(args, handler)

  if (result.error) {
    throw result.error
  }

  return [result.data as Result | undefined, execute] as const
}
