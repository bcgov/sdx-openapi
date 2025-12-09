const fs = require('fs');
const path = require('path');

const { Spectral, DiagnosticSeverity } = require('@stoplight/spectral-core');
const { Document } = require('@stoplight/spectral-core');  // Added missing import
const Parsers = require('@stoplight/spectral-parsers');
const { bundleAndLoadRuleset } = require('@stoplight/spectral-ruleset-bundler/with-loader');
const { fetch } = require('@stoplight/spectral-runtime');

const Severity = {
  Error: 0,
  Warning: 1,
  Info: 2,
  Hint: 3,
};

describe('Spectral Validation Rules', () => {
  let spectral;

  beforeAll(async () => {
    const rulesetFile = path.join(__dirname, '..', '..',  '..', 'spectral', 'test-rules.yaml');  // Matched your path
    const ruleset = await bundleAndLoadRuleset(rulesetFile, { fs, fetch });  // Fixed: Pass { fs, fetch }
    spectral = new Spectral();
    await spectral.setRuleset(ruleset);
  });

  test('should pass validation for valid OAS file', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'valid-oas.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);
    expect(results).toHaveLength(0);
  });

  test('should fail validation for invalid OAS file with expected errors', async () => {
    const oasFile = path.join(__dirname, '..', 'resources', 'invalid-oas.yaml');
    const source = fs.readFileSync(oasFile, 'utf8');
    const document = new Document(source, Parsers.Yaml, oasFile);
    const results = await spectral.run(document);
    expect(results).toHaveLength(1);
    const messages = results.map(r => r.message);
    expect(messages).toContain('Operation ID `listPets` is not kebab-case. Example: `list-pets`.');
    // All should be errors
    expect(results.every(r => r.severity === Severity.Error)).toBe(true);  // Error = 0
  });
});