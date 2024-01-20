export type Elem<as extends Array<unknown>> = as extends Array<infer a> ? a : never

export type Config = {
  startCommand: string
  stopCommand: string
  languages: Array<{
    languageId: string
    formatCommand: string
    apiSearchUrl: string
    annotationsFiles: Array<string>
  }>
}

export namespace alloglot {
  export const root = 'alloglot' as const

  export namespace collections {
    export const annotations = `${alloglot.root}.annotations` as const
  }

  export namespace commands {
    export const apiSearch = `${alloglot.root}.apisearch` as const
    export const start = `${alloglot.root}.start` as const
    export const stop = `${alloglot.root}.stop` as const
    export const restart = `${alloglot.root}.restart` as const
  }

  export namespace config {
    export const startCommand = 'startCommand' as const
    export const stopCommand = 'stopCommand' as const
    export const languages = 'languages' as const
  }
}
