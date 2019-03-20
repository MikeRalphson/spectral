import { Command, flags as flagHelpers } from '@oclif/command';
import { ValidationSeverity } from '@stoplight/types';
import { parseWithPointers } from '@stoplight/yaml';
import { existsSync, readFile } from 'fs';
import { inspect, promisify } from 'util';
import { IRuleResult } from '../../types/spectral';

// @ts-ignore
import * as fetch from 'node-fetch';

import { oas2Functions, oas2Rules } from '../../rulesets/oas2';
import { oas3Functions, oas3Rules } from '../../rulesets/oas3';
import { Spectral } from '../../spectral';

const Formatter = class {
  private results: IRuleResult[];

  constructor(results: IRuleResult[]) {
    this.results = results;
  }
  // in Formatter classes we use console.warn not command.warn to omit
  // the confusing 'Warning' prefix for non-warning results
};

const DefaultFormatter = class extends Formatter {
  private pathToJsonPointer(path: Array<string | number>) {
    let result = '#';
    for (const component of path) {
      result +=
        '/' +
        component
          .toString()
          .split('~')
          .join('~0')
          .split('/')
          .join('~1');
    }
    return result;
  }

  private format(issue: IRuleResult) {
    const filtered = { message: issue.message, summary: issue.summary, pointer: this.pathToJsonPointer(issue.path) };
    return issue.severityLabel + ': ' + inspect(filtered, { depth: null, colors: true, compact: false });
  }

  public warn() {
    const errors = this.results.filter(e => e.severity === ValidationSeverity.Error);
    const warnings = this.results.filter(e => e.severity === ValidationSeverity.Warn);
    const info = this.results.filter(e => e.severity === ValidationSeverity.Info);
    if (errors.length) {
      console.warn(`Errors found: ${errors.length}`);
      for (const issue of errors) {
        console.warn(this.format(issue));
      }
    }
    if (warnings.length) {
      console.warn(`Warnings found: ${warnings.length}`);
      for (const issue of warnings) {
        console.warn(this.format(issue));
      }
    }
    if (info.length) {
      console.warn(`Informational messages: ${info.length}`);
      for (const issue of info) {
        console.warn(this.format(issue));
      }
    }
  }
};

const JsonFormatter = class extends Formatter {
  public toString() {
    return JSON.stringify(this.results, null, 2);
  }

  public warn() {
    console.warn(this.toString());
  }
};

export default class Lint extends Command {
  public static description = 'lint a JSON/YAML document from a file or URL';

  public static examples = [
    `$ spectral lint .openapi.yaml
linting ./openapi.yaml
`,
  ];

  public static flags = {
    help: flagHelpers.help({ char: 'h' }),
    encoding: flagHelpers.string({
      char: 'e',
      default: 'utf8',
      description: 'text encoding to use',
    }),
    format: flagHelpers.string({
      char: 'f',
      default: 'default',
      description: 'output format to use',
      options: ['default', 'json'],
    }),
    maxResults: flagHelpers.integer({
      char: 'm',
      description: '[default: all] maximum results to show',
    }),
    verbose: flagHelpers.boolean({
      char: 'v',
      description: 'increase verbosity',
    }),
  };

  public static args = [{ name: 'source' }];

  public async run() {
    const { args, flags } = this.parse(Lint);

    if (args.source) {
      try {
        await lint(args.source, flags, this);
      } catch (ex) {
        this.error(ex.message);
      }
    } else {
      this.error('You must specify a document to lint');
    }
  }
}

async function lint(name: string, flags: any, command: Lint) {
  command.log(`linting ${name}`);

  let text: string;
  let obj: any;

  if (name.startsWith('http')) {
    const res = await fetch(name);
    text = await res.text();
  } else if (existsSync(name)) {
    const readFileAsync = promisify<(path: string, encoding: string) => Promise<string>>(readFile);

    try {
      text = await readFileAsync(name, flags.encoding);
    } catch (ex) {
      throw new Error(`Could not read ${name}: ${ex.message}`);
    }
  } else {
    throw new Error(`${name} does not exist`);
  }

  try {
    obj = parseWithPointers(text);
  } catch (ex) {
    throw new Error(`Could not parse ${name}: ${ex.message}`);
  }

  const spectral = new Spectral();
  if (obj.data.swagger && obj.data.swagger === '2.0') {
    command.log('Swagger/OpenAPI 2.0 detected');
    spectral.addFunctions(oas2Functions());
    spectral.addRules(oas2Rules());
  } else if (obj.data.openapi && typeof obj.data.openapi === 'string' && obj.data.openapi.startsWith('3.')) {
    command.log('OpenAPI 3.x detected');
    spectral.addFunctions(oas3Functions());
    spectral.addRules(oas3Rules());
  } else {
    throw new Error('Input document specification type could not be determined');
  }

  try {
    const output = spectral.run(obj.data);

    if (output.results.length === 0) {
      command.log('No errors or warnings found!');
    } else {
      process.exitCode = 1;
      const results = flags.maxResults ? output.results.slice(0, flags.maxResults) : output.results;
      const formatter = flags.format === 'json' ? new JsonFormatter(results) : new DefaultFormatter(results);
      formatter.warn();
    }
  } catch (ex) {
    process.exitCode = 2;
    throw new Error(ex);
  }
}
