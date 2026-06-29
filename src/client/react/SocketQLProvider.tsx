import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
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

  const handleConnect = useEffectEvent(() => {
    onConnect?.()
  })

  const handleConnectError = useEffectEvent((err: ConnectionError) => {
    if (onConnectError) {
      onConnectError(err)
    } else {
      setError(err)
    }
  })

  useEffect(() => {
    client.connect()
  }, [client])

  useEffect(() => {
    const unsubscribeConnect = client.onConnect(handleConnect)
    const unsubscribeError = client.onConnectError(handleConnectError)
    return () => {
      unsubscribeConnect()
      unsubscribeError()
    }
  }, [client])

  if (error) {
    throw error
  }

  return <UrqlProvider value={client}>{children}</UrqlProvider>
}
