// NOTE: local binding to work around a Bun bundler bug where
// re-exporting a value from an external package drops the import.
import { CombinedError } from 'urql'

// NEW: Explicitly declare the type alias using the same name
type OperationError = CombinedError

const OperationError = CombinedError

export * from './createClient.ts'
export type { Socket } from 'socket.io-client'
export type { OperationResult, OperationContext, AnyVariables } from 'urql'

export { OperationError }
