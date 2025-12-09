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

  test('should pass validation for wellformedness OAS 3.1', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', 'valid-wellformedness-3.1.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    logActualResults(results);
    expect(results).toHaveLength(0);
  });

  test('should pass validation with warnings for wellformedness OAS 3.1', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', 'warnings-wellformedness-3.1.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [
      ['array-items', Severity.Warning, 'Schemas with "type: array", require a sibling "items" field', '/components/schemas/User/properties/roles'],
      ['info-description', Severity.Warning, 'Info "description" must be present and non-empty string.', '/info'],
      ['no-eval-in-markdown', Severity.Warning, 'Markdown descriptions must not have "eval(".', '/info/title'],
      ['no-script-tags-in-markdown', Severity.Warning, 'Markdown descriptions must not have "<script>" tags.', '/info/title'],
      ['openapi-tags-alphabetical', Severity.Warning, 'OpenAPI object must have alphabetical "tags".', '/tags'],
      ['openapi-tags-uniqueness', Severity.Warning, '"tags" object contains duplicate tag name "Moose".', '/tags/3/name'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1users/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1users~1{id}~1/delete'],
      ['operation-success-response', Severity.Warning, 'Operation must have at least one "2xx" or "3xx" response.', '/paths/~1users/post/responses'],
      ['path-keys-no-trailing-slash', Severity.Warning, 'Path must not end with slash.', '/paths/~1users~1{id}~1'],
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

  test('should fail validation for wellformedness OAS 3.0', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', 'invalid-wellformedness-3.0.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [
      ['duplicated-entry-in-enum', Severity.Error, '"enum" property must not have duplicate items (items ## 0 and 2 are identical)', '/components/schemas/User/properties/status/enum'],
      ['invalid-ref', Severity.Error, '\'#/components/schemas/CreateUserRequest\' does not exist', '/paths/~1users?status={status}/post/requestBody/content/application~1json/schema/$ref'],
      ['no-$ref-siblings', Severity.Error, '$ref must not be placed next to any other properties', '/paths/~1users?status={status}/get/responses/200/content/application~1json/schema/items/example'],
      ['operation-operationId-unique', Severity.Error, 'Every operation must have unique "operationId".', '/paths/~1users?status={status}/post/operationId'],
      ['operation-operationId-valid-in-url', Severity.Error, 'operationId must not characters that are invalid when used in URL.', '/paths/~1users~1{}~1/get/operationId'],
      ['operation-parameters', Severity.Error, 'A parameter in this operation already exposes the same combination of "name" and "in" values.', '/paths/~1users~1{}~1/get/parameters/1'],
      ['path-declarations-must-exist', Severity.Error, 'Path parameter declarations must not be empty, ex."/given/{}" is invalid.', '/paths/~1users~1{}~1'],
      ['path-not-include-query', Severity.Error, 'Path must not include query string.', '/paths/~1users?status={status}'],
      ['path-params', Severity.Error, 'Operation must define parameter "{status}" as expected by path "/users?status={status}".', '/paths/~1users?status={status}/get'],
      ['path-params', Severity.Error, 'Operation must define parameter "{status}" as expected by path "/users?status={status}".', '/paths/~1users?status={status}/post'],
      ['path-params', Severity.Error, 'Parameter "id" must be used in path "/users/{}/".', '/paths/~1users~1{}~1/get/parameters/0'],
      ['path-params', Severity.Error, 'Parameter "id" must be used in path "/users/{}/".', '/paths/~1users~1{}~1/delete/parameters/0'],
      ['path-params', Severity.Error, 'Path parameter "id" must not be defined multiple times.', '/paths/~1users~1{}~1/get/parameters/1'],
      ['typed-enum', Severity.Error, 'Enum value 1 must be "string".', '/components/schemas/User/properties/status/enum/3'],
      ['array-items', Severity.Warning, 'Schemas with "type: array", require a sibling "items" field', '/components/schemas/User/properties/roles'],
      ['info-description', Severity.Warning, 'Info "description" must be present and non-empty string.', '/info'],
      ['no-eval-in-markdown', Severity.Warning, 'Markdown descriptions must not have "eval(".', '/info/title'],
      ['no-script-tags-in-markdown', Severity.Warning, 'Markdown descriptions must not have "<script>" tags.', '/info/title'],
      ['openapi-tags-alphabetical', Severity.Warning, 'OpenAPI object must have alphabetical "tags".', '/tags'],
      ['openapi-tags-uniqueness', Severity.Warning, '"tags" object contains duplicate tag name "Moose".', '/tags/3/name'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1users?status={status}/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1users~1{}~1/delete'],
      ['operation-success-response', Severity.Warning, 'Operation must have at least one "2xx" or "3xx" response.', '/paths/~1users?status={status}/post/responses'],
      ['path-keys-no-trailing-slash', Severity.Warning, 'Path must not end with slash.', '/paths/~1users~1{}~1'],
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

  test('should fail validation for wellformedness OAS 2.0', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'basic', 'invalid-wellformedness-2.0.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);

    const expectedResults = [
      ['duplicated-entry-in-enum', Severity.Error, '"enum" property must not have duplicate items (items ## 0 and 2 are identical)', '/definitions/User/properties/status/enum'],
      ['invalid-ref', Severity.Error, '\'#/definitions/CreateUserRequest\' does not exist', '/paths/~1users?status={status}/post/parameters/0/schema/$ref'],
      ['no-$ref-siblings', Severity.Error, '$ref must not be placed next to any other properties', '/paths/~1users?status={status}/get/responses/200/schema/items/example'],
      ['oas2-anyOf', Severity.Error, '"anyOf" keyword must not be used in OpenAPI v2 document.', '/definitions/User/properties/created/anyOf'],
      ['operation-operationId-unique', Severity.Error, 'Every operation must have unique "operationId".', '/paths/~1users?status={status}/post/operationId'],
      ['operation-operationId-valid-in-url', Severity.Error, 'operationId must not characters that are invalid when used in URL.', '/paths/~1users~1{}~1/get/operationId'],
      ['operation-parameters', Severity.Error, 'A parameter in this operation already exposes the same combination of "name" and "in" values.', '/paths/~1users~1{}~1/get/parameters/1'],
      ['operation-parameters', Severity.Error, 'Operation must not have both "in:body" and "in:formData" parameters.', '/paths/~1users?status={status}/post/parameters'],
      ['operation-parameters', Severity.Error, 'Operation must not have more than a single instance of the "in:body" parameter.', '/paths/~1users?status={status}/post/parameters/1'],
      ['path-declarations-must-exist', Severity.Error, 'Path parameter declarations must not be empty, ex."/given/{}" is invalid.', '/paths/~1users~1{}~1'],
      ['path-not-include-query', Severity.Error, 'Path must not include query string.', '/paths/~1users?status={status}'],
      ['path-params', Severity.Error, 'Operation must define parameter "{status}" as expected by path "/users?status={status}".', '/paths/~1users?status={status}/get'],
      ['path-params', Severity.Error, 'Operation must define parameter "{status}" as expected by path "/users?status={status}".', '/paths/~1users?status={status}/post'],
      ['path-params', Severity.Error, 'Parameter "id" must be used in path "/users/{}/".', '/paths/~1users~1{}~1/get/parameters/0'],
      ['path-params', Severity.Error, 'Parameter "id" must be used in path "/users/{}/".', '/paths/~1users~1{}~1/delete/parameters/0'],
      ['path-params', Severity.Error, 'Path parameter "id" must not be defined multiple times.', '/paths/~1users~1{}~1/get/parameters/1'],
      ['typed-enum', Severity.Error, 'Enum value 1 must be "string".', '/definitions/User/properties/status/enum/3'],
      ['array-items', Severity.Warning, 'Schemas with "type: array", require a sibling "items" field', '/definitions/User/properties/roles'],
      ['info-description', Severity.Warning, 'Info "description" must be present and non-empty string.', '/info'],
      ['no-eval-in-markdown', Severity.Warning, 'Markdown descriptions must not have "eval(".', '/info/title'],
      ['no-script-tags-in-markdown', Severity.Warning, 'Markdown descriptions must not have "<script>" tags.', '/info/title'],
      ['openapi-tags-alphabetical', Severity.Warning, 'OpenAPI object must have alphabetical "tags".', '/tags'],
      ['openapi-tags-uniqueness', Severity.Warning, '"tags" object contains duplicate tag name "Moose".', '/tags/3/name'],
      ['operation-description', Severity.Warning, 'Operation "description" must be present and non-empty string.', '/paths/~1users?status={status}/get'],
      ['operation-operationId', Severity.Warning, 'Operation must have "operationId".', '/paths/~1users~1{}~1/delete'],
      ['operation-success-response', Severity.Warning, 'Operation must have at least one "2xx" or "3xx" response.', '/paths/~1users?status={status}/post/responses'],
      ['path-keys-no-trailing-slash', Severity.Warning, 'Path must not end with slash.', '/paths/~1users~1{}~1'],
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

    let actualResults = "const actualResults = [\n";
    for (const result of results) {
       actualResults += "  ['" + result.code + "', Severity."+getSeverityName(result.severity)+", '" + result.message.replace(/'/g, "\\'") + "', '" + yamlPathToString(result.path) + "'],\n";
    }
    actualResults += "];"
    console.debug(actualResults);
  }
});