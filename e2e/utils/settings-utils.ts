import type { BrowserContext, Worker } from '@playwright/test';
import type { UserSettings } from '../../src/types';

export async function setUserSettings(
  context: BrowserContext,
  settings: Partial<UserSettings>
): Promise<void> {
  const serviceWorkers = context.serviceWorkers();
  const serviceWorker = serviceWorkers[0];
  if (!serviceWorker) {
    throw new Error('Service worker not found');
  }

  await serviceWorker.evaluate(async (partialSettings: Partial<UserSettings>) => {
    const result = await chrome.storage.local.get<{ user_settings?: Partial<UserSettings> }>('user_settings');
    await chrome.storage.local.set({ user_settings: { ...result.user_settings, ...partialSettings } });
  }, settings);
}

export async function getUserSettings(
  serviceWorker: Worker
): Promise<UserSettings | null> {
  return serviceWorker.evaluate(async () => {
    const result = await chrome.storage.local.get<{ user_settings?: UserSettings }>('user_settings');
    return result.user_settings ?? null;
  });
}
