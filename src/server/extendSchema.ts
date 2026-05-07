import { MapperKind, getDirective, mapSchema } from '@graphql-tools/utils'
import DataLoader, { type BatchLoadFn } from 'dataloader'
import {
  type GraphQLArgument,
  type GraphQLField,
  type GraphQLFieldResolver,
  type GraphQLObjectType,
  type GraphQLSchema,
  defaultFieldResolver,
} from 'graphql'

import buildLiveIdentifier from './buildLiveIdentifier.ts'
import { liveContextSymbol } from './const.ts'
import getQueriedFields from './getQueriedFields.ts'
import type { GraphQLContext } from './types.ts'

function extendResolver(
  objectType: GraphQLObjectType,
  field: GraphQLField<any, any, any>,
  baseResolver: GraphQLFieldResolver<any, any>,
): GraphQLFieldResolver<any, any> {
  return async (root, args, context, info) => {
    const addIdentifier: GraphQLContext['liveQueryStore']['addIdentifier'] = (
      rawIdentifier,
    ) => {
      let identifier: string | string[]
      if (typeof rawIdentifier === 'function') {
        identifier = rawIdentifier({
          id: (id) => `${objectType.name}.${field.name}:${id}`,
          args: (args) =>
            buildLiveIdentifier([objectType.name, field.name], args),
        })
      } else {
        identifier = rawIdentifier
      }
      context[liveContextSymbol]?.addResourceIdentifier(identifier)
    }
    return baseResolver(
      root,
      args,
      {
        ...context,
        liveQueryStore: Object.assign(context.liveQueryStore, {
          addIdentifier,
        }),
        get queriedFields() {
          return getQueriedFields(info)
        },
        get loader() {
          const dataLoaders = context.dataLoaders as Map<
            string,
            DataLoader<any, any>
          >

          const name = `${info.parentType.name}.${info.fieldName}`

          return (loader: BatchLoadFn<any, any>, loaderName = name) => {
            if (!dataLoaders.has(loaderName)) {
              dataLoaders.set(loaderName, new DataLoader(loader, { name }))
            }

            return dataLoaders.get(loaderName)
          }
        },
      },
      info,
    )
  }
}

export default function extendSchema(schema: GraphQLSchema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_TYPE]: (objectConfig) => {
      Object.values(objectConfig.getFields()).forEach((field) => {
        const liveIDArgs = field.args
          .map((arg) => [
            arg,
            getDirective(schema, arg, 'liveIdentifier')?.at(-1),
          ])
          .filter(([, directive]) => Boolean(directive)) as [
          GraphQLArgument,
          Record<string, any>,
        ][]

        const {
          resolve = defaultFieldResolver,
          subscribe = defaultFieldResolver,
        } = field

        field.resolve = extendResolver(objectConfig, field, resolve)
        field.subscribe = extendResolver(objectConfig, field, subscribe)

        if (liveIDArgs.length > 0) {
          ;(field.extensions as any).liveQuery = {
            collectResourceIdentifiers: (
              _: unknown,
              args: Record<string, any>,
            ) => {
              const filteredArgs = Object.fromEntries(
                liveIDArgs
                  .map(([arg, params]) => {
                    let value = arg.name in args ? args[arg.name] : null
                    if (!value) {
                      return null
                    }

                    if (typeof value === 'object') {
                      for (const propertyName of params.pick ?? []) {
                        if (propertyName in value && value[propertyName]) {
                          value = { [propertyName]: value[propertyName] }
                          break
                        }
                      }
                    }

                    return [arg.name, value]
                  })
                  .filter(Boolean) as [string, any][],
              )

              return buildLiveIdentifier(
                [objectConfig.name, field.name],
                filteredArgs,
              )
            },
          }
        }
      })
      return objectConfig
    },
  })
}
