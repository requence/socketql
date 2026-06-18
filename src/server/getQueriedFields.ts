import {
  type FragmentDefinitionNode,
  type GraphQLResolveInfo,
  Kind,
  type SelectionSetNode,
} from 'graphql'

import { unauthorized } from './errors.ts'

function getSelectedFields(
  selectionSet: SelectionSetNode,
  fragments: Record<string, FragmentDefinitionNode>,
) {
  const fields: Array<string> = []
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        const name = selection.name.value
        fields.push(name)

        if (selection.selectionSet) {
          fields.push(
            ...getSelectedFields(selection.selectionSet, fragments).map(
              (n) => `${name}.${n}`,
            ),
          )
        }
        break
      }

      case Kind.INLINE_FRAGMENT: {
        const fragmentType = selection.typeCondition?.name.value
        if (fragmentType) {
          fields.push(
            ...getSelectedFields(selection.selectionSet, fragments).map(
              (n) => `#${fragmentType}.${n}`,
            ),
          )
        }
        break
      }

      case Kind.FRAGMENT_SPREAD: {
        const fragmentName = selection.name.value
        const fragment = fragments[fragmentName]
        if (fragment) {
          fields.push(
            ...getSelectedFields(fragment.selectionSet, fragments),
          )
        }
        break
      }
    }
  }

  return fields
}

interface DeepRecord<T> {
  [key: string]: T | DeepRecord<T>
}

function isDeepRecord<T>(val: any): val is DeepRecord<T> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

function flatten(record: DeepRecord<string | string[]>) {
  const fields: Array<string> = []

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      fields.push(`${key}.${value}`)
    } else if (Array.isArray(value)) {
      fields.push(...value.map((v) => `${key}.${v}`))
    } else {
      fields.push(...flatten(value).map((v) => `${key}.${v}`))
    }
  }

  return fields
}

type Fields =
  | string
  | DeepRecord<string | string[]>
  | Array<string | DeepRecord<string | string[]>>

function expandFields(fields: Fields): Array<string> {
  return Array.isArray(fields)
    ? fields.flatMap((field) => expandFields(field))
    : isDeepRecord(fields)
      ? flatten(fields)
      : [fields]
}

export default function getQueriedFields(info: GraphQLResolveInfo) {
  const queriedFields = info.fieldNodes[0].selectionSet
    ? getSelectedFields(info.fieldNodes[0].selectionSet, info.fragments)
    : []

  return {
    get root() {
      let rootPath = info.path
      while (rootPath.prev) {
        rootPath = rootPath.prev
      }

      const rootFieldName = rootPath.key
      const operationType = info.operation.operation

      let rootType
      switch (operationType) {
        case 'query': {
          rootType = info.schema.getQueryType()
          break
        }
        case 'mutation': {
          rootType = info.schema.getMutationType()
          break
        }
        case 'subscription': {
          rootType = info.schema.getSubscriptionType()
          break
        }
      }

      const rootTypeName = rootType ? rootType.name : 'Unknown'
      return `${rootTypeName}.${rootFieldName}`
    },
    list: queriedFields,
    filter(prefix: string) {
      return queriedFields
        .filter((field) => field.startsWith(`${prefix}.`))
        .map((field) => field.substring(prefix.length + 1))
    },
    getOtherThan(fields: Fields) {
      const expandedFields = expandFields(fields)
      return queriedFields.filter(
        (queriedField) =>
          queriedField !== '__typename' &&
          !queriedField.endsWith('.__typename') &&
          !expandedFields.includes(queriedField) &&
          !expandedFields.some((field) =>
            field.startsWith(`${queriedField}.`),
          ) &&
          !expandedFields.some((field) => queriedField.startsWith(`${field}.`)),
      )
    },
    hasOtherThan(fields: Fields) {
      return this.getOtherThan(fields).length > 0
    },
    assertAll(fields: Fields) {
      const expandedFields = expandFields(fields)
      if (
        !expandedFields.every((expandedField) =>
          queriedFields.includes(expandedField),
        )
      ) {
        unauthorized(
          `query fields ${new Intl.ListFormat('en').format(expandedFields)} are mandatory`,
        )
      }
    },
    assertOnly(fields: Fields) {
      const forbiddenFields = this.getOtherThan(fields)
      if (forbiddenFields.length > 0) {
        unauthorized(
          `not allowed to access ${new Intl.ListFormat('en').format(forbiddenFields)}`,
        )
      }
    },
    hasAny(fields: Array<string>) {
      return fields.some((field) => queriedFields.includes(field))
    },
    has(field: string) {
      return queriedFields.includes(field)
    },
  }
}

export type QueriedFields = ReturnType<typeof getQueriedFields>
