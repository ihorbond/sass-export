interface IOptions {
  inputFiles?: any,
  includePaths?: string[],
  format?: string,
  type?: string,
  detailed: boolean;
}

interface IDeclaration {
  name: string,
  value: string,
  mapValue?: Array<any>,
  compiledValue: string,
  compiledValueAsJson?: string
}