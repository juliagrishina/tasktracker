import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedUrl = 'https://zwckrqbdepgvenanyans.supabase.co';
const temporaryEnvFile = '.env.eas-qa-verify';
const temporaryEnvPath = resolve(process.cwd(), temporaryEnvFile);
const requiredNames = [
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_SUPABASE_URL',
];

function ensureIgnored(path) {
  try {
    execFileSync('git', ['check-ignore', '--quiet', path], { stdio: 'ignore' });
  } catch {
    throw new Error(`${path} must be ignored by Git before QA work can continue.`);
  }
}

function readEnvironmentFile(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return separator === -1 ? [line, undefined] : [line.slice(0, separator), line.slice(separator + 1)];
      })
      .filter(([name, value]) => name !== undefined && value !== undefined),
  );
}

function sameNames(actualNames, expectedNames) {
  return actualNames.length === expectedNames.length && actualNames.every((name, index) => name === expectedNames[index]);
}

ensureIgnored(temporaryEnvFile);

try {
  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['--yes', 'eas-cli@latest', 'env:pull', '--environment', 'preview', '--path', temporaryEnvFile],
    { stdio: 'inherit' },
  );

  const variables = readEnvironmentFile(temporaryEnvPath);
  const names = Object.keys(variables).sort();

  if (!sameNames(names, requiredNames)) {
    throw new Error('The EAS preview environment must contain only the two approved public staging variables.');
  }
  if (variables.EXPO_PUBLIC_SUPABASE_URL !== expectedUrl) {
    throw new Error('The EAS preview environment does not target the approved staging Supabase project.');
  }
  if (!variables.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
    throw new Error('The EAS preview environment is missing the staging Supabase publishable key.');
  }

  console.log('EAS QA preview environment verified.');
} finally {
  if (existsSync(temporaryEnvPath)) {
    rmSync(temporaryEnvPath, { force: true });
  }
}
