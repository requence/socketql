import { GraphQLError } from 'graphql'

export class UnauthorizedError extends Error {}

export class ConnectionRejectedError extends Error {
  constructor(message = 'Connection rejected') {
    super(message)
    this.name = 'ConnectionRejectedError'
  }
}

export function unauthorized(
  message: string,
  opts: { critical?: boolean } = {},
): never {
  throw new GraphQLError(`Unauthorized: ${message}`, {
    extensions: {
      authentication: message,
      critical: opts.critical ?? false,
    },
    originalError: new UnauthorizedError(),
  })
}

export function error(message: string): never {
  throw new GraphQLError(message)
}
