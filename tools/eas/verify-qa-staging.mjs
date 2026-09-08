import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedUrl = 'https://zwckrqbdepgvenanyans.supabase.co';
const envPath = resolve(process.cwd(), '.env.local');

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

function ensureIgnored(path) {
  try {
    execFileSync('git', ['check-ignore', '--quiet', path], { stdio: 'ignore' });
  } catch {
    throw new Error(`${path} must be ignored by Git before QA work can continue.`);
  }
}

const variables = readEnvironmentFile(envPath);
ensureIgnored('.env.local');

if (variables.EXPO_PUBLIC_SUPABASE_URL !== expectedUrl) {
  throw new Error('QA work is allowed only for the configured staging Supabase project.');
}

if (!variables.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
  throw new Error('The staging Supabase publishable key is required in .env.local.');
}

console.log('QA staging environment verified.');
