/** Imported `with { type: 'file' }`: the file's path, inside the executable when compiled. */
declare module '*.cfg' {
  const path: string
  export default path
}

declare module '*.ini' {
  const path: string
  export default path
}
