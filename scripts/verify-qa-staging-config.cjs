const fileSystem = require('node:fs/promises');
const path = require('node:path');

const CONTRACT_PATH = path.resolve(__dirname, '..', 'qa', 'staging-web-contract.json');
const REQUIRED_STATIC_FILES = ['index.html', 'manifest.json', 'sw.js'];
const FORBIDDEN_ENVIRONMENT_NAMES = [
  /SUPABASE_SERVICE_ROLE/i,
  /SMTP/i,
  /RESEND/i,
  /TRELLO/i,
  /MICROSOFT.*(?:SECRET|TOKEN|PASSWORD)/i,
  /ACCOUNT_ACTION_TICKET_PEPPER/i,
  /(?:PRIVATE|SECRET)_?KEY/i,
];
const FORBIDDEN_BUNDLE_PATTERNS = [
  /sb_secret_[A-Za-z0-9_-]{20,}/,
  /SUPABASE_SERVICE_ROLE(?:_KEY)?\s*[:=]\s*['\"][^'\"]+['\"]/,
  /SMTP_[A-Z_]*\s*[:=]\s*['\"][^'\"]+['\"]/,
  /RESEND_API_KEY\s*[:=]\s*['\"][^'\"]+['\"]/,
  /TRELLO_TOKEN\s*[:=]\s*['\"][^'\"]+['\"]/,
  /MICROSOFT_CLIENT_SECRET\s*[:=]\s*['\"][^'\"]+['\"]/,
  /ACCOUNT_ACTION_TICKET_PEPPER\s*[:=]\s*['\"][^'\"]+['\"]/,
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/,
];
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json']);

function parseDotenv(source) {
  return source.split(/\r?\n/).reduce((values, line) => {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return values;

    const assignment = trimmed.replace(/^export\s+/, '');
    const separator = assignment.indexOf('=');
    if (separator === -1) return values;

    const name = assignment.slice(0, separator).trim();
    let value = assignment.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (name !== '') values[name] = value;
    return values;
  }, {});
}

function validateStagingEnvironment(values, contract) {
  for (const name of contract.publicVariableNames) {
    if (typeof values[name] !== 'string' || values[name].trim() === '') {
      throw new Error(`Missing required public variable: ${name}`);
    }
  }

  for (const name of Object.keys(values)) {
    if (FORBIDDEN_ENVIRONMENT_NAMES.some((pattern) => pattern.test(name))) {
      throw new Error(`Forbidden server-only variable: ${name}`);
    }
    if (name.startsWith('EXPO_PUBLIC_') && !contract.publicVariableNames.includes(name)) {
      throw new Error(`Unreviewed public variable: ${name}`);
    }
  }

  let expectedUrl;
  let actualUrl;
  try {
    expectedUrl = new URL(contract.supabaseUrl);
    actualUrl = new URL(values.EXPO_PUBLIC_SUPABASE_URL);
  } catch {
    throw new Error('Invalid EXPO_PUBLIC_SUPABASE_URL');
  }

  if (expectedUrl.protocol !== 'https:' || actualUrl.protocol !== 'https:' || actualUrl.origin !== expectedUrl.origin) {
    throw new Error('Invalid EXPO_PUBLIC_SUPABASE_URL');
  }

  if (!values.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
    throw new Error('Invalid EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
}

async function listFiles(directory, relativeDirectory = '') {
  const entries = await fileSystem.readdir(path.join(directory, relativeDirectory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(directory, relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

async function inspectStaticExport(directory, expectedPublicSupabaseUrl) {
  const files = await listFiles(directory);
  const relativeFiles = files.map((file) => file.split(path.sep).join('/'));

  for (const requiredFile of REQUIRED_STATIC_FILES) {
    if (!relativeFiles.includes(requiredFile)) throw new Error(`Missing required static file: ${requiredFile}`);
  }
  if (!relativeFiles.some((file) => file.startsWith('_expo/static/js/') && file.endsWith('.js'))) {
    throw new Error('Missing static JavaScript asset');
  }
  if (relativeFiles.some((file) => file.endsWith('.map'))) {
    throw new Error('Source maps are not allowed in staging export');
  }

  for (const relativeFile of relativeFiles) {
    if (!TEXT_EXTENSIONS.has(path.extname(relativeFile))) continue;
    const contents = await fileSystem.readFile(path.join(directory, relativeFile), 'utf8');
    if (FORBIDDEN_BUNDLE_PATTERNS.some((pattern) => pattern.test(contents))) {
      throw new Error(`Found forbidden server-secret marker in static export: ${relativeFile}`);
    }
  }

  if (typeof expectedPublicSupabaseUrl === 'string' && expectedPublicSupabaseUrl !== '') {
    const containsPublicSupabaseUrl = await Promise.all(
      relativeFiles
        .filter((file) => TEXT_EXTENSIONS.has(path.extname(file)))
        .map(async (relativeFile) => (await fileSystem.readFile(path.join(directory, relativeFile), 'utf8')).includes(expectedPublicSupabaseUrl)),
    );
    if (!containsPublicSupabaseUrl.some(Boolean)) {
      throw new Error('Missing reviewed public Supabase URL in static export');
    }
  }
}

function parseArguments(argumentsList) {
  const options = { envFile: path.resolve('.env.local'), inspectDist: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    if (argumentsList[index] === '--env-file') options.envFile = path.resolve(argumentsList[++index]);
    if (argumentsList[index] === '--dist') {
      options.distDirectory = path.resolve(argumentsList[++index]);
      options.inspectDist = true;
    }
  }
  return options;
}

async function runVerification({ envFile, distDirectory, inspectDist }) {
  const [contractSource, envSource] = await Promise.all([
    fileSystem.readFile(CONTRACT_PATH, 'utf8'),
    fileSystem.readFile(envFile, 'utf8'),
  ]);
  const values = parseDotenv(envSource);
  validateStagingEnvironment(values, JSON.parse(contractSource));
  if (inspectDist) await inspectStaticExport(distDirectory, values.EXPO_PUBLIC_SUPABASE_URL);
}

if (require.main === module) {
  runVerification(parseArguments(process.argv.slice(2)))
    .then(() => console.log('QA staging configuration verified.'))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'QA staging configuration failed.');
      process.exitCode = 1;
    });
}

module.exports = { inspectStaticExport, parseDotenv, parseArguments, runVerification, validateStagingEnvironment };
