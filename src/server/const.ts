export const liveContextSymbol = Symbol('liveContext')

export const liveQueryIdentifierDirectiveSDL =
  /* GraphQL */ 'directive @liveIdentifier(pick: [String!]) on ARGUMENT_DEFINITION'

export const uploadInputSDL = /* GraphQL */ `
  scalar Buffer

  input Upload {
    name: String!
    type: String!
    size: Int!
    lastModified: Int!
    buffer: Buffer!
  }
`
