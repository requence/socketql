function stringifyValue(value: any): string {
  if (value === null) {
    throw new Error('cannot stringify null')
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value.filter((v) => v !== null).map(stringifyValue))
  }

  if (typeof value === 'object') {
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(value)
          .filter(([, subValue]) => subValue !== null)
          .toSorted(([keyA], [keyB]) => keyA.localeCompare(keyB))
          .map(([key, subValue]) => [key, stringifyValue(subValue)]),
      ),
    )
  }

  return value
}

export default function buildLiveIdentifier(
  path: string | Array<string>,
  args: Record<string, any>,
) {
  const segments = Array.isArray(path) ? path : [path]
  return `${segments.join('.')}(${stringifyValue(args)})`
}
