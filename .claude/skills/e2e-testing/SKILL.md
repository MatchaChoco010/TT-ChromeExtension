---
name: e2e-testing
description: E2Eテストを実装・修正する際に読み込むべき規約
---

# E2Eテスト規約

E2Eテストを実装・修正する際は、この規約に従うこと。

## 事後条件確認の鉄則（絶対遵守）

**各タブ操作の直後に毎回`assertTabStructure`等のassert系関数を呼ぶこと。まとめて呼ぶのは禁止。例外はない。**

以下のタブ操作関数の直後には必ずassert系関数（`assertTabStructure`, `assertPinnedTabStructure`, `assertWindowExists`等）を呼ぶ:

| タブ操作関数 | 必須assert |
|-------------|-----------|
| `createTab` | `assertTabStructure` |
| `closeTab` | `assertTabStructure` |
| `moveTabToWindow` | `assertTabStructure`（移動元・移動先両ウィンドウ） |
| `reorderTabs` | `assertTabStructure` |
| `moveTabToParent` | `assertTabStructure` |
| `dragOutside` | `assertTabStructure` + `assertWindowExists`/`assertWindowCount` |
| `moveTabToRoot` | `assertTabStructure` |
| `pinTab` | `assertTabStructure` + `assertPinnedTabStructure` |
| `unpinTab` | `assertTabStructure` + `assertPinnedTabStructure` |
| `activateTab` | `assertTabStructure` |
| `moveTabToWindowViaContextMenu` | `assertTabStructure`（移動元・移動先両ウィンドウ） |
| `moveTabToNewWindowViaContextMenu` | `assertTabStructure` + `assertWindowExists` |
| その他タブ操作系関数 | `assertTabStructure`（該当する場合は他のassert系も併用） |

**違反パターンの検出方法**: 上記関数の呼び出し行を検索し、直後の行にassert系関数がなければ違反

```typescript
// ✅ 正しい: 各タブ操作の直後に毎回assertTabStructure
const tab1 = await createTab(extensionContext, 'about:blank');
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: tab1, depth: 0 },
], 0);

const tab2 = await createTab(extensionContext, 'about:blank');
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: tab1, depth: 0 },
  { tabId: tab2, depth: 0 },
], 0);

await moveTabToParent(sidePanelPage, tab2, tab1, serviceWorker);
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: tab1, depth: 0, expanded: true },
  { tabId: tab2, depth: 1 },
], 0);

await closeTab(extensionContext, tab2);
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: tab1, depth: 0 },
], 0);

// ❌ 禁止: 複数のタブ操作後にまとめてassertTabStructure
const tabA = await createTab(extensionContext, 'about:blank');
const tabB = await createTab(extensionContext, 'about:blank');
await assertTabStructure(...);  // tabA作成直後に呼んでいないので禁止
```

## 禁止されている確認方法

個別の`expect()`による部分確認は**事後条件確認に使用禁止**。全体構造を検証しないと見落としが発生するため。

```typescript
// ❌ 禁止: 部分的な確認（個別のexpect）
const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`);
await expect(tabNode1).toBeVisible();
const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tab2}"]`);
await expect(tabNode2).toBeVisible();

