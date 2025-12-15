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

  test('should fail validation for OpenAPI 3.0.3', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '3.0.3', 'invalid.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [
      ['duplicated-entry-in-enum', Severity.Error, '"enum" property must not have duplicate items (items ## 0 and 2 are identical)', '/paths/~1enum/post/requestBody/content/application~1json/schema/enum'],
      ['no-$ref-siblings', Severity.Error, '$ref must not be placed next to any other properties', '/paths/~1ref-siblings/get/responses/200/content/application~1json/schema/type'],
      ['no-$ref-siblings', Severity.Error, '$ref must not be placed next to any other properties', '/paths/~1ref-siblings/get/responses/200/content/application~1json/schema/description'],
      ['oas3-examples-value-or-externalValue', Severity.Error, 'Examples must have either "value" or "externalValue" field.', '/paths/~1both-example-fields/get/responses/200/content/application~1json/examples/bad'],
      ['oas3-operation-security-defined', Severity.Error, 'Operation "security" values must match a scheme defined in the "components.securitySchemes" object.', '/paths/~1security/get/security/0/noScheme'],
      ['oas3-schema', Severity.Error, '"200" property must have required property "description".', '/paths/~1ref-siblings/get/responses/200'],
      ['oas3-schema', Severity.Error, '"200" property must have required property "description".', '/paths/~1both-example-fields/get/responses/200'],
      ['oas3-schema', Severity.Error, '"200" property must have required property "description".', '/paths/~1invalidExamples/get/responses/200'],
      ['oas3-schema', Severity.Error, '"default" property must be string.', '/servers/1/variables/bad/default'],
      ['oas3-schema', Severity.Error, '"parameters" property must not have duplicate items (items ## 0 and 1 are identical).', '/paths/~1dup-param/get/parameters'],
      ['oas3-schema', Severity.Error, '"tags" property must not have duplicate items (items ## 2 and 3 are identical).', '/tags'],
      ['oas3-schema', Severity.Error, 'Property "bogus" is not expected to be here.', '/info/bogus'],
      ['operation-operationId-unique', Severity.Error, 'Every operation must have unique "operationId".', '/paths/~1query?q/get/operationId'],
      ['operation-operationId-unique', Severity.Error, 'Every operation must have unique "operationId".', '/paths/~1{}~1/get/operationId'],
      ['operation-operationId-unique', Severity.Error, 'Every operation must have unique "operationId".', '/paths/~1path~1{usedButNotDeclared}/get/operationId'],
      ['operation-operationId-unique', Severity.Error, 'Every operation must have unique "operationId".', '/paths/~1dup-opid/post/operationId'],
      ['operation-operationId-unique', Severity.Error, 'Every operation must have unique "operationId".', '/paths/~1ref-siblings/get/operationId'],
      ['operation-operationId-valid-in-url', Severity.Error, 'operationId must not characters that are invalid when used in URL.', '/paths/~1bad-opid/get/operationId'],
      ['operation-parameters', Severity.Error, 'A parameter in this operation already exposes the same combination of "name" and "in" values.', '/paths/~1dup-param/get/parameters/1'],
      ['path-declarations-must-exist', Severity.Error, 'Path parameter declarations must not be empty, ex."/given/{}" is invalid.', '/paths/~1{}~1'],
      ['path-not-include-query', Severity.Error, 'Path must not include query string.', '/paths/~1query?q'],
      ['path-params', Severity.Error, 'Operation must define parameter "{usedButNotDeclared}" as expected by path "/path/{usedButNotDeclared}".', '/paths/~1path~1{usedButNotDeclared}/get'],
      ['path-params', Severity.Error, 'Parameter "declared-but-unused" must be used in path "/path/{usedButNotDeclared}".', '/paths/~1path~1{usedButNotDeclared}/parameters/0'],
      ['typed-enum', Severity.Error, 'Enum value 123 must be "string".', '/paths/~1enum/post/requestBody/content/application~1json/schema/enum/3'],
      ['array-items', Severity.Warning, 'Schemas with "type: array", require a sibling "items" field', '/components/schemas/ArrayNoItems'],
      ['info-description', Severity.Warning, 'Info "description" must be present and non-empty string.', '/info/description'],
      ['no-eval-in-markdown', Severity.Warning, 'Markdown descriptions must not have "eval(".', '/paths/~1markdown/get/description'],
      ['no-script-tags-in-markdown', Severity.Warning, 'Markdown descriptions must not have "<script>" tags.', '/paths/~1markdown/get/description'],
      ['oas3-callbacks-in-callbacks', Severity.Warning, 'Callbacks should not be defined within a callback', '/paths/~1nested-callbacks/post/callbacks/outer/{$request.body#~1url}/post/callbacks'],
      ['oas3-server-not-example.com', Severity.Warning, 'Server URL must not point at example.com.', '/servers/0/url'],
      ['oas3-server-not-example.com', Severity.Warning, 'Server URL must not point at example.com.', '/servers/1/url'],
      ['oas3-server-trailing-slash', Severity.Warning, 'Server URL must not have trailing slash.', '/servers/0/url'],
      ['oas3-server-variables', Severity.Warning, 'Invalid Server Object', '/servers/1'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/ArrayNoItems'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/Unused1'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/Unused2'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/examples/UnusedExample'],
      ['oas3-valid-media-example', Severity.Warning, '"value" property type must be number', '/paths/~1invalidExamples/get/responses/200/content/application~1json/examples/badMedia/value'],
      ['oas3-valid-schema-example', Severity.Warning, '"example" property type must be number', '/components/schemas/Price/example'],
      ['openapi-tags-alphabetical', Severity.Warning, 'OpenAPI object must have alphabetical "tags".', '/tags'],
      ['openapi-tags-uniqueness', Severity.Warning, '"tags" object contains duplicate tag name "Apple".', '/tags/3/name'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1trailing~1/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1query?q/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1{}~1/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1path~1{usedButNotDeclared}/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1dup-opid/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1dup-opid/post'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1bad-opid/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1no-meta/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1ref-siblings/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1enum/post'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1dup-param/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1both-example-fields/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1security/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1nested-callbacks/post'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1invalidExamples/get'],
      ['operation-id-camel-case', Severity.Warning, 'operationId should be camelCase (starts with lowercase letter, no separators)', '/paths/~1bad-opid/get/operationId'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1no-meta/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1markdown/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1enum/post'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1dup-param/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1both-example-fields/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1security/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1nested-callbacks/post'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1invalidExamples/get'],
      ['operation-success-response', Severity.Warning, 'Operation must have at least one "2xx" or "3xx" response.', '/paths/~1no-meta/get/responses'],
      ['path-keys-no-trailing-slash', Severity.Warning, 'Path must not end with slash.', '/paths/~1trailing~1'],
      ['path-keys-no-trailing-slash', Severity.Warning, 'Path must not end with slash.', '/paths/~1{}~1'],
      ['path-param-camel-case', Severity.Warning, 'Path parameter names should be camelCase', '/paths/~1path~1{usedButNotDeclared}/parameters/0/name'],
      ['path-segments-kebab-case', Severity.Warning, 'Static path segments should be kebab-case (lowercase letters, numbers, hyphens only)', '/paths/~1invalidExamples'],
      ['query-param-camel-case', Severity.Warning, 'Query parameter names should be camelCase', '/paths/~1dup-param/get/parameters/2/name'],
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

  test('should warn validation for OpenAPI 3.0.3', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '3.0.3', 'warnings.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [
      // The oas3-schema rule duplicates some of the other rules which results in some errors being reported as both errors and warnings
      ['oas3-schema', Severity.Error, '"200" property must have required property "description".', '/paths/~1examples/get/responses/200'],
      ['oas3-schema', Severity.Error, '"200" property must have required property "description".', '/paths/~1array/get/responses/200'],
      ['oas3-schema', Severity.Error, '"application~1json" property must not be valid.', '/paths/~1examples/get/responses/200/content/application~1json'],
      ['oas3-schema', Severity.Error, '"default" property must be string.', '/servers/1/variables/badDefault/default'],
      ['oas3-schema', Severity.Error, '"tags" property must not have duplicate items (items ## 2 and 3 are identical).', '/tags'],
      ['array-items', Severity.Warning, 'Schemas with "type: array", require a sibling "items" field', '/components/schemas/ArrayNoItems'],
      ['info-description', Severity.Warning, 'Info "description" must be present and non-empty string.', '/info/description'],
      ['no-eval-in-markdown', Severity.Warning, 'Markdown descriptions must not have "eval(".', '/paths/~1markdown/get/description'],
      ['no-script-tags-in-markdown', Severity.Warning, 'Markdown descriptions must not have "<script>" tags.', '/paths/~1markdown/get/description'],
      ['oas3-callbacks-in-callbacks', Severity.Warning, 'Callbacks should not be defined within a callback', '/paths/~1nested-callbacks/post/callbacks/outer/{$request.body#~1url}/post/callbacks'],
      ['oas3-server-not-example.com', Severity.Warning, 'Server URL must not point at example.com.', '/servers/0/url'],
      ['oas3-server-not-example.com', Severity.Warning, 'Server URL must not point at example.com.', '/servers/1/url'],
      ['oas3-server-trailing-slash', Severity.Warning, 'Server URL must not have trailing slash.', '/servers/0/url'],
      ['oas3-server-variables', Severity.Warning, 'Invalid Server Object', '/servers/1'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/UnusedSchema1'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/schemas/UnusedSchema2'],
      ['oas3-unused-component', Severity.Warning, 'Potentially unused component has been detected.', '/components/examples/StandaloneUnusedExample'],
      ['oas3-valid-media-example', Severity.Warning, '"example" property type must be number', '/paths/~1examples/get/responses/200/content/application~1json/example'],
      ['oas3-valid-schema-example', Severity.Warning, '"example" property type must be number', '/components/schemas/Price/example'],
      ['openapi-tags-alphabetical', Severity.Warning, 'OpenAPI object must have alphabetical "tags".', '/tags'],
      ['openapi-tags-uniqueness', Severity.Warning, '"tags" object contains duplicate tag name "Apple".', '/tags/3/name'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1trailing~1/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1users~1{userId}/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1status/post'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1no-meta/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1examples/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1nested-callbacks/post'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1array/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1no-meta/get'],
      ['operation-success-response', Severity.Warning, 'Operation must have at least one "2xx" or "3xx" response.', '/paths/~1no-meta/get/responses'],
      ['path-keys-no-trailing-slash', Severity.Warning, 'Path must not end with slash.', '/paths/~1trailing~1'],
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

  test('should pass validation for OpenAPI 3.0.3', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '3.0.3', 'valid.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [];

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