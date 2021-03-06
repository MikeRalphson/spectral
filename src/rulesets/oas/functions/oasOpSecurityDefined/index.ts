import { ObjPath } from '@stoplight/types';

const _get = require('lodash/get');

import { IFunction, IFunctionResult } from '../../../../types';

export type functionName = 'oasOpSecurityDefined';

export const oasOpSecurityDefined: IFunction<{
  schemesPath: ObjPath;
}> = (targetVal, options) => {
  const results: IFunctionResult[] = [];

  const { schemesPath } = options;

  const { paths = {} } = targetVal;
  const schemes = _get(targetVal, schemesPath) || {};
  const allDefs = Object.keys(schemes);

  for (const path in paths) {
    if (Object.keys(paths[path]).length > 0)
      for (const operation in paths[path]) {
        if (operation !== 'parameters') {
          const { security = [] } = paths[path][operation];

          for (const index in security) {
            if (security[index]) {
              const securityKey = Object.keys(security[index])[0];

              if (!allDefs.includes(securityKey)) {
                results.push({
                  message: 'operation referencing undefined security scheme',
                  path: ['paths', path, operation, 'security', index],
                });
              }
            }
          }
        }
      }
  }

  return results;
};
