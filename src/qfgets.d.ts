declare module 'qfgets' {
  type Options = {
    bufferSize?: number
  }

  class Fgets {
    public constructor(filename: string, options?: Options)
    public constructor(reader: Fgets.FileReader)
    public fgets(): string
    public feof(): boolean
    public processLines ( visitor: (line: string, cb: any) => void,
                          callback: (status: any, count: number) => void
                        ): void
  }

  namespace Fgets {
    class FileReader {
      public constructor(filename: string, options?: Options)
    }
  }
}
