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

  test('should fail validation for Swagger 2.0 - Part 1', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '2.0', 'invalid-1.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [
      ['duplicated-entry-in-enum', Severity.Error, '"enum" property must not have duplicate items (items ## 0 and 1 are identical)', '/definitions/EnumBad/properties/current-status/enum'],
      ['invalid-ref', Severity.Error, '\'#/definitions/User\' does not exist', '/paths/~1users~1{id}/get/responses/200/schema/$ref'],
      ['no-$ref-siblings', Severity.Error, '$ref must not be placed next to any other properties', '/paths/~1users~1{id}/get/responses/200/schema/type'],
      ['oas2-anyOf', Severity.Error, '"anyOf" keyword must not be used in OpenAPI v2 document.', '/definitions/AnyOfInV2/anyOf'],
      ['oas2-oneOf', Severity.Error, '"oneOf" keyword must not be used in OpenAPI v2 document.', '/definitions/OneOfInV2/oneOf'],
      ['oas2-schema', Severity.Error, '"enum" property must not have duplicate items (items ## 0 and 1 are identical).', '/definitions/EnumBad/properties/current-status/enum'],
      ['oas2-schema', Severity.Error, '"parameters" property must not have duplicate items (items ## 1 and 2 are identical).', '/paths/~1items/parameters'],
      ['oas2-schema', Severity.Error, '"post" property must have required property "responses".', '/paths/~1users~1{user-id}/post'],
      ['oas2-schema', Severity.Error, '"tags" property must not have duplicate items (items ## 1 and 2 are identical).', '/tags'],
      ['operation-operationId-unique', Severity.Error, 'Every operation must have unique "operationId".', '/paths/~1users~1{user-id}/post/operationId'],
      ['operation-parameters', Severity.Error, 'Operation must not have both "in:body" and "in:formData" parameters.', '/paths/~1form-body-mix/post/parameters'],
      ['operation-parameters', Severity.Error, 'Operation must not have more than a single instance of the "in:body" parameter.', '/paths/~1double-body/put/parameters/1'],
      ['path-declarations-must-exist', Severity.Error, 'Path parameter declarations must not be empty, ex."/given/{}" is invalid.', '/paths/~1empty~1{}'],
      ['path-not-include-query', Severity.Error, 'Path must not include query string.', '/paths/~1search?term={term}'],
      ['path-params', Severity.Error, 'Operation must define parameter "{id}" as expected by path "/users/{id}".', '/paths/~1users~1{id}/get'],
      ['path-params', Severity.Error, 'Operation must define parameter "{term}" as expected by path "/search?term={term}".', '/paths/~1search?term={term}/get'],
      ['path-params', Severity.Error, 'Operation must define parameter "{user-id}" as expected by path "/users/{user-id}".', '/paths/~1users~1{user-id}/post'],
      ['path-params', Severity.Error, 'Parameter "unusedPath" must be used in path "/items".', '/paths/~1items/parameters/0'],
      ['path-params', Severity.Error, 'Paths "/users/{id}" and "/users/{user-id}" must not be equivalent.', '/paths/~1users~1{user-id}'],
      ['typed-enum', Severity.Error, 'Enum value "one" must be "integer".', '/definitions/EnumBad/properties/code/enum/0'],
      ['typed-enum', Severity.Error, 'Enum value "two" must be "integer".', '/definitions/EnumBad/properties/code/enum/1'],
      ['array-items', Severity.Warning, 'Schemas with "type: array", require a sibling "items" field', '/definitions/ArrayNoItems'],
      ['info-description', Severity.Warning, 'Info "description" must be present and non-empty string.', '/info'],
      ['no-eval-in-markdown', Severity.Warning, 'Markdown descriptions must not have "eval(".', '/paths/~1search?term={term}/get/description'],
      ['no-script-tags-in-markdown', Severity.Warning, 'Markdown descriptions must not have "<script>" tags.', '/paths/~1users~1{user-id}/get/description'],
      ['oas2-api-host', Severity.Warning, 'OpenAPI "host" must be present and non-empty string.', '<root>'],
      ['oas2-api-schemes', Severity.Warning, 'OpenAPI host "schemes" must be present and non-empty array.', '<root>'],
      ['oas2-discriminator', Severity.Warning, 'The discriminator property must be in the required property list.', '/definitions/DiscriminatorBad'],
      ['oas2-operation-security-defined', Severity.Warning, 'Operation "security" values must match a scheme defined in the "securityDefinitions" object.', '/paths/~1secure/get/security/0/petstore_auth'],
      ['oas2-unused-definition', Severity.Warning, 'Potentially unused definition has been detected.', '/definitions/EnumBad'],
      ['oas2-unused-definition', Severity.Warning, 'Potentially unused definition has been detected.', '/definitions/ArrayNoItems'],
      ['oas2-unused-definition', Severity.Warning, 'Potentially unused definition has been detected.', '/definitions/DiscriminatorBad'],
      ['oas2-unused-definition', Severity.Warning, 'Potentially unused definition has been detected.', '/definitions/AnyOfInV2'],
      ['oas2-unused-definition', Severity.Warning, 'Potentially unused definition has been detected.', '/definitions/OneOfInV2'],
      ['oas2-unused-definition', Severity.Warning, 'Potentially unused definition has been detected.', '/definitions/BadSchemaExample'],
      ['oas2-unused-definition', Severity.Warning, 'Potentially unused definition has been detected.', '/definitions/UnusedDefinition'],
      ['oas2-valid-media-example', Severity.Warning, '"name" property type must be string', '/paths/~1exampleMedia/get/responses/200/examples/application~1json/name'],
      ['oas2-valid-schema-example', Severity.Warning, '"name" property type must be string', '/definitions/BadSchemaExample/example/name'],
      ['openapi-tags-alphabetical', Severity.Warning, 'OpenAPI object must have alphabetical "tags".', '/tags'],
      ['openapi-tags-uniqueness', Severity.Warning, '"tags" object contains duplicate tag name "alpha".', '/tags/2/name'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1users~1/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1users~1{id}/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1users~1{user-id}/post'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1empty~1{}/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1items/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1form-body-mix/post'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1double-body/put'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1secure/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1exampleMedia/get'],
      ['operation-id-camel-case', Severity.Warning, 'operationId should be camelCase (starts with lowercase letter, no separators)', '/paths/~1users~1{id}/get/operationId'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1users~1/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1form-body-mix/post'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1double-body/put'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1exampleMedia/get'],
      ['operation-success-response', Severity.Warning, 'Operation must have at least one "2xx" or "3xx" response.', '/paths/~1users~1/get/responses'],
      ['path-keys-no-trailing-slash', Severity.Warning, 'Path must not end with slash.', '/paths/~1users~1'],
      ['path-param-camel-case', Severity.Warning, 'Path parameter names should be camelCase', '/paths/~1users~1{user-id}/get/parameters/0/name'],
      ['path-segments-kebab-case', Severity.Warning, 'Static path segments should be kebab-case (lowercase letters, numbers, hyphens only)', '/paths/~1exampleMedia'],
      ['query-param-camel-case', Severity.Warning, 'Query parameter names should be camelCase', '/paths/~1items/parameters/3/name'],
      ['schema-property-camel-case', Severity.Warning, 'Schema property names in request/response bodies should be camelCase', '/definitions/EnumBad/properties/current-status'],
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

  test('should fail validation for Swagger 2.0 - Part 2', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '2.0', 'invalid-2.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [
      ['oas2-schema', Severity.Error, '"description" property must be string.', '/info/description'],
      ['oas2-schema', Severity.Error, '"host" property must match pattern "^[^{}/ :\\\\]+(?::\\d+)?$".', '/host'],
      ['operation-operationId-valid-in-url', Severity.Error, 'operationId must not characters that are invalid when used in URL.', '/paths/~1/get/operationId'],
      ['info-description', Severity.Warning, 'Info "description" must be present and non-empty string.', '/info/description'],
      ['oas2-host-not-example', Severity.Warning, 'Host URL must not point at example.com.', '/host'],
      ['oas2-host-trailing-slash', Severity.Warning, 'Server URL must not have trailing slash.', '/host'],
      ['oas2-operation-formData-consume-check', Severity.Warning, 'Operations with "in: formData" parameter must include "application/x-www-form-urlencoded" or "multipart/form-data" in their "consumes" property.', '/paths/~1upload/post'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1upload/post'],
      ['operation-id-camel-case', Severity.Warning, 'operationId should be camelCase (starts with lowercase letter, no separators)', '/paths/~1/get/operationId'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1upload/post'],
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

  test('should warn validation for Swagger 2.0 - Part 1', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '2.0', 'warnings-1.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [
      // The oas2-schema rule duplicates some of the other rules which results in some errors being reported as both errors and warnings
      ['oas2-schema', Severity.Error, '"tags" property must not have duplicate items (items ## 1 and 2 are identical).', '/tags'],
      ['array-items', Severity.Warning, 'Schemas with "type: array", require a sibling "items" field', '/definitions/ArrayNoItems'],
      ['info-description', Severity.Warning, 'Info "description" must be present and non-empty string.', '/info'],
      ['no-eval-in-markdown', Severity.Warning, 'Markdown descriptions must not have "eval(".', '/paths/~1search/get/description'],
      ['no-script-tags-in-markdown', Severity.Warning, 'Markdown descriptions must not have "<script>" tags.', '/paths/~1users~1{user-id}/get/description'],
      ['oas2-api-host', Severity.Warning, 'OpenAPI "host" must be present and non-empty string.', '<root>'],
      ['oas2-api-schemes', Severity.Warning, 'OpenAPI host "schemes" must be present and non-empty array.', '<root>'],
      ['oas2-discriminator', Severity.Warning, 'The discriminator property must be in the required property list.', '/definitions/DiscriminatorBad'],
      ['oas2-operation-security-defined', Severity.Warning, 'Operation "security" values must match a scheme defined in the "securityDefinitions" object.', '/paths/~1secure/get/security/0/petstore_auth'],
      ['oas2-unused-definition', Severity.Warning, 'Potentially unused definition has been detected.', '/definitions/EnumBad'],
      ['oas2-unused-definition', Severity.Warning, 'Potentially unused definition has been detected.', '/definitions/ArrayNoItems'],
      ['oas2-unused-definition', Severity.Warning, 'Potentially unused definition has been detected.', '/definitions/DiscriminatorBad'],
      ['oas2-unused-definition', Severity.Warning, 'Potentially unused definition has been detected.', '/definitions/BadSchemaExample'],
      ['oas2-unused-definition', Severity.Warning, 'Potentially unused definition has been detected.', '/definitions/UnusedDefinition'],
      ['oas2-valid-media-example', Severity.Warning, '"name" property type must be string', '/paths/~1example-media/get/responses/200/examples/application~1json/name'],
      ['oas2-valid-schema-example', Severity.Warning, '"name" property type must be string', '/definitions/BadSchemaExample/example/name'],
      ['openapi-tags-alphabetical', Severity.Warning, 'OpenAPI object must have alphabetical "tags".', '/tags'],
      ['openapi-tags-uniqueness', Severity.Warning, '"tags" object contains duplicate tag name "alpha".', '/tags/2/name'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1users~1/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1users~1{user-id}/post'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1empty/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1items/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1form-body-mix/post'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1double-body/put'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1secure/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1example-media/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1users~1/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1form-body-mix/post'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1double-body/put'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1example-media/get'],
      ['operation-success-response', Severity.Warning, 'Operation must have at least one "2xx" or "3xx" response.', '/paths/~1users~1/get/responses'],
      ['path-keys-no-trailing-slash', Severity.Warning, 'Path must not end with slash.', '/paths/~1users~1'],
      ['path-param-camel-case', Severity.Warning, 'Path parameter names should be camelCase', '/paths/~1users~1{user-id}/parameters/0/name'],
      ['query-param-camel-case', Severity.Warning, 'Query parameter names should be camelCase', '/paths/~1items/parameters/1/name'],
      ['schema-property-camel-case', Severity.Warning, 'Schema property names in request/response bodies should be camelCase', '/definitions/EnumBad/properties/current-status'],
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

  test('should warn validation for Swagger 2.0 - Part 2', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '2.0', 'warnings-2.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [
      // The oas2-schema rule duplicates some of the other rules which results in some errors being reported as both errors and warnings
      ['oas2-schema', Severity.Error, '"host" property must match pattern "^[^{}/ :\\\\]+(?::\\d+)?$".', '/host'],
      ['info-description', Severity.Warning, 'Info "description" must be present and non-empty string.', '/info/description'],
      ['oas2-host-not-example', Severity.Warning, 'Host URL must not point at example.com.', '/host'],
      ['oas2-host-trailing-slash', Severity.Warning, 'Server URL must not have trailing slash.', '/host'],
      ['oas2-operation-formData-consume-check', Severity.Warning, 'Operations with "in: formData" parameter must include "application/x-www-form-urlencoded" or "multipart/form-data" in their "consumes" property.', '/paths/~1upload/post'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1/get'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1upload/post'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1upload/post'],
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

  test('should pass validation for Swagger 2.0 - Part 1', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '2.0', 'valid-1.yaml');
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

  test('should pass validation for Swagger 2.0 - Part 2', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', '2.0', 'valid-2.yaml');
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