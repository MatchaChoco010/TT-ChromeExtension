/**
 * E2Eテスト用ウィンドウセットアップユーティリティ
 *
 * 各テストで一貫したウィンドウセットアップを行うためのヘルパー関数を提供する。
 * autoResetはクリーンアップのみを行い（1ウィンドウ、initialTabのみ）、
 * 各テストはこのヘルパー関数を使用してsidePanelPageを作成する。
 */
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { getInitialBrowserTabId, getPseudoSidePanelTabId } from './tab-utils';
import { openSidePanelForWindow } from './window-utils';
import { waitForSidePanelReady, waitForSyncCompleted } from './polling-utils';

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
  /** 擬似サイドパネルタブID */
  pseudoSidePanelTabId: number;
}

/**
 * ウィンドウのセットアップを行う
 *
 * autoResetで用意されたベース状態（1ウィンドウ、initialTabのみ）に対して、
 * openSidePanelForWindow()でsidePanelPageを作成し、必要なIDを取得する。
 *
 * メインウィンドウでも新規ウィンドウでも同じパターンで使用できる。
 *
 * @param context - ブラウザコンテキスト
 * @param serviceWorker - Service Worker
 * @param windowId - セットアップするウィンドウID（必須）
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
  // syncWithChromeTabsが完了するまで待機（handleTabCreatedがタブを処理できるようにするため）
  await waitForSyncCompleted(serviceWorker);
  const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

  // デバッグ: sidePanelPageのクローズを追跡
  const closeStack = new Error('[Stack Capture Point]');
  sidePanelPage.on('close', () => {
    console.log(`[DEBUG] sidePanelPage was closed at ${new Date().toISOString()}! windowId=${windowId}, pseudoSidePanelTabId=${pseudoSidePanelTabId}`);
    console.log(`[DEBUG] Close stack trace: ${closeStack.stack}`);
    // Chromeタブの状態確認
    serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    }).then(tabs => {
      console.log(`[DEBUG] Chrome tabs at close: ${JSON.stringify(tabs)}`);
    }).catch(err => {
      console.log(`[DEBUG] Failed to get Chrome tabs: ${err}`);
    });
  });

  return { windowId, initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId };
}

/**
 * 新しいウィンドウを作成してセットアップを行う
 *
 * createWindow + setupWindowを一度に行うヘルパー。
 * マルチウィンドウテストで追加のウィンドウをセットアップする際に使用する。
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