// ✅ 正解: 全体構造を網羅的に検証
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: tab1, depth: 0, expanded: true },
  { tabId: tab2, depth: 1 },
], 0);
```

## 使用すべき事後条件確認関数

`e2e/utils/assertion-utils.ts`に定義:

| 関数 | 用途 |
|------|------|
| `assertTabStructure` | 通常タブの順序・depth・expanded・アクティブビューを**網羅的に**検証 |
| `assertPinnedTabStructure` | ピン留めタブの順序・アクティブビューを**網羅的に**検証 |
| `assertViewStructure` | ビューの順序・アクティブビューを**網羅的に**検証 |
| `assertWindowClosed` | ウィンドウが閉じられたことを検証 |
| `assertWindowExists` | ウィンドウが存在することを検証 |

## assertTabStructureのexpandedオプション

`assertTabStructure`は各タブに`expanded`オプションを指定できる:

- **子タブを持つタブ**: `expanded`は**必須**（`true`または`false`）
- **子タブを持たないタブ**: `expanded`は**指定不可**（undefinedのみ）

`assertTabStructure`はDOM上に見えている要素の事後条件を確認する関数であるため、`expanded: false`の場合は子タブがDOM上に表示されない。したがって折りたたまれた子タブは`assertTabStructure`に含めない。

```typescript
// ✅ 正しい: expandedの指定
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: tab2, depth: 0 },
  { tabId: tab1, depth: 0, expanded: true },    // 子を持つタブはexpanded必須
  { tabId: child1, depth: 1 },                   // 子を持たないタブはexpanded不可
  { tabId: child2, depth: 1, expanded: true },   // 子を持つタブはexpanded必須
  { tabId: grandchild1, depth: 2 },
], 0);

// ✅ 正しい: 折りたたまれた場合は子タブを含めない
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: parent, depth: 0, expanded: false },  // 子タブは見えていないので含めない
], 0);
```

## waitFor*関数の正しい用途

`waitFor*`関数（polling-utils.tsで定義）は**内部状態の同期待機**に使用する。事後条件確認には使わない。

```typescript
// ✅ 正しい: D&D操作後、事後条件を網羅的に検証
await moveTabToParent(sidePanelPage, child, parent, serviceWorker);
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: parent, depth: 0, expanded: true },
  { tabId: child, depth: 1 },
], 0);
```

## Service Workerイベントハンドラーの必須パターン（E2Eテスト対応）

Service Workerの全ての非同期イベントハンドラーは`trackHandler()`でラップする必要がある。これはE2Eテストのリセット処理が正しく動作するために必須。

**背景**: Chromeはイベントリスナーのコールバック完了を待たない。そのため、テスト間のリセット処理中に前のテストのハンドラーがバックグラウンドで実行され続け、状態の競合が発生する。

```typescript
// ✅ 正しい: trackHandlerでラップ
chrome.tabs.onCreated.addListener((tab) => {
  trackHandler(() => handleTabCreated(tab));
});

