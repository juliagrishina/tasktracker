const fileSystem = require('node:fs/promises');
const path = require('node:path');
const stagingGuard = require('./verify-qa-staging-config.cjs');

const CONTRACT_PATH = path.resolve(__dirname, '..', 'qa', 'production-web-contract.json');

async function runVerification({ envFile, distDirectory, inspectDist }) {
  const [contractSource, envSource] = await Promise.all([
    fileSystem.readFile(CONTRACT_PATH, 'utf8'),
    fileSystem.readFile(envFile, 'utf8'),
  ]);
  const contract = JSON.parse(contractSource);
  const values = stagingGuard.parseDotenv(envSource);

  stagingGuard.validateStagingEnvironment(values, contract);
  if (inspectDist) await stagingGuard.inspectStaticExport(distDirectory, values.EXPO_PUBLIC_SUPABASE_URL);
}

if (require.main === module) {
  runVerification(stagingGuard.parseArguments(process.argv.slice(2)))
    .then(() => console.log('Production web configuration verified.'))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'Production web configuration failed.');
      process.exitCode = 1;
    });
}

module.exports = { runVerification };
