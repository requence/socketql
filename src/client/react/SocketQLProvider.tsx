import { useEffect, useState, type ReactNode } from 'react'
import { Provider as UrqlProvider } from 'urql'
import type { createClient } from '../createClient.ts'

export type SocketQLClient = ReturnType<typeof createClient>

export function SocketQLProvider({
  children,
  client,
}: {
  children: ReactNode
  client: SocketQLClient
}) {
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const unsubscribe = client.onConnectError((err) => setError(err))
    client.connect()
    return unsubscribe
  }, [client])

  if (error) {
    throw error
  }

  return <UrqlProvider value={client}>{children}</UrqlProvider>
}
