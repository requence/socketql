import { useEffect, useState, type ReactNode } from 'react'
import { Provider as UrqlProvider } from 'urql'
import type { ConnectionError } from '../createClient.ts'
import type { createClient } from '../createClient.ts'

export type SocketQLClient = ReturnType<typeof createClient>

export interface SocketQLProviderProps {
  children: ReactNode
  client: SocketQLClient
  onConnect?: () => void
  onConnectError?: (error: ConnectionError) => void
}

export function SocketQLProvider({
  children,
  client,
  onConnect,
  onConnectError,
}: SocketQLProviderProps) {
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const unsubscribeError = client.onConnectError((err) => {
      if (onConnectError) {
        onConnectError(err)
      } else {
        setError(err)
      }
    })
    const unsubscribeConnect = onConnect ? client.onConnect(onConnect) : undefined
    client.connect()
    return () => {
      unsubscribeError()
      unsubscribeConnect?.()
    }
  }, [client, onConnect, onConnectError])

  if (error) {
    throw error
  }

  return <UrqlProvider value={client}>{children}</UrqlProvider>
}
