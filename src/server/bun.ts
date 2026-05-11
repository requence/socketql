import { Server as BunEngine } from '@socket.io/bun-engine'

import {
  type ServerOptions,
  type SocketQLSchema,
  createServer as createNodeServer,
  defineSchema,
} from './createServer.ts'

export type { ServerOptions, SocketQLSchema }
export { defineSchema }
export type { Socket } from './createServer.ts'

export function createServer<Context>(options: ServerOptions<Context>) {
  const {
    server,
    namespace,
    liveQueryStore,
    addSchema,
    generateIntrospection,
    httpHandler,
  } = createNodeServer(options)

  const path = options.path ?? '/ws/'
  const engine = new BunEngine({ path })
  server.bind(engine)

  return {
    server,
    namespace,
    liveQueryStore,
    addSchema,
    generateIntrospection,
    httpHandler,
    handleRequest: (req: Request, bunServer: any) =>
      engine.handleRequest(req, bunServer),
    withServer:
      (fallback: (req: Request, server: any) => Response | Promise<Response>) =>
      (req: Request, bunServer: any) => {
        if (new URL(req.url).pathname.startsWith(path)) {
          return engine.handleRequest(req, bunServer)
        }
        return fallback(req, bunServer)
      },
    handler: () => engine.handler(),
  }
}

