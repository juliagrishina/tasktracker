const appConfig = require('../app.json') as {
  expo: { extra?: { eas?: { projectId?: string } }; owner?: string; web?: { output?: string } };
};
const easConfig = require('../eas.json') as { cli?: { version?: string } };
const packageConfig = require('../package.json') as { scripts?: Record<string, string> };

describe('EAS Hosting staging configuration', () => {
  test('keeps Hosting staging-only and deploy explicit', () => {
    expect(appConfig.expo.owner).toBe('grishina13');
    expect(appConfig.expo.web?.output).toBe('static');
    expect(appConfig.expo.extra?.eas?.projectId).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
    expect(easConfig.cli?.version).toBe('>= 23.2.0');

    expect(packageConfig.scripts).toMatchObject({
      'qa:config': 'node scripts/verify-qa-staging-config.cjs --env-file .env.local',
      'qa:verify': 'npm run qa:config && npm run typecheck && npm run lint && npm test',
      'qa:staging:export': 'npm run qa:verify && npm run web:export && node scripts/verify-qa-staging-config.cjs --env-file .env.local --dist dist',
      'qa:staging:deploy': 'npm run qa:staging:export && npx --yes eas-cli@23.2.0 deploy --environment preview --alias staging --export-dir dist',
    });
    expect(packageConfig.scripts?.['qa:staging:deploy']).not.toContain('--prod');
    expect(packageConfig.scripts?.['qa:staging:deploy']).not.toContain('--dev-domain');
    expect(Object.entries(packageConfig.scripts ?? {}).filter(([name, command]) => /^(pre|post)/.test(name) && command.includes('qa:staging:deploy'))).toEqual([]);
  });
});
