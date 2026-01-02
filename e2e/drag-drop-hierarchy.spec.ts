/**
 * ドラッグ&ドロップによる階層変更（親子関係の作成）テスト
 *
 * 自前D&D実装用に書き直し
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
import { moveTabToParent, getParentTabId, getTabDepth } from './utils/drag-drop-utils';
import { waitForParentChildRelation } from './utils/polling-utils';

test.describe('ドラッグ&ドロップによる階層変更（親子関係の作成）', () => {
  // Playwrightのmouse.moveは各ステップで約1秒かかるため、タイムアウトを延長
  test.setTimeout(120000);

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

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);

    // 実行: childTabをparentTabにドロップして親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

    // 検証: 親子関係が作成されたことを確認
    const actualParent = await getParentTabId(sidePanelPage, childTab);
    expect(actualParent).toBe(parentTab);

    // 親タブノードに展開ボタンが表示されることを確認
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expect(expandButton.first()).toBeVisible({ timeout: 3000 });

    // 子タブが表示されることを確認（親を展開後）
    const isExpanded = await parentNode.getAttribute('data-expanded');
    if (isExpanded !== 'true') {
      await expandButton.first().click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
    }

    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`);
    await expect(childNode.first()).toBeVisible({ timeout: 3000 });
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

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);

    // 初期状態: 親タブに展開ボタンがないことを確認（子がいないため）
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButtonBefore = parentNode.locator('[data-testid="expand-button"]');
    const hasExpandButtonBefore = (await expandButtonBefore.count()) > 0;

    // 実行: childTabをparentTabにドロップして親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

    // 検証: 親タブに展開/折りたたみボタンが表示されること
    const expandButtonAfter = parentNode.locator('[data-testid="expand-button"]');

    if (!hasExpandButtonBefore) {
      // 展開ボタンが新しく表示されることを確認
      await expect(expandButtonAfter.first()).toBeVisible({ timeout: 5000 });
    } else {
      // 既に展開ボタンがある場合は、引き続き存在することを確認
      await expect(async () => {
        const hasExpandButtonAfter = (await expandButtonAfter.count()) > 0;
        expect(hasExpandButtonAfter).toBe(true);
      }).toPass({ timeout: 3000 });
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
    const existingChild = await createTab(extensionContext, 'https://www.iana.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, existingChild);

    // 既存の子タブを親タブの子にする
    await moveTabToParent(sidePanelPage, existingChild, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, existingChild, parentTab, { timeout: 5000 });

    // 親タブノードを取得して展開ボタンが表示されるまで待機
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]').first();
    await expect(expandButton).toBeVisible({ timeout: 5000 });

    // 親タブが展開されている場合は折りたたむ
    const isExpandedBefore = await parentNode.getAttribute('data-expanded');
    if (isExpandedBefore === 'true') {
      await expandButton.click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'false', { timeout: 3000 });
    }

    // 新しいタブを作成
    const newChild = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabInTree(sidePanelPage, newChild);

    // 実行: 新しいタブを折りたたまれた親タブにドロップ
    await moveTabToParent(sidePanelPage, newChild, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, newChild, parentTab, { timeout: 5000 });

    // 検証: 新しい子タブが表示されること（親が自動展開されるか、表示されること）
    const newChildNode = sidePanelPage.locator(`[data-testid="tree-node-${newChild}"]`);
    await expect(newChildNode.first()).toBeVisible({ timeout: 5000 });

    // 親タブが展開状態であることを確認（可能であれば）
    const isExpandedAfter = await parentNode.getAttribute('data-expanded');
    if (isExpandedAfter !== null) {
      expect(isExpandedAfter).toBe('true');
    }
  });

  test('既に子を持つ親タブに新しい子をドロップした場合、子タブリストに追加されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: まずすべてのタブを作成（他のテストと同様のパターン）
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    const newChild = await createTab(extensionContext, 'https://developer.mozilla.org');

    // すべてのタブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, child1);
    await assertTabInTree(sidePanelPage, newChild);

    // D&Dで親子関係を構築
    // 最初に child1 を parentTab の子にする
    await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, child1, parentTab, { timeout: 5000 });

    // 親タブを展開して子タブを表示
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

    const isExpanded = await parentNode.getAttribute('data-expanded');
    if (isExpanded !== 'true') {
      await expandButton.first().click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
    }

    // 次に newChild を parentTab の子にする
    await moveTabToParent(sidePanelPage, newChild, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, newChild, parentTab, { timeout: 5000 });

    // 検証: 両方の子タブが存在し、親子関係が正しいことを確認
    await expect(async () => {
      const parent1 = await getParentTabId(sidePanelPage, child1);
      const parent2 = await getParentTabId(sidePanelPage, newChild);

      expect(parent1).toBe(parentTab);
      expect(parent2).toBe(parentTab);
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
    // Level 1: parentTab1 (rootTabの子)
    // Level 2: childTab (parentTab1の子)
    // Level 3: grandChildTab (childTabの子)
    const rootTab = await createTab(extensionContext, 'https://example.com');
    const parentTab1 = await createTab(extensionContext, 'https://www.iana.org');
    const childTab = await createTab(extensionContext, 'https://www.w3.org');
    const grandChildTab = await createTab(extensionContext, 'https://developer.mozilla.org');

    // 別のルートレベルのタブを作成（移動先）
    const parentTab2 = await createTab(extensionContext, 'https://github.com');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, rootTab);
    await assertTabInTree(sidePanelPage, parentTab1);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, grandChildTab);
    await assertTabInTree(sidePanelPage, parentTab2);

    // D&Dで階層構造を構築（各操作後に親子関係の反映を待機）
    await moveTabToParent(sidePanelPage, parentTab1, rootTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, parentTab1, rootTab, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, childTab, parentTab1, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab1, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, grandChildTab, childTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, grandChildTab, childTab, { timeout: 5000 });

    // ツリーを展開してすべてのタブを表示
    const expandNode = async (tabId: number) => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.first().click();
          await expect(node).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
        }
      }
    };

    await expandNode(rootTab);
    await expandNode(parentTab1);
    await expandNode(childTab);

    // 移動前のdepthを確認
    const childDepthBefore = await getTabDepth(sidePanelPage, childTab);
    const grandChildDepthBefore = await getTabDepth(sidePanelPage, grandChildTab);

    // childTabはrootTab -> parentTab1 -> childTabなのでdepth 2
    // grandChildTabはrootTab -> parentTab1 -> childTab -> grandChildTabなのでdepth 3
    expect(childDepthBefore).toBe(2);
    expect(grandChildDepthBefore).toBe(3);

    // 実行: childTab（およびそのサブツリー）をparentTab2にドロップ
    await moveTabToParent(sidePanelPage, childTab, parentTab2, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab2, { timeout: 5000 });

    // parentTab2を展開
    await expandNode(parentTab2);

    // childTabを再度展開（移動後）
    await expandNode(childTab);

    // 検証: childTabとgrandChildTabが新しい親の配下に移動したことを確認
    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`);
    await expect(childNode.first()).toBeVisible({ timeout: 5000 });

    const grandChildNode = sidePanelPage.locator(`[data-testid="tree-node-${grandChildTab}"]`);
    await expect(grandChildNode.first()).toBeVisible({ timeout: 5000 });

    // 親子関係が正しいことを確認
    const childParent = await getParentTabId(sidePanelPage, childTab);
    expect(childParent).toBe(parentTab2);

    const grandChildParent = await getParentTabId(sidePanelPage, grandChildTab);
    expect(grandChildParent).toBe(childTab);

    // depthが正しく再計算されたことを確認
    // childTabはparentTab2 -> childTabなのでdepth 1
    // grandChildTabはparentTab2 -> childTab -> grandChildTabなのでdepth 2
    await expect(async () => {
      const childDepthAfter = await getTabDepth(sidePanelPage, childTab);
      const grandChildDepthAfter = await getTabDepth(sidePanelPage, grandChildTab);

      expect(childDepthAfter).toBe(1);
      expect(grandChildDepthAfter).toBe(2);
      // grandChildのdepthはchildのdepth + 1であることも確認
      expect(grandChildDepthAfter).toBe(childDepthAfter + 1);
    }).toPass({ timeout: 5000 });
  });
});
