import { useCallback, useState } from 'react'

export function useSuspensePromise() {
  const [suspensePromise, setSuspensePromise] = useState<Promise<void> | null>(
    null,
  )

  if (suspensePromise) {
    throw suspensePromise
  }

  return useCallback(() => {
    let resolvePromise: () => void

    setSuspensePromise(
      new Promise<void>((resolve) => {
        resolvePromise = resolve
      }).then(() => {
        setSuspensePromise(null)
      }),
    )

    return resolvePromise!
  }, [])
}
