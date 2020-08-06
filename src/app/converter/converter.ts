import * as fs from 'fs';
import * as sass from 'node-sass';
import * as glob from 'glob';
import { Parser, Mixins } from '../parser';
import { Utils } from '../utils';

const LINE_BREAK = '\n';

/**
 * Converter class used for receiving the files and process them
 * @param {IOptions} options options parameters
 */
export class Converter {

  constructor(public options?: IOptions) {
    this.options = options || {} as IOptions;
  }

  public getArray(): IDeclaration[] {
    let content = this.getContent();
    let parsedDeclarations = new Parser(content).parse();

    return parsedDeclarations.map((declaration) => {
      declaration.compiledValue = this.renderPropertyValue(content, declaration);
      declaration.name = `$${declaration.name}`;

      if (declaration.mapValue) {
        declaration.mapValue.map((mapDeclaration) => {
          mapDeclaration.compiledValue = this.renderPropertyValue(content, mapDeclaration);
          return mapDeclaration;
        });
      }
      return declaration;
    });
  }


  public getStructured(): any {
    return this.objectify(this.getArray(), !!this.options.detailed);
    // let content = this.getContent();
    // let structuredDeclaration = new Parser(content).parseStructured();
    // structuredDeclaration = this.compileStructure(structuredDeclaration);

    // return structuredDeclaration;
  }


  public compileStructure(structuredDeclaration: IDeclaration): object {
    const groups = Object.keys(structuredDeclaration);

    groups.forEach((group) => {
      let content = this.getContent();

      let compiledGroup = structuredDeclaration[group].map((declaration) => {
        declaration.compiledValue = this.renderPropertyValue(content, declaration);
        declaration.name = `$${declaration.name}`;

        if (declaration.mapValue) {
          declaration.mapValue.map((mapDeclaration) => {
            mapDeclaration.compiledValue = this.renderPropertyValue(content, mapDeclaration);
            return mapDeclaration;
          });
        }

        return declaration;
      });
    });

    return this.checkForMixins(structuredDeclaration);
  }


  public getContent(): string {
    return [].concat(this.options.inputFiles)
      .reduce((acc, val) => acc.concat(glob.sync(String(val))), [])
      .map(filePath => fs.readFileSync(String(filePath)))
      .join(LINE_BREAK)
      .replace(/\/\*[\w\W\r\n]*?\*\/|\/\/.*/g, '');
  }

  private checkForMixins(structuredDeclaration: object) {
    const mixinsGroup = 'mixins';
    const parsedMixins = new Mixins(this.getContent()).parse();

    if (parsedMixins && parsedMixins.length) {
      structuredDeclaration[mixinsGroup] = parsedMixins;
    }

    return structuredDeclaration;
  }


  private renderPropertyValue(content: string, declaration: IDeclaration): string {
    let wrappedRendered = ''; //if the property can't be rendered, then it should return an empty string

    try {
      const rendered = sass.renderSync({
        data: content + LINE_BREAK + Utils.wrapCss(declaration),
        includePaths: this.options.includePaths,
        outputStyle: 'compact'
      });

      wrappedRendered = Utils.unWrapValue(String(rendered.css));
    } catch (err) {
      console.error(err);
    }

    return wrappedRendered;
  }

  /**
 * Reduces an array of variables to an object
 * using the `name` as key (camel cased and without $)
 * and using either the entire object as value or just the `compiledValue` property
 * @private
 * @param {Array} array - The array to be reduced
 * @param {boolean} [detailed] - If true, the entire export is returned (name, value, compiledValue). If false, only the compiledValue will be returned, as JSON
 * @returns {Object}
 */
  private objectify(array: IDeclaration[], detailed: boolean): object {
    return array.reduce((obj, item) => {
      const name = item.name
        // camelCase the name key
        .replace(/-([a-zA-Z0-9])/g, (x, up) => up.toUpperCase())
        // remove the $
        .substr(1)
      item.compiledValueAsJson = this.parseSassValue(item.compiledValue)
      obj[name] = detailed ? item : item.compiledValueAsJson
      return obj
    }, {})
  }


  /**
  * Parses a Sass value to its corresponding JSON type (object, array, primitive)
  * @private
  * @param {*} value - The value to be parsed
  * @returns {*}
  */
  private parseSassValue(value: string): any {
    if (/^\(.+:.+\)$/.test(value)) {
      // sass map => object
      return value
        .substr(1, value.length - 2)
        .split(',')
        .map(pair => pair.split(':').map(str => str.trim()))
        .reduce((obj, item) => {
          const key = item[0].replace(/\"/g, '')
          obj[key] = item[1]
          return obj
        }, {})
    } else if (/[^a-z]\(.+, .+/.test(value)) {
      // sass list => array
      return value
        .split(',')
        .map(val => val.trim())
    } else {
      return value
    }
  }
}
