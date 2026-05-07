import type { Server as HTTPServer } from 'node:http'
import type { Http2SecureServer, Http2Server } from 'node:http2'
import type { Server as HTTPSServer } from 'node:https'

import { GraphQLLiveDirectiveSDL } from '@envelop/live-query'
import { makeExecutableSchema } from '@graphql-tools/schema'
import {
  MapperKind as GraphQLMapperKind,
  type IResolvers,
  type TypeSource,
  getDirective as getGraphQLDirective,
  mapSchema as mapGraphQLSchema,
} from '@graphql-tools/utils'
import { applyLiveQueryJSONDiffPatchGenerator } from '@n1ru4l/graphql-live-query-patch-jsondiffpatch'
import { registerSocketIOGraphQLServer } from '@n1ru4l/socket-io-graphql-server'
import { createAdapter as createRedisAdapter } from '@socket.io/redis-adapter'
import type DataLoader from 'dataloader'
import {
  type ExecutionArgs,
  type GraphQLError,
  type GraphQLSchema,
  defaultFieldResolver as defaultGraphQLFieldResolver,
  getIntrospectionQuery,
  graphql,
  execute as graphqlExecute,
  subscribe as graphqlSubscribe,
} from 'graphql'
import { Redis } from 'ioredis'
import { Server as IoServer, type Socket } from 'socket.io'

import {
  liveContextSymbol,
  liveQueryIdentifierDirectiveSDL,
  uploadInputSDL,
} from './const.ts'
import type { ExtendedLiveQueryStore, LiveQueryStoreOptions } from './createLiveQueryStore.ts'
import createLiveQueryStore from './createLiveQueryStore.ts'
import { unauthorized } from './errors.ts'
import extendSchema from './extendSchema.ts'
import type { GraphQLContext } from './types.ts'

export { Socket }

type IoServerParameters = ConstructorParameters<typeof IoServer>

type MaybePromise<T> = T | Promise<T>
export type MapSchema = typeof mapGraphQLSchema

export type SchemaTransformerTools = {
  mapSchema: MapSchema
  getDirective: typeof getGraphQLDirective
  MapperKind: typeof GraphQLMapperKind
  defaultFieldResolver: typeof defaultGraphQLFieldResolver
}

export type SchemaTransformer = (
  schema: GraphQLSchema,
  tools: SchemaTransformerTools,
) => GraphQLSchema
export interface ServerOptions<Context>
  extends Pick<NonNullable<IoServerParameters[1]>, 'path' | 'transports'> {
  extendContext?: (
    baseContext: Pick<GraphQLContext, 'socket' | 'namespace'>,
  ) => MaybePromise<Context>
  graphqlNamespace?: string
  onConnect?: (socket: Socket) => MaybePromise<void>
  onDisconnect?: (socket: Socket, reason: string) => MaybePromise<void>
  liveQueryStore?: LiveQueryStoreOptions
  formatError?: (error: GraphQLError) => GraphQLError
  maxUploadSize?: number
  transformSchema?: SchemaTransformer
  pingInterval?: number
  pingTimeout?: number
  redisUrl?: string
  wrapExecute?: <T>(
    execute: () => T,
    context: Context & Omit<GraphQLContext, 'queriedFields'>,
  ) => T | Promise<T>
}

type ServerInstance = HTTPServer | HTTPSServer | Http2SecureServer | Http2Server

