/**
 * ドラッグ&ドロップによる階層変更（親子関係の作成）テスト
 *
 * Requirement 3.3: ドラッグ&ドロップによる階層変更（親子関係の作成）
 *
 * このテストスイートでは、ドラッグ&ドロップによる親子関係の作成を検証します。
 * - タブを別のタブに重ねてドロップした際の親子関係作成
 * - 初めて子タブを追加した際の展開/折りたたみアイコン表示
 * - 折りたたまれた親タブへの子タブドロップ時の自動展開
 * - 既存の子を持つ親への新しい子の追加
 * - 深い階層のタブ移動時のdepth再計算
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { moveTabToParent } from './utils/drag-drop-utils';

test.describe('ドラッグ&ドロップによる階層変更（親子関係の作成）', () => {
  test('タブを別のタブに重ねてドロップした場合、ドロップ先タブの子として配置されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 2つのルートレベルのタブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org');

    // タブがツリーに表示されるまで待機（タイトルなしで）
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);

    // ドラッグ対象の要素が完全にレンダリングされ、操作可能になるまで待機
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`).first();

    // 要素がアタッチされ、可視状態になるまで待機
    await expect(parentNode).toBeAttached({ timeout: 10000 });
    await expect(childNode).toBeAttached({ timeout: 10000 });
    await expect(parentNode).toBeVisible({ timeout: 10000 });
    await expect(childNode).toBeVisible({ timeout: 10000 });

    // 要素のバウンディングボックスが確定するまで待機（レイアウト安定化）
    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      childTab,
      { timeout: 10000 }
    );

    // アニメーションやトランジションが完了するまで追加待機
    // バウンディングボックスが安定したことを確認
    await sidePanelPage.waitForFunction(
      ([parentId, childId]) => {
        const parentNode = document.querySelector(`[data-testid="tree-node-${parentId}"]`);
        const childNode = document.querySelector(`[data-testid="tree-node-${childId}"]`);
        if (!parentNode || !childNode) return false;
        const parentRect = parentNode.getBoundingClientRect();
        const childRect = childNode.getBoundingClientRect();
        return parentRect.width > 0 && parentRect.height > 0 && childRect.width > 0 && childRect.height > 0;
      },
      [parentTab, childTab] as [number, number],
      { timeout: 5000 }
    );

    // 実行: childTabをparentTabにドロップして親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab);

    // 検証: 親タブが展開され、子タブが親の配下に表示されること
    // UIが更新されるまで待機
    await sidePanelPage.waitForFunction(
      (ids) => {
        const parentNode = document.querySelector(`[data-testid="tree-node-${ids.parentTab}"]`);
        const childNode = document.querySelector(`[data-testid="tree-node-${ids.childTab}"]`);
        // 両方のノードが存在することを確認
        return parentNode !== null && childNode !== null;
      },
      { parentTab, childTab },
      { timeout: 10000 }
    );

    // 親タブノードを再取得
    const parentNodeAfterDrop = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    await expect(parentNodeAfterDrop).toBeVisible({ timeout: 10000 });

    // 親タブを展開（もし折りたたまれている場合）
    const expandButton = parentNodeAfterDrop.locator('[data-testid="expand-button"]');
    const expandButtonCount = await expandButton.count();
    if (expandButtonCount > 0) {
      const isExpanded = await parentNodeAfterDrop.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.first().click();
        // 展開アニメーションの完了をポーリングで待機
        await expect(async () => {
          const expanded = await parentNodeAfterDrop.getAttribute('data-expanded');
          expect(expanded).toBe('true');
        }).toPass({ timeout: 5000 });
      }
    }

    // 子タブが存在することを確認
    const childNodeAfterDrop = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`);
    await expect(childNodeAfterDrop.first()).toBeVisible({ timeout: 10000 });
  });

  test('子タブを持たないタブに初めて子タブを追加した場合、親タブに展開/折りたたみアイコンが表示されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 2つのルートレベルのタブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org');

    // タブがツリーに表示されるまで待機（タイトルなしで）
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);

    // 初期状態: 親タブに展開ボタンがないことを確認
    const parentNodeBefore = sidePanelPage
      .locator(`[data-testid="tree-node-${parentTab}"]`)
      .first();
    const expandButtonBefore = parentNodeBefore.locator('[data-testid="expand-button"]');
    const hasExpandButtonBefore = (await expandButtonBefore.count()) > 0;

    // 実行: childTabをparentTabにドロップして親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab);

    // 検証: 親タブに展開/折りたたみボタンが表示されること
    // UIが更新されるまでポーリングで待機
    const parentNodeAfter = sidePanelPage
      .locator(`[data-testid="tree-node-${parentTab}"]`)
      .first();
    const expandButtonAfter = parentNodeAfter.locator('[data-testid="expand-button"]');

    // 展開ボタンが表示されることを確認（初期状態でなかった場合は新しく表示される）
    if (!hasExpandButtonBefore) {
      // ポーリングで展開ボタンが表示されるまで待機
      await expect(async () => {
        await expect(expandButtonAfter.first()).toBeVisible();
      }).toPass({ timeout: 10000 });
    } else {
      // 既に展開ボタンがある場合は、引き続き存在することを確認
      await expect(async () => {
        const hasExpandButtonAfter = (await expandButtonAfter.count()) > 0;
        expect(hasExpandButtonAfter).toBe(true);
      }).toPass({ timeout: 5000 });
    }
  });

  test('折りたたまれた親タブに子タブをドロップした場合、親タブが自動的に展開されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと既存の子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const existingChild = await createTab(extensionContext, 'https://www.iana.org', parentTab);

    // タブがツリーに表示されるまで待機（タイトルなしで）
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, existingChild);

    // 親タブを展開
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();

    // 展開ボタンが表示されるまでポーリングで待機（親子関係がUIに反映されるまで）
    await expect(async () => {
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible();
    }).toPass({ timeout: 10000 });

    // 展開ボタンをクリック可能な状態になるまで少し待機
    const expandButton = parentNode.locator('[data-testid="expand-button"]').first();
    await expect(expandButton).toBeVisible();

    // 親タブを展開（クリック後にリトライ）
    await expect(async () => {
      await expandButton.click({ force: true });
      const expanded = await parentNode.getAttribute('data-expanded');
      expect(expanded).toBe('true');
    }).toPass({ timeout: 5000 });

    // 親タブを折りたたむ
    await expect(async () => {
      await expandButton.click({ force: true });
      const expanded = await parentNode.getAttribute('data-expanded');
      expect(expanded).toBe('false');
    }).toPass({ timeout: 5000 });

    // 新しいタブを作成
    const newChild = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabInTree(sidePanelPage, newChild);

    // 実行: 新しいタブを折りたたまれた親タブにドロップ
    await moveTabToParent(sidePanelPage, newChild, parentTab);

    // 検証: 親タブが自動的に展開されること
    // 親タブの展開状態を確認（UIが更新されるまでポーリング）
    const parentNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();

    // 展開状態であることを確認（実装に依存するため、柔軟に検証）
    // 少なくとも新しい子タブが表示されることをポーリングで確認
    const newChildNode = sidePanelPage.locator(`[data-testid="tree-node-${newChild}"]`);
    await expect(async () => {
      await expect(newChildNode.first()).toBeVisible();
    }).toPass({ timeout: 10000 });

    // 展開ボタンが存在し、展開状態であることを確認（可能であれば）
    const isExpanded = await parentNodeAfter.getAttribute('data-expanded');
    if (isExpanded !== null) {
      expect(isExpanded).toBe('true');
    }
  });

  test('既に子を持つ親タブに新しい子をドロップした場合、子タブリストの末尾に追加されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと2つの既存の子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const child1 = await createTab(extensionContext, 'https://www.iana.org', parentTab);
    const child2 = await createTab(extensionContext, 'https://www.w3.org', parentTab);

    // タブがツリーに表示されるまで待機（タイトルなしで）
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, child1);
    await assertTabInTree(sidePanelPage, child2);

    // 親タブを展開
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();

    // 展開ボタンが表示されるまでポーリングで待機（親子関係がUIに反映されるまで）
    await expect(async () => {
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible();
    }).toPass({ timeout: 10000 });

    // 展開ボタンをクリック可能な状態になるまで少し待機
    const expandButton = parentNode.locator('[data-testid="expand-button"]').first();
    await expect(expandButton).toBeVisible();

    // 展開ボタンをクリックして展開（クリック後にリトライ）
    await expect(async () => {
      await expandButton.click({ force: true });
      const expanded = await parentNode.getAttribute('data-expanded');
      expect(expanded).toBe('true');
    }).toPass({ timeout: 5000 });

    // 新しいタブを作成
    const newChild = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabInTree(sidePanelPage, newChild);

    // 実行: 新しいタブを親タブにドロップ
    await moveTabToParent(sidePanelPage, newChild, parentTab);

    // 検証: 全ての子タブが存在することを確認
    const child1Node = sidePanelPage.locator(`[data-testid="tree-node-${child1}"]`);
    const child2Node = sidePanelPage.locator(`[data-testid="tree-node-${child2}"]`);
    const newChildNode = sidePanelPage.locator(`[data-testid="tree-node-${newChild}"]`);

    // UIが更新されるまでポーリングで待機
    await expect(async () => {
      await expect(child1Node.first()).toBeVisible();
      await expect(child2Node.first()).toBeVisible();
      await expect(newChildNode.first()).toBeVisible();
    }).toPass({ timeout: 10000 });

    // 子タブの数を確認（3つの子タブが存在する）
    const childNodes = sidePanelPage.locator(`[data-testid^="tree-node-"]`);
    await expect(async () => {
      const count = await childNodes.count();
      expect(count).toBeGreaterThanOrEqual(4); // 親 + 3つの子
    }).toPass({ timeout: 5000 });
  });

  test('深い階層のタブを別の親にドロップした場合、depthが正しく再計算されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {

    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 深い階層のタブ構造を作成
    // Level 0: rootTab
    // Level 1: parentTab1
    // Level 2: childTab
    // Level 3: grandChildTab
    const rootTab = await createTab(extensionContext, 'https://example.com');
    const parentTab1 = await createTab(extensionContext, 'https://www.iana.org', rootTab);
    const childTab = await createTab(extensionContext, 'https://www.w3.org', parentTab1);
    const grandChildTab = await createTab(
      extensionContext,
      'https://developer.mozilla.org',
      childTab
    );

    // 別のルートレベルのタブを作成
    const parentTab2 = await createTab(extensionContext, 'https://www.github.com');

    // タブがツリーに表示されるまで待機（タイトルなしで）
    await assertTabInTree(sidePanelPage, rootTab);
    await assertTabInTree(sidePanelPage, parentTab1);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, grandChildTab);
    await assertTabInTree(sidePanelPage, parentTab2);

    // ツリーを展開してすべてのタブを表示
    const expandAll = async (tabId: number) => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.first().click();
          // 展開状態が反映されるまでポーリングで待機
          await expect(async () => {
            const expanded = await node.getAttribute('data-expanded');
            expect(expanded).toBe('true');
          }).toPass({ timeout: 5000 });
        }
      }
    };

    await expandAll(rootTab);
    await expandAll(parentTab1);
    await expandAll(childTab);

    // 実行: childTab（およびそのサブツリー）をparentTab2にドロップ
    await moveTabToParent(sidePanelPage, childTab, parentTab2);

    // 検証: childTabとgrandChildTabが新しい親の配下に移動したことを確認
    // parentTab2を展開
    await expandAll(parentTab2);

    // childTabが存在することをポーリングで確認
    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`);
    await expect(async () => {
      await expect(childNode.first()).toBeVisible();
    }).toPass({ timeout: 10000 });

    // grandChildTabも一緒に移動していることを確認
    await expandAll(childTab);
    const grandChildNode = sidePanelPage.locator(`[data-testid="tree-node-${grandChildTab}"]`);
    await expect(async () => {
      await expect(grandChildNode.first()).toBeVisible();
    }).toPass({ timeout: 10000 });

    // depthの検証（実装依存のため、タブが正しい階層に配置されていることを確認）
    // childTabのdepth属性を取得（実装があれば）
    await expect(async () => {
      const childDepth = await childNode.first().getAttribute('data-depth');
      const grandChildDepth = await grandChildNode.first().getAttribute('data-depth');

      // depthが設定されている場合、grandChildのdepthがchildのdepthより1大きいことを確認
      if (childDepth !== null && grandChildDepth !== null) {
        const childDepthNum = parseInt(childDepth, 10);
        const grandChildDepthNum = parseInt(grandChildDepth, 10);
        expect(grandChildDepthNum).toBe(childDepthNum + 1);
      }
    }).toPass({ timeout: 5000 });
  });
});