// ❌ 禁止: 直接呼び出し
chrome.tabs.onCreated.addListener((tab) => {
  handleTabCreated(tab);
});
```

**新しいイベントハンドラーを追加する際のチェックリスト**:
- [ ] `event-handlers.ts`で`trackHandler()`を使用してラップしているか
- [ ] `registerTabEventListeners()`または`registerWindowEventListeners()`内で登録しているか

## フレーキーテスト防止

- **固定時間待機（`waitForTimeout`）禁止**: ポーリングで状態確定を待つ
- **テストは10回連続成功必須**: `npm run test:e2e`を10回連続実行して全て成功することを確認（フレーキーが見つかっていない場合の目安）
- **Chrome Background Throttling対策**: ドラッグ操作前に`page.bringToFront()`
- **リトライ追加禁止**: テストにリトライを安易に追加してはならない。リトライはフレーキーさの根本原因を隠蔽し、問題の発覚を遅らせるだけである。テストがフレーキーな場合は、リトライを追加せずに根本的な原因を特定し修正すること

## フレーキーテストの扱い（絶対遵守）

**テストが1回でも失敗した場合、それは「フレーキー」であり、必ず根本原因を特定して修正すること。**

- **「フレーキーだから」「一時的だから」「再実行したら通った」は修正しない理由にならない**
- フレーキーは「原因不明の失敗」であり、原因不明のまま放置することは絶対に許されない
- 50回連続成功しても、1回の失敗の原因が不明なら問題は未解決である

**確認回数の基準**:
- **フレーキーが見つかっていない場合**: 10回連続成功で確認完了
- **1回でも失敗が発生した場合（フレーキー確定）**: 10回では不足。50回以上繰り返し実行し、フレーキーが本当に存在しないと言えるまで修正を続けること

**禁止される判断パターン**:
- 「5回成功したからおそらく大丈夫」
- 「一時的なフレーキーでした」
- 「再現しないから放置」

## フレーキーテスト修正の手順（必須）

フレーキーテストは発生確率が低いため、何度もテストを実行して失敗を待つのは非現実的かつ非効率である。**漫然とテストを何度も繰り返すことは厳に禁止する。**

### 修正の正しい手順

1. **網羅的なログの埋め込み**
   - フレーキーテストを修正する前に、**すべての関連箇所にログを仕込む**
   - 「すべての箇所」とは文字通りすべての箇所である。可能性のある経路をすべて網羅すること
   - 各関数の事前条件・事後条件、状態の変化、分岐の結果などを記録する
   - 目的：**1回のフレーキー発生時に、何が起きているかを完全に把握できる状態にする**

2. **ログを確認可能な状態でテストを実行**
   - ログを仕込んだ状態でテストを実行し、フレーキーが発生するまで待つ
   - フレーキーが発生したら、収集したログから**実際に何が起きているか**を分析する

3. **根本原因の特定と修正**
   - ログから根本原因を特定し、論理的に説明できる状態にする
   - 原因が特定できてから初めて修正を行う

### 禁止事項

- **ログを確認せずに当てずっぽうで修正することの禁止**
  - 「おそらくこれが原因だろう」という推測だけで修正してはならない
  - 修正後にテストが通っても、それが「たまたま通った」のか「本当に修正された」のか判別できない

- **ログが読めないことを理由にした妥協の禁止**
  - ログがCLIの標準出力に表示されずブラウザのDevToolsにしか表示されない場合でも、ログを読まずに修正を進めてはならない
  - ログを確認する手段を必ず確保すること

### ログが確認できない場合の対処

1. **まずログを確認できる方法を探す**
   - Service Workerのログは`console.log`で出力し、Playwrightの`serviceWorker.evaluate()`内で取得できないか検討する
   - ログをファイルに書き出す、メッセージで送信する等の代替手段を検討する

2. **それでも確認できない場合はユーザーに依頼する**
   - ユーザーへの確認依頼は**最後の手段**である
   - 「DevToolsでこのログを確認してください」と具体的に依頼する
   - 確認してもらった結果を元に原因を特定する

### 修正完了の判定

フレーキーテスト修正が完了したと言えるのは、以下をすべて満たす場合のみ：
- ログから根本原因を**確定的に**特定し、論理的に説明できる
- 修正内容が根本原因を**直接**解決している
- 修正後、50回以上のテスト実行で失敗が0回である

## テスト初期化パターン（必須）

テスト開始時は以下のパターンで初期化すること。ブラウザ起動時のデフォルトタブは閉じずに、assertTabStructureに含める。

```typescript
// ウィンドウIDと初期タブIDを取得
const windowId = await getCurrentWindowId(serviceWorker);
const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);

// ここからテスト用のタブを作成
const tab1 = await createTab(extensionContext, 'about:blank');
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: tab1, depth: 0 },
], 0);
```

**禁止**: 初期タブを動的に取得して持ち回すパターン
```typescript
// ❌ 禁止: 初期タブを動的に取得して配列に含める
const initialTabs = await serviceWorker.evaluate(...);
await assertTabStructure(sidePanelPage, windowId, [
  ...initialTabs.map(id => ({ tabId: id!, depth: 0 })),  // 禁止
  { tabId: newTab, depth: 0 },
], 0);
```

## 擬似サイドパネルタブとTreeState

PlaywrightではChrome拡張機能の本物のサイドパネルをテストできないため、`sidepanel.html`を通常のタブとして開く（擬似サイドパネルタブ）。

**重要**: サイドパネルタブ（`sidepanel.html`を開いているタブ）はTreeStateから**自動的に除外**される。これは`isOwnExtensionUrl()`と`isSidePanelUrl()`による判定で実現される。

- 本番環境: サイドパネルは実際のサイドパネルAPIで開かれるためタブとして存在しない
- E2Eテスト環境: 擬似サイドパネルタブはTreeStateから除外されるが、Chromeのタブとしては存在する

```typescript
// assertTabStructureにはサイドパネルタブを含めない
await assertTabStructure(sidePanelPage, windowId, [
  { tabId: initialBrowserTabId, depth: 0 },
  { tabId: testTab, depth: 0 },
], 0);

