import type { Exchange } from 'urql'
import { delay, filter, merge, pipe, tap } from 'wonka'

// delays the teardown of a live subscription for 500ms to ensure
// that a subsequent operation can reuse the existing one
// this is mandatory in suspense situations so that a result that originates
// from the cache is still "live"
const holdSubscriptionExchange: Exchange =
  ({ forward }) =>
  (ops$) => {
    const markedForTeardownOperations = new Set<number>()
    const teardown = pipe(
      ops$,
      filter((op) => op.kind === 'teardown'),
      tap((op) => markedForTeardownOperations.add(op.key)),
      delay(500),
      filter((op) => markedForTeardownOperations.has(op.key)),
    )
    const rest = pipe(
      ops$,
      filter((op) => op.kind !== 'teardown'),
      tap((op) => {
        if (markedForTeardownOperations.has(op.key)) {
          markedForTeardownOperations.delete(op.key)
        }
      }),
    )
    return forward(merge([teardown, rest]))
  }
export default holdSubscriptionExchange
