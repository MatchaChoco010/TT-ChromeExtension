import { test, expect } from '@playwright/test';
import { readFile } from 'fs/promises';
import { join } from 'path';

test.describe('Playwright Configuration', () => {
  test('playwright.config.ts should exist and be valid', async () => {
    const configPath = join(process.cwd(), 'playwright.config.ts');

    // Verify config file exists
    const configContent = await readFile(configPath, 'utf-8');
    expect(configContent).toBeTruthy();

    // Verify it imports from @playwright/test
    expect(configContent).toContain('@playwright/test');

    // Verify testDir points to ./e2e
    expect(configContent).toContain("testDir: './e2e'");

    // Verify testMatch pattern
    expect(configContent).toContain('**/*.spec.ts');

    // Verify timeout configuration is present (60 seconds)
    expect(configContent).toMatch(/timeout:\s*60000/);

    // Verify retry strategy is present (0 retries - no retry dependency)
    expect(configContent).toMatch(/retries:\s*0/);

    // Verify reporter configuration (HTML, JUnit, list)
    expect(configContent).toContain("'html'");
    expect(configContent).toContain("'junit'");
    expect(configContent).toContain("'list'");

    // Verify trace and screenshot settings
    expect(configContent).toContain("trace: 'on-first-retry'");
    expect(configContent).toContain("screenshot: 'only-on-failure'");

    // Verify Chromium project
    expect(configContent).toContain('chromium');

    // Verify CI-aware worker configuration
    expect(configContent).toContain('getWorkerCount');
  });

  test('package.json should have @playwright/test in devDependencies', async () => {
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

    expect(packageJson.devDependencies).toHaveProperty('@playwright/test');
  });

  test('package.json should have E2E test scripts', async () => {
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

    expect(packageJson.scripts).toHaveProperty('test:e2e');
    expect(packageJson.scripts['test:e2e']).toBe('playwright test');

    expect(packageJson.scripts).toHaveProperty('test:e2e:ui');
    expect(packageJson.scripts['test:e2e:ui']).toBe('playwright test --ui');

    expect(packageJson.scripts).toHaveProperty('test:e2e:debug');
    expect(packageJson.scripts['test:e2e:debug']).toBe('HEADED=true playwright test --debug');

    expect(packageJson.scripts).toHaveProperty('test:e2e:report');
    expect(packageJson.scripts['test:e2e:report']).toBe('playwright show-report');

    expect(packageJson.scripts).toHaveProperty('test:all');
    expect(packageJson.scripts['test:all']).toContain('npm test');
    expect(packageJson.scripts['test:all']).toContain('npm run test:e2e');
  });
});