// Chromeタブ数とTreeStateタブ数を比較する場合は、サイドパネルタブを除外する
const browserTabCount = await serviceWorker.evaluate(async (windowId) => {
  const extensionId = chrome.runtime.id;
  const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
  const tabs = await chrome.tabs.query({ windowId });
  return tabs.filter(t => {
    const url = t.url || t.pendingUrl || '';
    return !url.startsWith(sidePanelUrlPrefix);
  }).length;
}, windowId);
```

## Playwrightデバッグコード禁止

`page.pause()`などユーザー操作を待機するデバッグ機能は使用禁止。

## リンククリックには`noWaitAfter: true`必須

リンクをクリックする際は`page.click(selector, { noWaitAfter: true })`を使用する。`noWaitAfter`なしだと`context.close()`が約4〜5秒遅延する。

`e2e/utils/tab-utils.ts`の`clickLinkToOpenTab`・`clickLinkToNavigate`は内部で対応済み。

## E2Eテスト実行時の結果確認（必須）

テスト結果は**リポジトリ内のログファイルに保存**してから確認する。出力を切り捨てると失敗テストの情報が失われ、再実行が必要になる。

**重要**: ログファイルは必ずリポジトリ内に保存すること。`/tmp/`や他のリポジトリ外のディレクトリへの書き込みは禁止。

```bash
# ✅ 正しい: ログをリポジトリ内に保存しながら実行
npm run test:e2e 2>&1 | tee e2e-test.log

# サマリーを確認
grep -E "failed|passed|skipped" e2e-test.log
```

```bash
# ❌ 禁止: 出力を切り捨てる方法（失敗テストの情報が失われる）
npm run test:e2e 2>&1 | tail -50
npm run test:e2e 2>&1 | head -100
npm run test:e2e 2>&1 | grep ...

# ❌ 禁止: リポジトリ外への書き込み
npm run test:e2e 2>&1 | tee /tmp/e2e-test.log
```

**テスト結果の解釈**:
- `0 failed` であることを必ず確認する
- passed数だけを見て判断してはいけない（テスト総数が変動するため）

### 複数回実行時のログ保存（必須）

フレーキーテスト確認のために複数回実行する場合、**各実行のログを個別ファイルに保存**すること。

```bash
# ✅ 正しい: 各実行のログを個別ファイルに保存
for i in {1..10}; do
  npm run test:e2e 2>&1 | tee e2e-run-$i.log
  grep -E "failed|passed" e2e-run-$i.log
done

# ✅ 正しい: 失敗が見つかったら保存済みログから調査
# 例: Run 3で失敗した場合
grep -B30 "failed" e2e-run-3.log  # エラー詳細を確認
```

```bash
# ❌ 禁止: ログを保存せずにサマリーだけを収集
for i in {1..10}; do
  npm run test:e2e 2>&1 | grep -E "passed|failed"
done

# ❌ 禁止: 失敗を検知しても詳細を追跡できない方法
for i in {1..10}; do
  echo "Run $i: $(npm run test:e2e 2>&1 | tail -1)"
done
```

**失敗時の調査ワークフロー**:
1. 失敗が発生したら、保存済みのログファイルから詳細を確認する
2. エラーメッセージ、スタックトレース、失敗したテスト名を特定する
3. 確率的に再現しない失敗でも、最初に保存したログから原因を調査できる状態にする
4. ログを保存せずに実行して失敗した場合、調査に必要な情報が失われる
