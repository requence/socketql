export * from './createClient.ts'
export type { Socket } from 'socket.io-client'
export {
  CombinedError as OperationError,
  type OperationResult,
  type OperationContext,
  type AnyVariables,
} from 'urql'
