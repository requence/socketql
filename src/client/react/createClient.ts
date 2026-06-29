import { startTransition } from 'react'

import { createClient as createBaseClient } from '../createClient.ts'

/**
 * React-aware variant of `createClient`.
 *
 * Live query push updates are wrapped in `startTransition` so they
 * are treated as transition updates rather than urgent ones.  This
 * prevents live query pushes from triggering a Suspense fallback
 * while a transition is pending.
 */
export function createClient(
  args: Omit<Parameters<typeof createBaseClient>[0], 'wrapLiveQueryUpdate'>,
) {
  return createBaseClient({
    ...args,
    wrapLiveQueryUpdate: startTransition,
  })
}