export function createServer<Context>({
  extendContext = () => ({}) as Context,
  path = '/ws/',
  transports = ['websocket'],
  graphqlNamespace = 'graphql',
  liveQueryStore: liveQueryStoreOptions = {},
  onConnect,
  onDisconnect,
  formatError,
  maxUploadSize,
  pingInterval = 25_000,
  pingTimeout = 20_000,
  wrapExecute = (execute) => execute(),
  transformSchema = (s) => s,
  redisUrl,
}: ServerOptions<Context>) {
  let adapter
  if (redisUrl) {
    const pubRedis = new Redis(redisUrl)
    const subRedis = pubRedis.duplicate()
    adapter = createRedisAdapter(pubRedis, subRedis)
  }

  const ioServer = new IoServer({
    path,
    transports,
    serveClient: false,
    adapter,
    maxHttpBufferSize: maxUploadSize,
    pingInterval,
    pingTimeout,
  })

  const namespace = ioServer.of(`/${graphqlNamespace}`)

  if (onConnect) {
    namespace.use(async (socket, next) => {
      await onConnect(socket)
      next()
    })
  }

  if (onDisconnect) {
    namespace.on('connection', (socket) => {
      socket.on('disconnect', (reason) => {
        onDisconnect(socket, reason)
      })
    })
  }

  const liveQueryStore = createLiveQueryStore(liveQueryStoreOptions)

  const liveExecute = liveQueryStore.makeExecute(
    async ({ contextValue, ...args }) => {
      const context = contextValue as Record<string, any>
      const originalContextSymbol = Object.getOwnPropertySymbols(
        context,
      )[0] as any

      const unwrappedContext = originalContextSymbol
        ? context[originalContextSymbol]
        : context

      const result = await wrapExecute(
        () =>
          graphqlExecute({
            contextValue: {
              ...context,
              [originalContextSymbol]: {
                ...context[originalContextSymbol],
                [liveContextSymbol]: context,
              },
            },
            ...args,
          }),
        unwrappedContext,
      )

      ;(
        unwrappedContext.dataLoaders as Map<string, DataLoader<any, any>>
      ).forEach((dataLoader) => {
        dataLoader.clearAll()
      })

      if (result.errors && formatError) {
        result.errors = result.errors.map(formatError)
      }

      return result
    },
  )

  const typeDefs: TypeSource[] = []
  const resolvers: IResolvers[] = []
  const execute = async (args: ExecutionArgs) =>
    applyLiveQueryJSONDiffPatchGenerator(liveExecute(args))

  let generatedSchema: GraphQLSchema

  const subscribe = ({ contextValue, ...args }: ExecutionArgs) => {
    const context = contextValue as Record<string, any>
    const originalContextSymbol = Object.getOwnPropertySymbols(
      context,
    )[0] as any

    const unwrappedContext = originalContextSymbol
      ? context[originalContextSymbol]
      : context

    return wrapExecute(
      () =>
        graphqlSubscribe({
          contextValue: {
            ...context,
            [originalContextSymbol]: {
              ...context[originalContextSymbol],
              [liveContextSymbol]: context,
            },
          },
          ...args,
        }),
      unwrappedContext,
    )
  }

  const getSchema = () => {
    if (!generatedSchema) {
      const transformedSchema = transformSchema(
        makeExecutableSchema({
          typeDefs: [
            GraphQLLiveDirectiveSDL,
            liveQueryIdentifierDirectiveSDL,
            uploadInputSDL,
            ...typeDefs,
          ],
          resolvers,
          inheritResolversFromInterfaces: true,
        }),
        {
          mapSchema: mapGraphQLSchema,
          getDirective: getGraphQLDirective,
          MapperKind: GraphQLMapperKind,
          defaultFieldResolver: defaultGraphQLFieldResolver,
        },
      )
      generatedSchema = extendSchema(transformedSchema)
    }
    return generatedSchema
  }

  registerSocketIOGraphQLServer({
    socketServer: namespace as any,
    getParameter: ({ socket }) => ({
      get execute() {
        return execute as typeof graphqlExecute
      },
      get subscribe() {
        return subscribe as typeof graphqlSubscribe
      },
      graphQLExecutionParameter: {
        schema: getSchema(),
        contextValue: {
          namespace,
          socket,
          liveQueryStore,
          unauthorized,
          dataLoaders: new Map<string, DataLoader<any, any>>(),
          ...extendContext({ namespace, socket }),
        },
      },
    }),
  })

  return {
    server: ioServer,
    namespace,
    liveQueryStore: liveQueryStore as ExtendedLiveQueryStore,
    attach: (baseServer: ServerInstance) => ioServer.attach(baseServer),
    addSchema: (opts: {
      typeDefs: TypeSource
      resolvers: IResolvers<any, GraphQLContext & Context>
    }) => {
      typeDefs.push(opts.typeDefs)
      resolvers.push(opts.resolvers)
    },
    async generateIntrospection() {
      const result = await graphql({
        schema: getSchema(),
        source: getIntrospectionQuery(),
      })
      if (result.errors) {
        throw result.errors[0]
      }
      return result.data
    },
  }
}
