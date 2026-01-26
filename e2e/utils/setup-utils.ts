/**
 * E2Eテスト用ウィンドウセットアップユーティリティ
 *
 * 各テストで一貫したウィンドウセットアップを行うためのヘルパー関数を提供する。
 */
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { getInitialBrowserTabId } from './tab-utils';
import { openSidePanelForWindow } from './window-utils';
import { waitForSidePanelReady, waitForInitialized } from './polling-utils';

/**
 * ウィンドウセットアップ情報
 */
export interface WindowSetup {
  /** ウィンドウID */
  windowId: number;
  /** ブラウザ起動時のデフォルトタブID */
  initialBrowserTabId: number;
  /** サイドパネルのPage */
  sidePanelPage: Page;
}

/**
 * ウィンドウのセットアップを行う
 *
 * @param context - ブラウザコンテキスト
 * @param serviceWorker - Service Worker
 * @param windowId - セットアップするウィンドウID
 * @returns セットアップ情報
 */
export async function setupWindow(
  context: BrowserContext,
  serviceWorker: Worker,
  windowId: number
): Promise<WindowSetup> {
  const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
  const sidePanelPage = await openSidePanelForWindow(context, windowId);
  await waitForSidePanelReady(sidePanelPage, serviceWorker);
  // Service Workerの初期化が完了するまで待機（handleTabCreatedがタブを処理できるようにするため）
  await waitForInitialized(serviceWorker);

  return { windowId, initialBrowserTabId, sidePanelPage };
}

/**
 * 新しいウィンドウを作成してセットアップを行う
 *
 * @param context - ブラウザコンテキスト
 * @param serviceWorker - Service Worker
 * @returns セットアップ情報
 */
export async function createAndSetupWindow(
  context: BrowserContext,
  serviceWorker: Worker
): Promise<WindowSetup> {
  const { createWindow } = await import('./window-utils');
  const windowId = await createWindow(context);
  return setupWindow(context, serviceWorker, windowId);
}
