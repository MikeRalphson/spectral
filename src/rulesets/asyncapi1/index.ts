const merge = require('lodash/merge');

import { ValidationSeverity } from '@stoplight/types/validations';
import { RuleFunction, RuleType } from '../../types';
import * as schema from './schemas/main.json';

export const asyncAPI1Rules = () => {
  return merge({}, {
    // specification validation
    'asyncapi1-schema': {
      summary: 'Validate structure of AsyncAPIv1 specification.',
      type: RuleType.VALIDATION,
      severity: ValidationSeverity.Error,
      then: {
        function: RuleFunction.SCHEMA,
        functionOptions: {
          schema,
        },
      },
      tags: ['schema'],
    },

    // generic rules
    'api-servers': {
      summary: 'AsyncAPI `servers` must be present and non-empty array.',
      type: RuleType.STYLE,
      given: '$',
      then: {
        field: 'servers',
        function: RuleFunction.SCHEMA,
        functionOptions: {
          schema: {
            items: {
              type: 'object',
            },
            minItems: 1,
            type: 'array',
          },
        },
      },
      tags: ['api'],
    },
    'model-description': {
      enabled: false,
      summary: 'Model `description` must be present and non-empty string.',
      type: RuleType.STYLE,
      given: '$.components.schemas[*]',
      then: {
        field: 'description',
        function: RuleFunction.TRUTHY,
      },
    },
    'server-not-example.com': {
      enabled: false,
      summary: 'Server URL should not point at `example.com`.',
      type: RuleType.STYLE,
      given: '$.servers[*]',
      then: {
        field: 'url',
        function: RuleFunction.PATTERN,
        functionOptions: {
          notMatch: 'example.com',
        },
      },
    },
    'server-trailing-slash': {
      summary: 'Server URL should not have a trailing slash.',
      type: RuleType.STYLE,
      given: '$.servers[*]',
      then: {
        field: 'url',
        function: RuleFunction.PATTERN,
        functionOptions: {
          notMatch: '/$',
        },
      },
    },
  });
};

// topic keys MUST NOT start with a dot
// schema properties MUST NOT be both readOnly and writeOnly
// top level tag names MUST be unique (check schema)
// server variable, one of default, enum, description is mandatory
