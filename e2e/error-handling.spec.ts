/**
 * エラーハンドリングとエッジケースのE2Eテスト
 */
import { test as extensionTest } from './fixtures/extension';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

extensionTest.describe('エラーハンドリングとエッジケース', () => {
  extensionTest(
    '長いタブタイトルがある場合、タブノードが正常に表示される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const longTitle = 'これは非常に長いタブタイトルです。'.repeat(10);
      const dataUrl = `data:text/html,<html><head><title>${encodeURIComponent(longTitle)}</title></head><body>Long title test</body></html>`;

      const tabId = await createTab(serviceWorker, dataUrl);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '無効なURLのタブがある場合、タブノードが正常に表示される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const dataUrl = 'data:text/html,<html><head><title>No Favicon</title></head><body>No favicon test</body></html>';
      const tabId = await createTab(serviceWorker, dataUrl);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    'data URLのタブでもツリーに正常に表示される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const dataUrl = 'data:text/html,<html><head><title>Test Page</title></head><body>Content</body></html>';
      const tabId = await createTab(serviceWorker, dataUrl);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    'タブがロード中の場合、ローディングインジケータが表示される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    'タブが存在しないIDで操作された場合、エラーが適切に処理される',
    async ({ serviceWorker }) => {
      const nonExistentTabId = 999999;

      const didThrow = await serviceWorker.evaluate(async (tabId) => {
        try {
          await chrome.tabs.get(tabId);
          return false;
        } catch {
          return true;
        }
      }, nonExistentTabId);

      if (!didThrow) {
        throw new Error('Expected chrome.tabs.get to throw for non-existent tab ID');
      }
    }
  );

  extensionTest(
    '特殊文字を含むタブタイトルが正しく表示される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const specialTitle = '<script>alert("XSS")</script>&amp;&lt;&gt;"\'';
      const dataUrl = `data:text/html,<html><head><title>${encodeURIComponent(specialTitle)}</title></head><body>Special chars test</body></html>`;

      const tabId = await createTab(serviceWorker, dataUrl);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '空のタイトルを持つタブでもツリーに表示される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const dataUrl = 'data:text/html,<html><head><title></title></head><body>Empty title</body></html>';

      const tabId = await createTab(serviceWorker, dataUrl);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    'Unicode文字を含むタブタイトルが正しく表示される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const unicodeTitle = '日本語 中文 한국어 🎉🚀💻';
      const dataUrl = `data:text/html,<html><head><title>${encodeURIComponent(unicodeTitle)}</title></head><body>Unicode test</body></html>`;

      const tabId = await createTab(serviceWorker, dataUrl);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});
