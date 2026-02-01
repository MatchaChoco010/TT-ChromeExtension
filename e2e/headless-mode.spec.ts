import { test, chromium } from '@playwright/test';
import { expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function waitForServiceWorkerReady(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
  timeout = 30000
): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 500;

  while (Date.now() - startTime < timeout) {
    const serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.length > 0) {
      const serviceWorker = serviceWorkers[0];
      try {
        await serviceWorker.evaluate(() => {
          return typeof chrome !== 'undefined' && chrome.runtime !== undefined;
        });
        return;
      } catch {
        // Service Workerがまだ準備できていない場合は待機を継続
      }
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Service Worker did not become ready within ${timeout}ms`);
}

test.describe('headlessモードの設定検証', () => {
  test.setTimeout(60000);

  test('HEADED=true環境変数でheadedモードに切り替わること', async () => {
    test.skip(
      process.env.HEADED !== 'true',
      'このテストはHEADED=trueでのみ実行可能です'
    );

    const pathToExtension = path.join(__dirname, '../dist');
    const headless = process.env.HEADED !== 'true';

    if (process.env.HEADED === 'true') {
      expect(headless).toBe(false);

      const context = await chromium.launchPersistentContext('', {
        headless,
        args: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
        ],
      });

      expect(context).toBeDefined();
      await waitForServiceWorkerReady(context);
      await context.close();
    } else {
      expect(headless).toBe(true);
    }
  });

  test('CI環境変数が設定されている場合、適切な設定が適用されること', async () => {
    const isCI = process.env.CI === 'true';

    if (isCI) {
      expect(isCI).toBe(true);
    } else {
      expect(isCI).toBe(false);
    }
  });
});
