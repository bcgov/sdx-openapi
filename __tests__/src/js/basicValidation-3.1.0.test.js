const fs = require('fs');
const path = require('path');

const { Spectral, DiagnosticSeverity } = require('@stoplight/spectral-core');
const { Document } = require('@stoplight/spectral-core');
const Parsers = require('@stoplight/spectral-parsers');
const { bundleAndLoadRuleset } = require('@stoplight/spectral-ruleset-bundler/with-loader');
const { fetch } = require('@stoplight/spectral-runtime');

global.fail = (message) => { throw new Error(message ?? 'fail() was called'); };

const Severity = {
  Error: 0,
  Warning: 1,
  Info: 2,
  Hint: 3,
};

describe('Spectral Validation Rules', () => {
  let spectral;

  beforeAll(async () => {
    const rulesetFile = path.join(__dirname, '..', '..',  '..', 'spectral', 'basic-ruleset.yaml');
    const ruleset = await bundleAndLoadRuleset(rulesetFile, { fs, fetch });
    spectral = new Spectral();
    await spectral.setRuleset(ruleset);
  });

  test('should fail validation for OpenAPI 3.1.0', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '3.1.0', 'invalid.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [
      ['duplicated-entry-in-enum', Severity.Error, '"enum" property must not have duplicate items (items ## 0 and 1 are identical)', '/components/schemas/DupeEnum/enum'],
      ['oas3-examples-value-or-externalValue', Severity.Error, 'Examples must have either "value" or "externalValue" field.', '/paths/~1both-example/get/responses/200/content/application~1json/examples/ex1'],
      ['oas3-operation-security-defined', Severity.Error, 'Operation "security" values must match a scheme defined in the "components.securitySchemes" object.', '/paths/~1invalid-security/get/security/0/fake'],
      ['oas3-schema', Severity.Error, '"200" property must have required property "description".', '/paths/~1invalid-media-ex/get/responses/200'],
      ['oas3-schema', Severity.Error, '"200" property must have required property "description".', '/paths/~1both-example/get/responses/200'],
      ['oas3-schema', Severity.Error, '"ex1" property must not be valid.', '/paths/~1both-example/get/responses/200/content/application~1json/examples/ex1'],
      ['oas3-schema', Severity.Error, '"info" property must not have unevaluated properties.', '/info'],
      ['oas3-schema', Severity.Error, '"var" property must have required property "default".', '/servers/1/variables/var'],
      ['operation-operationId-unique', Severity.Error, 'Every operation must have unique "operationId".', '/paths/~1sameId2/get/operationId'],
      ['operation-operationId-valid-in-url', Severity.Error, 'operationId must not characters that are invalid when used in URL.', '/paths/~1invalidId/get/operationId'],
      ['operation-parameters', Severity.Error, 'A parameter in this operation already exposes the same combination of "name" and "in" values.', '/paths/~1duplicate-params/get/parameters/1'],
      ['path-declarations-must-exist', Severity.Error, 'Path parameter declarations must not be empty, ex."/given/{}" is invalid.', '/paths/~1path~1{}'],
      ['path-not-include-query', Severity.Error, 'Path must not include query string.', '/paths/~1path?query=value'],
      ['path-params', Severity.Error, 'Operation must define parameter "{id}" as expected by path "/path/{id}".', '/paths/~1path~1{id}/get'],
      ['path-params', Severity.Error, 'Parameter "unused-id" must be used in path "/path/unused".', '/paths/~1path~1unused/get/parameters/0'],
      ['typed-enum', Severity.Error, 'Enum value "string" must be "number".', '/components/schemas/TypedEnum/enum/0'],
      ['array-items', Severity.Warning, 'Schemas with "type: array", require a sibling "items" field', '/components/schemas/ArrayNoItems'],
      ['info-description', Severity.Warning, 'Info "description" must be present and non-empty string.', '/info/description'],
      ['no-eval-in-markdown', Severity.Warning, 'Markdown descriptions must not have "eval(".', '/paths/~1eval-md/get/description'],
      ['no-script-tags-in-markdown', Severity.Warning, 'Markdown descriptions must not have "<script>" tags.', '/paths/~1script-md/get/description'],
      ['oas3_1-callbacks-in-webhook', Severity.Warning, 'Callbacks should not be defined in a webhook.', '/webhooks/webhook1/post/callbacks'],
      ['oas3_1-servers-in-webhook', Severity.Warning, 'Servers should not be defined in a webhook.', '/webhooks/webhook2/post/servers'],
      ['oas3-callbacks-in-callbacks', Severity.Warning, 'Callbacks should not be defined within a callback', '/paths/~1nested-cb/get/callbacks/cb1/{$request.body#~1cb}/post/callbacks'],
      ['oas3-server-not-example.com', Severity.Warning, 'Server URL must not point at example.com.', '/servers/0/url'],
      ['oas3-server-trailing-slash', Severity.Warning, 'Server URL must not have trailing slash.', '/servers/0/url'],
      ['oas3-server-variables', Severity.Warning, 'Server Variable "var" has a missing default.', '/servers/1/variables/var'],
      ['oas3-server-variables', Severity.Warning, 'Server\'s "variables" object has unused defined "unused" url variable.', '/servers/1/variables/unused'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/User'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/DupeEnum'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/TypedEnum'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/ArrayNoItems'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/InvalidSchemaEx'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/RefSibling'],
      ['oas3-valid-media-example', Severity.Warning, '"example" property type must be number', '/paths/~1invalid-media-ex/get/responses/200/content/application~1json/example'],
      ['oas3-valid-schema-example', Severity.Warning, '"example" property type must be number', '/components/schemas/InvalidSchemaEx/example'],
      ['openapi-tags-alphabetical', Severity.Warning, 'OpenAPI object must have alphabetical "tags".', '/tags'],
      ['openapi-tags-uniqueness', Severity.Warning, '"tags" object contains duplicate tag name "dup".', '/tags/3/name'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1path?query=value/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1path~1{}/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1path~1trailing~1/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1path~1{id}/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1path~1unused/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1duplicate-params/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1no-description/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1no-operationId/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1no-success/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1sameId1/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1sameId2/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1invalidId/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1nested-cb/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1invalid-security/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1invalid-media-ex/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1both-example/get'],
      ['operation-id-camel-case', Severity.Warning, 'operationId should be camelCase (starts with lowercase letter, no separators)', '/paths/~1invalidId/get/operationId'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1path?query=value/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1path~1{}/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1path~1trailing~1/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1path~1{id}/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1path~1unused/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1duplicate-params/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1no-description/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1no-operationId/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1no-success/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1eval-md/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1script-md/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1nested-cb/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1invalid-security/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1invalid-media-ex/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1both-example/get'],
      ['operation-success-response', Severity.Warning, 'Operation must have at least one "2xx" or "3xx" response.', '/paths/~1no-success/get/responses'],
      ['path-keys-no-trailing-slash', Severity.Warning, 'Path must not end with slash.', '/paths/~1path~1trailing~1'],
      ['path-param-camel-case', Severity.Warning, 'Path parameter names should be camelCase', '/paths/~1path~1unused/get/parameters/0/name'],
      ['path-segments-kebab-case', Severity.Warning, 'Static path segments should be kebab-case (lowercase letters, numbers, hyphens only)', '/paths/~1no-operationId'],
      ['path-segments-kebab-case', Severity.Warning, 'Static path segments should be kebab-case (lowercase letters, numbers, hyphens only)', '/paths/~1sameId1'],
      ['path-segments-kebab-case', Severity.Warning, 'Static path segments should be kebab-case (lowercase letters, numbers, hyphens only)', '/paths/~1sameId2'],
      ['path-segments-kebab-case', Severity.Warning, 'Static path segments should be kebab-case (lowercase letters, numbers, hyphens only)', '/paths/~1invalidId'],
      ['query-param-camel-case', Severity.Warning, 'Query parameter names should be camelCase', '/paths/~1duplicate-params/get/parameters/2/name'],
      ['schema-property-camel-case', Severity.Warning, 'Schema property names in request/response bodies should be camelCase', '/components/schemas/User/properties/user-name'],
    ];

    logActualResults(results);

    expect(results).toHaveLength(expectedResults.length);

    for (const expectedResult of expectedResults) {
      
      const result = results.find(r => r.code === expectedResult[0] && r.message === expectedResult[2] && (expectedResult.length < 4 || expectedResult[3] == yamlPathToString(r.path)));
      if (result) {
        expect(getSeverityName(result.severity)).toBe(getSeverityName(expectedResult[1]));
      } else {

        fail("Expected to find result: code: " + expectedResult[0] + " msg: '" + expectedResult[2] + "' path: '" + expectedResult[3] + "'");
      }
    }
  });

  test('should warn validation for OpenAPI 3.1.0', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '3.1.0', 'warnings.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [
      // The oas3-schema rule duplicates some of the other rules which results in some errors being reported as both errors and warnings
      ['oas3-schema', Severity.Error, '"200" property must have required property "description".', '/paths/~1invalid-media-ex/get/responses/200'],
      ['oas3-schema', Severity.Error, '"200" property must have required property "description".', '/paths/~1valid-example/get/responses/200'],
      ['array-items', Severity.Warning, 'Schemas with "type: array", require a sibling "items" field', '/components/schemas/ArrayNoItems'],
      ['info-description', Severity.Warning, 'Info "description" must be present and non-empty string.', '/info/description'],
      ['no-eval-in-markdown', Severity.Warning, 'Markdown descriptions must not have "eval(".', '/paths/~1eval-md/get/description'],
      ['no-script-tags-in-markdown', Severity.Warning, 'Markdown descriptions must not have "<script>" tags.', '/paths/~1script-md/get/description'],
      ['oas3_1-callbacks-in-webhook', Severity.Warning, 'Callbacks should not be defined in a webhook.', '/webhooks/webhook1/post/callbacks'],
      ['oas3_1-servers-in-webhook', Severity.Warning, 'Servers should not be defined in a webhook.', '/webhooks/webhook2/post/servers'],
      ['oas3-callbacks-in-callbacks', Severity.Warning, 'Callbacks should not be defined within a callback', '/paths/~1nested-cb/get/callbacks/cb1/{$request.body#~1cb}/post/callbacks'],
      ['oas3-server-not-example.com', Severity.Warning, 'Server URL must not point at example.com.', '/servers/0/url'],
      ['oas3-server-trailing-slash', Severity.Warning, 'Server URL must not have trailing slash.', '/servers/0/url'],
      ['oas3-server-variables', Severity.Warning, 'Server\'s "variables" object has unused defined "unused" url variable.', '/servers/1/variables/unused'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/UniqueEnum'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/TypedEnum'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/ArrayNoItems'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/InvalidSchemaEx'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/RefSibling'],
      ['oas3-valid-media-example', Severity.Warning, '"example" property type must be number', '/paths/~1invalid-media-ex/get/responses/200/content/application~1json/example'],
      ['oas3-valid-schema-example', Severity.Warning, '"example" property type must be number', '/components/schemas/InvalidSchemaEx/example'],
      ['openapi-tags-alphabetical', Severity.Warning, 'OpenAPI object must have alphabetical "tags".', '/tags'],
      ['openapi-tags-uniqueness', Severity.Warning, '"tags" object contains duplicate tag name "dup".', '/tags/3/name'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1path/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1path~1{id}/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1path~1trailing~1/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1path~1{id}~1fixed/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1path~1fixed-unused/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1unique-params/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1no-description/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1no-operationId/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1no-success/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1sameId1/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1sameId2/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1validId/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1nested-cb/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1valid-security/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1invalid-media-ex/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1valid-example/get'],
      ['operation-id-camel-case', Severity.Warning, 'operationId should be camelCase (starts with lowercase letter, no separators)', '/paths/~1validId/get/operationId'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1path/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1path~1{id}/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1path~1trailing~1/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1path~1{id}~1fixed/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1path~1fixed-unused/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1unique-params/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1no-description/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1no-operationId/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1no-success/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1eval-md/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1script-md/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1nested-cb/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1valid-security/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1invalid-media-ex/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1valid-example/get'],
      ['operation-success-response', Severity.Warning, 'Operation must have at least one "2xx" or "3xx" response.', '/paths/~1no-success/get/responses'],
      ['path-keys-no-trailing-slash', Severity.Warning, 'Path must not end with slash.', '/paths/~1path~1trailing~1'],
      ['path-segments-kebab-case', Severity.Warning, 'Static path segments should be kebab-case (lowercase letters, numbers, hyphens only)', '/paths/~1no-operationId'],
      ['path-segments-kebab-case', Severity.Warning, 'Static path segments should be kebab-case (lowercase letters, numbers, hyphens only)', '/paths/~1sameId1'],
      ['path-segments-kebab-case', Severity.Warning, 'Static path segments should be kebab-case (lowercase letters, numbers, hyphens only)', '/paths/~1sameId2'],
      ['path-segments-kebab-case', Severity.Warning, 'Static path segments should be kebab-case (lowercase letters, numbers, hyphens only)', '/paths/~1validId'],
    ];

    logActualResults(results);

    expect(results).toHaveLength(expectedResults.length);

    for (const expectedResult of expectedResults) {
      
      const result = results.find(r => r.code === expectedResult[0] && r.message === expectedResult[2] && (expectedResult.length < 4 || expectedResult[3] == yamlPathToString(r.path)));
      if (result) {
        expect(getSeverityName(result.severity)).toBe(getSeverityName(expectedResult[1]));
      } else {

        fail("Expected to find result: code: " + expectedResult[0] + " msg: '" + expectedResult[2] + "' path: '" + expectedResult[3] + "'");
      }
    }
  });

  test('should pass validation with unused warnings for OpenAPI 3.1.0', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '3.1.0', 'valid.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/User'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/responses/UniqueEnumResponse'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/responses/TypedEnumResponse'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/responses/ArrayResponse'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/responses/InvalidSchemaExResponse'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/responses/RefSiblingResponse'],
    ];

    logActualResults(results);

    expect(results).toHaveLength(expectedResults.length);

    for (const expectedResult of expectedResults) {
      
      const result = results.find(r => r.code === expectedResult[0] && r.message === expectedResult[2] && (expectedResult.length < 4 || expectedResult[3] == yamlPathToString(r.path)));
      if (result) {
        expect(getSeverityName(result.severity)).toBe(getSeverityName(expectedResult[1]));
      } else {

        fail("Expected to find result: code: " + expectedResult[0] + " msg: '" + expectedResult[2] + "' path: '" + expectedResult[3] + "'");
      }
    }
  });

  test('should pass validation with unused ignored for OpenAPI 3.1.0', async () => {

    // An OAS project can use a local ruleset file to extend the published ruleset and ignore rules for specific components
    // This could be useful to ignore 'unused' warnings for components that are referenced externally.
    const rulesetFile = path.join(__dirname, '..', 'resources', 'basic', '3.1.0', 'override-ruleset.yaml');
    const ruleset = await bundleAndLoadRuleset(rulesetFile, { fs, fetch });
    const spectralOverride = new Spectral();
    await spectralOverride.setRuleset(ruleset);

    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '3.1.0', 'valid.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectralOverride.run(document);

    const expectedResults = [
    ];

    logActualResults(results);

    expect(results).toHaveLength(expectedResults.length);

    for (const expectedResult of expectedResults) {
      
      const result = results.find(r => r.code === expectedResult[0] && r.message === expectedResult[2] && (expectedResult.length < 4 || expectedResult[3] == yamlPathToString(r.path)));
      if (result) {
        expect(getSeverityName(result.severity)).toBe(getSeverityName(expectedResult[1]));
      } else {

        fail("Expected to find result: code: " + expectedResult[0] + " msg: '" + expectedResult[2] + "' path: '" + expectedResult[3] + "'");
      }
    }
  });
  
  function getSeverityName(value) {
    return Object.keys(Severity).find(key => Severity[key] === value) ?? 'Unknown';
  }

  function yamlPathToString(pathArray) {
    if (!pathArray || pathArray.length === 0) return "<root>";

    return (
      "/" +
      pathArray
        .map(segment =>
          String(segment)
            .replace(/~/g, "~0")
            .replace(/\//g, "~1")
        )
        .join("/")
    );
  }

  function logActualResults(results) {

    results.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity - b.severity;
      }
      if (a.code !== b.code) {
        return a.code.localeCompare(b.code);
      }
      return a.message.localeCompare(b.message); 
    });

    let actualResults = expect.getState().currentTestName + "\nconst actualResults = [\n";
    for (const result of results) {

      const message = result.message
        .replace(/\\/g, '\\\\')   // escape backslashes first
        .replace(/'/g, "\\'")     // escape single quotes
        .replace(/\n/g, '\\n')    // optional: escape newlines
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\f/g, '\\f')
        .replace(/\v/g, '\\v')
        .replace(/\0/g, '\\0');

      actualResults += "  ['" + result.code + "', Severity."+getSeverityName(result.severity)+", '" + message + "', '" + yamlPathToString(result.path) + "'],\n";
    }
    actualResults += "];"
    console.debug(actualResults);
  }
});