import { type DocumentNode, Kind } from 'graphql'

export default function getDocumentIdentifier(doc: DocumentNode) {
  const def = doc.definitions.find(
    (def) => def.kind === Kind.OPERATION_DEFINITION,
  )

  return def?.name?.value
}
