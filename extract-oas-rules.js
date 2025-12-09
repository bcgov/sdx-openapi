// extract-oas-rules.js
(async () => {
  const { Spectral } = require('@stoplight/spectral-core');
  const { oas } = require('@stoplight/spectral-rulesets');

  const spectral = new Spectral();
  await spectral.setRuleset(oas);

  const ruleNames = Object.keys(spectral.ruleset.rules).sort();

  console.log('Found', ruleNames.length, 'rules in spectral:oas:\n');
  console.log(ruleNames.join('\n'));

  const yamlContent = `extends: spectral:oas

rules:
${ruleNames.map(name => `  ${name}: off`).join('\n')}
`;

  require('fs').writeFileSync('.spectral.generated.yaml', yamlContent);
  console.log('\nGenerated .spectral.generated.yaml with all rules disabled');
})();