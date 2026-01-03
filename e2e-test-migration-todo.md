# E2Eテスト修正TODO

## 確認手順（必須）

**1つのチェックボックスを完了するたびに、必ず以下の手順を実行すること:**

1. このファイル（e2e-test-migration-todo.md）の先頭部分を再読み込みする
2. ステアリングドキュメント（docs/steering/tech.md）を再読み込みする
3. 上記の指示に従って、次のチェックボックスのテストを確認・修正する
4. もう一度1.から続ける（ステアリングドキュメントとこのファイルも必ず再読込する）

**チェック時の確認事項:**
- 禁止されたコメント（タスク番号、Requirements番号、TODO/FIXME/WIP）がないか
- `waitForTimeout`や`setTimeout`を使っていないか（ポーリングに置き換える）
- **各`createTab`呼び出しの直後に`assertTabStructure`を呼んでいるか**（複数回createTabを呼ぶ場合、各呼び出しの直後にassertTabStructureが必要）
- **各`moveTab`/ドラッグ操作の直後に`assertTabStructure`を呼んでいるか**
- **各`closeTab`/`removeTab`呼び出しの直後に`assertTabStructure`を呼んでいるか**（タブが0個になる場合も検証が必要）
- **その他各タブ操作の直後に`assertTabStructure`を呼んでいるか**
- **ピン留めタブ操作の後に`assertPinnedTabStructure`を呼んでいるか**
- **ビュー操作の後に`assertViewStructure`を呼んでいるか**
- **ウィンドウを閉じた後に`assertWindowClosed`を呼んでいるか**

## 事後条件確認関数の正しいシグネチャ

**すべての事後条件検証用関数は`e2e/utils/assertion-utils.ts`からインポートする。**

```typescript
import {
  assertTabStructure,
  assertPinnedTabStructure,
  assertViewStructure,
  assertWindowClosed,
  assertWindowExists,
} from './utils/assertion-utils';
```

### UIアサーション（Page + windowId が必須）

```typescript
// 通常タブのツリー構造を検証
await assertTabStructure(
  page,           // Page: サイドパネルのページ
  windowId,       // number: 対象ウィンドウID（必須）
  [               // ExpectedTabStructure[]: 期待する構造
    { tabId: tab1, depth: 0 },
    { tabId: tab2, depth: 1 },
  ],
  0,              // expectedActiveViewIndex: アクティブなビューのインデックス（必須）
  { timeout: 5000 }  // options?: オプション
);

// ピン留めタブの構造を検証
await assertPinnedTabStructure(
  page,           // Page
  windowId,       // number: 対象ウィンドウID（必須）
  [               // ExpectedPinnedTabStructure[]: 期待する構造
    { tabId: pinnedTab1 },
    { tabId: pinnedTab2 },
  ],
  0,              // expectedActiveViewIndex: アクティブなビューのインデックス（必須）
  { timeout: 5000 }  // options?: オプション
);

// ビューの構造を検証
await assertViewStructure(
  page,           // Page
  windowId,       // number: 対象ウィンドウID（必須）
  [               // ExpectedViewStructure[]: 期待する構造
    { viewId: view1, name: 'View 1' },
    { viewId: view2, name: 'View 2' },
  ],
  0,              // activeViewIndex: アクティブなビューのインデックス（必須）
  5000            // timeout?: タイムアウト
);
```

### Chrome APIアサーション（BrowserContext + windowId が必須）

```typescript
// ウィンドウが閉じられたことを検証
await assertWindowClosed(context, windowId, 5000);

// ウィンドウが存在することを検証
await assertWindowExists(context, windowId, 5000);
```

**重要:**
- `windowId`は**必須引数**であり、オプションではない。常に明示的にウィンドウIDを指定すること。
- `expectedActiveViewIndex`は**必須引数**であり、オプションではない。常に明示的にアクティブなビューのインデックスを指定すること。

## 具体例

```typescript
// ✅ 正しい: 各createTabの直後にassertTabStructure（windowIdとexpectedActiveViewIndexは必須）
const tab1 = await createTab(...);
await assertTabStructure(page, windowId, [{ tabId: tab1, depth: 0 }], 0);
const tab2 = await createTab(...);
await assertTabStructure(page, windowId, [{ tabId: tab1, depth: 0 }, { tabId: tab2, depth: 0 }], 0);

// ✅ 正しい: タブが0個になる場合も検証
await closeTab(context, lastTabId);
await assertTabStructure(page, windowId, [], 0);  // タブが0個であることを検証

// ✅ 正しい: ウィンドウを閉じた後にassertWindowClosed
await closeWindow(context, windowId);
await assertWindowClosed(context, windowId);

// ❌ 間違い: 複数のcreateTabをまとめてからassertTabStructure
const tab1 = await createTab(...);
const tab2 = await createTab(...);
await assertTabStructure(page, windowId, [...], 0);  // tab1作成後の検証が抜けている

// ❌ 間違い: windowIdやexpectedActiveViewIndexを省略
await assertTabStructure(page, [...]);  // windowIdとexpectedActiveViewIndexが必要
```

**重要:** `assertTabInTree`は`assertTabStructure`の代わりにはならない。
`assertTabInTree`はタブの存在確認のみ、`assertTabStructure`はタブの順序とdepthの検証を行う。

## 部分的な条件確認関数は禁止

**毎回全ての状態がどうなっているかを明示して事後条件を確認するべきです。**

`assertWindowTabCount`や`assertTabsInWindow`のような**一部の条件だけを確認する関数を作成・使用してはいけません**。

```typescript
// ❌ 禁止: 部分的な確認関数
assertWindowTabCount(context, windowId, 3);  // タブ数だけ確認
assertTabsInWindow(context, windowId, [tabId1, tabId2]);  // 特定タブの存在だけ確認

// ✅ 正解: 全ての状態を網羅的に確認
await assertTabStructure(page, windowId, [
  { tabId: tab1, depth: 0 },
  { tabId: tab2, depth: 1 },
  { tabId: tab3, depth: 0 },
], 0);
```

**理由**: 部分的な確認では見落としが発生する。「タブが3つある」ことを確認しても、順序やdepthが正しいかは不明。「特定のタブが存在する」ことを確認しても、余計なタブが存在しないかは不明。全ての状態を明示的に確認することで、意図しない状態変化を確実に検出できる。

## 目標
**move, create, close, その他タブ操作のあとに事後条件確認関数を呼ぶように修正する**
**ステアリングドキュメントの規約に乗っ取った形にテストを修正する**
- 書いてはならないタイプのコメントがあったら削除や変更を行う
- waitForTimeoutを使っている箇所も修正する
- 各種操作のあとには必ず事後条件確認用の関数を呼び出す。

## テスト一覧 (537テスト)

- [ ] active-tab-highlight.spec.ts:13:5 › アクティブタブのハイライト › 通常タブのハイライト › 通常タブがアクティブになった時に該当タブのみがハイライトされる
- [ ] active-tab-highlight.spec.ts:48:5 › アクティブタブのハイライト › 通常タブのハイライト › 通常タブをクリックするとそのタブのみがハイライトされる
- [ ] active-tab-highlight.spec.ts:102:5 › アクティブタブのハイライト › ピン留めタブのハイライト › ピン留めタブがアクティブになった時に該当ピン留めタブのみがハイライトされる
- [ ] active-tab-highlight.spec.ts:144:5 › アクティブタブのハイライト › ピン留めタブのハイライト › ピン留めタブをクリックするとそのピン留めタブのみがハイライトされる
- [ ] active-tab-highlight.spec.ts:206:5 › アクティブタブのハイライト › 通常タブとピン留めタブ間のハイライト切替 › 通常タブからピン留めタブに切り替えると、通常タブのハイライトが解除され、ピン留めタブがハイライトされる
- [ ] active-tab-highlight.spec.ts:266:5 › アクティブタブのハイライト › 通常タブとピン留めタブ間のハイライト切替 › ピン留めタブから通常タブに切り替えると、ピン留めタブのハイライトが解除され、通常タブがハイライトされる
- [ ] active-tab-highlight.spec.ts:326:5 › アクティブタブのハイライト › 通常タブとピン留めタブ間のハイライト切替 › 常に1つのタブのみがハイライト状態であることを確認（連続切替テスト）
- [ ] build-process.spec.ts:13:3 › ビルドプロセス統合 › dist/ディレクトリが存在し、ビルド成果物が含まれていること
- [ ] build-process.spec.ts:41:3 › ビルドプロセス統合 › globalSetup がビルドプロセスを実行すること
- [ ] build-process.spec.ts:50:3 › ビルドプロセス統合 › ビルドスクリプトが実行可能であること
- [ ] build-process.spec.ts:64:3 › ビルドプロセス統合 › ビルド失敗時にエラーメッセージが出力されること
- [ ] chrome-api-tabs.spec.ts:25:5 › chrome.tabs API統合 › chrome.tabs.create() › chrome.tabs.create()を呼び出した場合、新しいタブが作成される
- [ ] chrome-api-tabs.spec.ts:79:5 › chrome.tabs API統合 › chrome.tabs.create() › chrome.tabs.create()でopenerTabIdを指定した場合、親子関係が確立される
- [ ] chrome-api-tabs.spec.ts:111:5 › chrome.tabs API統合 › chrome.tabs.remove() › chrome.tabs.remove()を呼び出した場合、タブが削除される
- [ ] chrome-api-tabs.spec.ts:177:5 › chrome.tabs API統合 › chrome.tabs.remove() › chrome.tabs.remove()で複数タブを一括削除できる
- [ ] chrome-api-tabs.spec.ts:250:5 › chrome.tabs API統合 › chrome.tabs.update() › chrome.tabs.update()でURLを変更した場合、タブのURLが更新される
- [ ] chrome-api-tabs.spec.ts:296:5 › chrome.tabs API統合 › chrome.tabs.update() › chrome.tabs.update()でactiveを変更した場合、アクティブ状態が更新される
- [ ] chrome-api-tabs.spec.ts:365:5 › chrome.tabs API統合 › chrome.tabs.update() › chrome.tabs.update()でpinnedを変更した場合、ピン留め状態が更新される
- [ ] chrome-api-tabs.spec.ts:434:5 › chrome.tabs API統合 › chrome.tabs.query() › chrome.tabs.query()で全タブを取得できる
- [ ] chrome-api-tabs.spec.ts:476:5 › chrome.tabs API統合 › chrome.tabs.query() › chrome.tabs.query()でアクティブタブを取得できる
- [ ] chrome-api-tabs.spec.ts:515:5 › chrome.tabs API統合 › chrome.tabs.query() › chrome.tabs.query()でURLでフィルタリングできる
- [ ] chrome-api-tabs.spec.ts:571:5 › chrome.tabs API統合 › chrome.tabs.query() › chrome.tabs.query()でピン留めタブをフィルタリングできる
- [ ] chrome-api-tabs.spec.ts:616:5 › chrome.tabs API統合 › chrome.tabs.onCreated イベント › タブ作成時にonCreatedイベントが発火してツリーが更新される
- [ ] chrome-api-tabs.spec.ts:642:5 › chrome.tabs API統合 › chrome.tabs.onRemoved イベント › タブ削除時にonRemovedイベントが発火してツリーから削除される
- [ ] chrome-api-tabs.spec.ts:686:5 › chrome.tabs API統合 › chrome.tabs.onUpdated イベント › タブURL更新時にonUpdatedイベントが発火する
- [ ] chrome-api-tabs.spec.ts:732:5 › chrome.tabs API統合 › chrome.tabs.onActivated イベント › タブアクティブ化時にonActivatedイベントが発火する
- [ ] chrome-api-tabs.spec.ts:766:5 › chrome.tabs API統合 › chrome.tabs.onActivated イベント › 未読タブをアクティブ化すると未読状態がクリアされる
- [ ] chrome-api-tabs.spec.ts:824:5 › chrome.tabs API統合 › ツリー状態との統合 › タブ作成時にツリーにノードが追加される
- [ ] chrome-api-tabs.spec.ts:854:5 › chrome.tabs API統合 › ツリー状態との統合 › 親子関係付きでタブを作成するとツリー構造が正しく形成される
- [ ] chrome-api-tabs.spec.ts:891:5 › chrome.tabs API統合 › ツリー状態との統合 › タブ削除時にツリーからノードが削除される
- [ ] chrome-api-windows.spec.ts:18:3 › chrome.windows API統合 › chrome.windows.create()で新しいウィンドウを作成した場合、新しいウィンドウコンテキストが確立される
- [ ] chrome-api-windows.spec.ts:71:3 › chrome.windows API統合 › chrome.windows.remove()でウィンドウを閉じた場合、ウィンドウ内の全タブがツリーから削除される
- [ ] chrome-api-windows.spec.ts:166:3 › chrome.windows API統合 › chrome.windows.update()でウィンドウをフォーカスした場合、フォーカス状態が正しく更新される
- [ ] chrome-api-windows.spec.ts:231:3 › chrome.windows API統合 › chrome.windows.getAll()で全ウィンドウを取得した場合、全ウィンドウのタブが正しく列挙される
- [ ] chrome-api-windows.spec.ts:284:3 › chrome.windows API統合 › 複数ウィンドウが存在する場合、各ウィンドウのタブツリーが独立して管理される
- [ ] chrome-storage.spec.ts:18:5 › chrome.storage API統合 › chrome.storage.local.set() / get() › chrome.storage.local.set()で設定を保存した場合、設定が永続化される
- [ ] chrome-storage.spec.ts:64:5 › chrome.storage API統合 › chrome.storage.local.set() / get() › chrome.storage.local.get()で設定を読み込んだ場合、保存された設定値が取得される
- [ ] chrome-storage.spec.ts:102:5 › chrome.storage API統合 › chrome.storage.local.set() / get() › 存在しないキーを取得した場合、undefinedが返される
- [ ] chrome-storage.spec.ts:123:5 › chrome.storage API統合 › chrome.storage.local.set() / get() › デフォルト値を指定して取得した場合、存在しないキーにはデフォルト値が返される
- [ ] chrome-storage.spec.ts:159:5 › chrome.storage API統合 › chrome.storage.onChanged イベントハンドリング › chrome.storage.onChangedイベントが発火した場合、UIが最新の設定で更新される
- [ ] chrome-storage.spec.ts:207:5 › chrome.storage API統合 › chrome.storage.onChanged イベントハンドリング › 複数の設定変更が同時に行われた場合、すべてがUIに反映される
- [ ] chrome-storage.spec.ts:254:5 › chrome.storage API統合 › 複数の設定項目の一括保存 › 複数の設定項目を一括で保存した場合、トランザクション的に処理される
- [ ] chrome-storage.spec.ts:306:5 › chrome.storage API統合 › 複数の設定項目の一括保存 › 一括保存後に個別に読み込んでも整合性が保たれる
- [ ] chrome-storage.spec.ts:347:5 › chrome.storage API統合 › chrome.storage.local.remove() › 指定したキーのデータを削除できる
- [ ] chrome-storage.spec.ts:390:5 › chrome.storage API統合 › chrome.storage.local.clear() › すべてのデータをクリアできる
- [ ] chrome-storage.spec.ts:441:5 › chrome.storage API統合 › ストレージ容量の確認 › chrome.storage.local.getBytesInUse()で使用容量を取得できる
- [ ] config-validation.spec.ts:6:3 › Playwright Configuration › playwright.config.ts should exist and be valid
- [ ] config-validation.spec.ts:44:3 › Playwright Configuration › package.json should have @playwright/test in devDependencies
- [ ] config-validation.spec.ts:51:3 › Playwright Configuration › package.json should have E2E test scripts
- [ ] context-menu.spec.ts:19:3 › コンテキストメニュー操作 › タブノードを右クリックした場合、コンテキストメニューが表示される
- [ ] context-menu.spec.ts:61:3 › コンテキストメニュー操作 › コンテキストメニューから"タブを閉じる"を選択した場合、対象タブが閉じられる
- [ ] context-menu.spec.ts:110:3 › コンテキストメニュー操作 › コンテキストメニューから"サブツリーを閉じる"を選択した場合、対象タブとその全ての子孫タブが閉じられる
- [ ] context-menu.spec.ts:178:3 › コンテキストメニュー操作 › コンテキストメニューから"グループに追加"を選択した場合、グループ選択またはグループ作成のインタラクションが開始される
- [ ] context-menu.spec.ts:221:3 › コンテキストメニュー操作 › コンテキストメニューから"新しいウィンドウで開く"を選択した場合、タブが新しいウィンドウに移動する
- [ ] context-menu.spec.ts:277:3 › コンテキストメニュー操作 › コンテキストメニューから"URLをコピー"を選択した場合、クリップボードにURLがコピーされる
- [ ] context-menu.spec.ts:323:3 › コンテキストメニュー操作 › コンテキストメニューの外側をクリックした場合、メニューが閉じられる
- [ ] context-menu.spec.ts:384:3 › コンテキストメニュー操作 › Escapeキーを押した場合、コンテキストメニューが閉じられる
- [ ] cross-window-drag-drop.spec.ts:23:5 › Cross-Window Drag and Drop Tab Movement › DragSessionManager Integration › should start drag session with correct state
- [ ] cross-window-drag-drop.spec.ts:84:5 › Cross-Window Drag and Drop Tab Movement › DragSessionManager Integration › should get current drag session
- [ ] cross-window-drag-drop.spec.ts:152:5 › Cross-Window Drag and Drop Tab Movement › DragSessionManager Integration › should end drag session and return null on get
- [ ] cross-window-drag-drop.spec.ts:223:5 › Cross-Window Drag and Drop Tab Movement › Cross-Window Move Operations › should move tab to destination window via BEGIN_CROSS_WINDOW_MOVE
- [ ] cross-window-drag-drop.spec.ts:327:5 › Cross-Window Drag and Drop Tab Movement › Cross-Window Move Operations › should detect cross-window drag from different window
- [ ] cross-window-drag-drop.spec.ts:413:5 › Cross-Window Drag and Drop Tab Movement › Cross-Window Move Operations › tab should belong to destination window after cross-window move
- [ ] cross-window-drag-drop.spec.ts:537:5 › Cross-Window Drag and Drop Tab Movement › UI Tree Synchronization › moved tab should appear in destination window tree and disappear from source
- [ ] cross-window-drag-drop.spec.ts:590:5 › Cross-Window Drag and Drop Tab Movement › UI Tree Synchronization › tab tree should reflect correct window after cross-window move via session
- [ ] cross-window-drag-drop.spec.ts:699:5 › Cross-Window Drag and Drop Tab Movement › Session Lifecycle › cross-window drag state should be cleared after session end
- [ ] cross-window-drag-drop.spec.ts:800:5 › Cross-Window Drag and Drop Tab Movement › Session Lifecycle › should handle session replacement when new session starts
- [ ] cross-window-drag-indicator.spec.ts:23:5 › Cross-Window Drag Indicator › DragSessionManager State Synchronization › drag session should be synchronized via Service Worker
- [ ] cross-window-drag-indicator.spec.ts:118:5 › Cross-Window Drag Indicator › Cross-Window Drag State Detection › side panel should be able to detect cross-window drag state
- [ ] cross-window-drag-indicator.spec.ts:208:5 › Cross-Window Drag Indicator › Cross-Window Drag State Detection › cross-window drag session should include source window information
- [ ] cross-window-drag-indicator.spec.ts:321:5 › Cross-Window Drag Indicator › Cross-Window Drag Indicator Display › destination window should recognize cross-window drag origin
- [ ] cross-window-drag-indicator.spec.ts:426:5 › Cross-Window Drag Indicator › Cross-Window Drag Indicator Display › drag session should maintain state across window queries
- [ ] cross-window.spec.ts:18:3 › クロスウィンドウドラッグ&ドロップ › タブを別ウィンドウに移動した場合、元のウィンドウのツリーから削除され、移動先ウィンドウのツリーに追加される
- [ ] cross-window.spec.ts:92:3 › クロスウィンドウドラッグ&ドロップ › 子タブを持つ親タブを別ウィンドウに移動した場合、親タブのみが移動する
- [ ] cross-window.spec.ts:187:3 › クロスウィンドウドラッグ&ドロップ › 複数ウィンドウ間でタブを移動した後、各ウィンドウのツリー状態が正しく同期される
- [ ] cross-window.spec.ts:266:3 › クロスウィンドウドラッグ&ドロップ › タブを別ウィンドウから元のウィンドウに戻すことができる
- [ ] cross-window.spec.ts:318:3 › クロスウィンドウドラッグ&ドロップ › ウィンドウを閉じた後、残りのウィンドウのツリー状態が正しい
- [ ] directory-structure.spec.ts:15:3 › E2Eディレクトリ構造 › 必要なサブディレクトリが存在すること
- [ ] directory-structure.spec.ts:27:3 › E2Eディレクトリ構造 › README.mdが存在すること
- [ ] directory-structure.spec.ts:32:3 › E2Eディレクトリ構造 › テストファイルの命名規則が正しいこと
- [ ] discarded-tab.spec.ts:29:3 › 休止タブの視覚的区別 › 休止状態のタブはグレーアウト表示される
- [ ] discarded-tab.spec.ts:132:3 › 休止タブの視覚的区別 › 休止タブをアクティブ化するとグレーアウトが解除される
- [ ] drag-drop-child-independent.spec.ts:22:3 › 子タブの独立ドラッグ操作 › 子タブをドラッグした際に親タブを追従させず、子タブのみ移動可能にすること
- [ ] drag-drop-child-independent.spec.ts:103:3 › 子タブの独立ドラッグ操作 › 子タブを親から切り離して別の位置にドロップできること
- [ ] drag-drop-child-independent.spec.ts:182:3 › 子タブの独立ドラッグ操作 › 孫タブをドラッグして別の親の子として移動できること
- [ ] drag-drop-child-independent.spec.ts:264:3 › 子タブの独立ドラッグ操作 › 子タブを移動しても元の親タブは移動しないこと
- [ ] drag-drop-child-independent.spec.ts:349:3 › 親子関係解消の永続化 › ドラッグで親子関係を解消し、ルートレベルに移動後も状態が維持されること
- [ ] drag-drop-child-independent.spec.ts:413:3 › 親子関係解消の永続化 › 親子関係解消後、元子タブからの操作で元親タブの子にならないこと
- [ ] drag-drop-child-independent.spec.ts:478:3 › 親子関係解消の永続化 › 親子関係解消が永続化され、ストレージに正しく反映されること
- [ ] drag-drop-child-independent.spec.ts:592:3 › 元子タブからの新規タブ作成 › 親子関係解消後、元子タブからリンクを開くと元子タブの子タブになること
- [ ] drag-drop-child-independent.spec.ts:690:3 › 元子タブからの新規タブ作成 › 親子関係解消後の元子タブからリンクを開いても元親タブの子にならないこと
- [ ] drag-drop-child-independent.spec.ts:810:3 › 親子関係解消の永続化（包括的テスト） › 複数回の親子関係解消と再構築が一貫して動作すること
- [ ] drag-drop-child-independent.spec.ts:919:3 › 親子関係解消の永続化（包括的テスト） › 親子関係解消後の元子タブから作成した新規タブがさらに子タブを持てること
- [ ] drag-drop-child-independent.spec.ts:1043:3 › 親子関係解消の永続化（包括的テスト） › 親子関係解消後も別のタブへの親子関係構築が正しく動作すること
- [ ] drag-drop-child-reorder.spec.ts:114:5 › 子タブの並び替え・ドロップ位置テスト › 子を親の直上にドロップ → 最後の子として配置 › 子タブを親タブの直上にドロップすると、最後の子として配置されること
- [ ] drag-drop-child-reorder.spec.ts:175:5 › 子タブの並び替え・ドロップ位置テスト › 子を親の直上にドロップ → 最後の子として配置 › 複数の子がある場合、任意の子を親にドロップすると最後の子になること
- [ ] drag-drop-child-reorder.spec.ts:235:5 › 子タブの並び替え・ドロップ位置テスト › 子を隙間にドロップ → 兄弟として配置 › 子タブを親の上の隙間にドロップすると、親の兄弟として配置されること
- [ ] drag-drop-child-reorder.spec.ts:286:5 › 子タブの並び替え・ドロップ位置テスト › 子を隙間にドロップ → 兄弟として配置 › タブAとタブBの間に子タブをドロップすると、その位置に兄弟として配置されること
- [ ] drag-drop-child-reorder.spec.ts:337:5 › 子タブの並び替え・ドロップ位置テスト › 子を隙間にドロップ → 兄弟として配置 › リスト末尾の隙間に子タブをドロップすると、末尾に兄弟として配置されること
- [ ] drag-drop-child-reorder.spec.ts:383:5 › 子タブの並び替え・ドロップ位置テスト › 複合シナリオ: サブツリーの移動 › サブツリー（親+子）を別の位置にドロップしても、サブツリー内の親子関係は維持されること
- [ ] drag-drop-child-reorder.spec.ts:449:5 › 子タブの並び替え・ドロップ位置テスト › 複合シナリオ: サブツリーの移動 › ネストしたサブツリーを親の直上にドロップすると、最後の子として配置されること
- [ ] drag-drop-complex.spec.ts:19:3 › ドラッグ&ドロップによる複雑なツリー移動 › 子タブを持つ親タブを移動した場合、サブツリー全体が一緒に移動することを検証する
- [ ] drag-drop-complex.spec.ts:131:3 › ドラッグ&ドロップによる複雑なツリー移動 › サブツリーをルートレベルにドロップした場合、元の親子関係から切り離され、ルートノードとして配置されることを検証する
- [ ] drag-drop-complex.spec.ts:233:3 › ドラッグ&ドロップによる複雑なツリー移動 › あるサブツリーを別のサブツリー内に移動した場合、サブツリー全体が移動することを検証する
- [ ] drag-drop-complex.spec.ts:341:3 › ドラッグ&ドロップによる複雑なツリー移動 › 親タブを自分の子孫タブにドロップしようとした場合、循環参照を防ぐため操作が拒否されることを検証する
- [ ] drag-drop-complex.spec.ts:452:3 › ドラッグ&ドロップによる複雑なツリー移動 › サブツリーを移動した場合、サブツリー構造が維持されることを検証する
- [ ] drag-drop-cross-depth.spec.ts:20:3 › ドラッグ&ドロップによる異なる深さ間の移動 › 異なる深さのノード間のギャップにサブツリーをドロップした場合、下のノードの親の子として配置されること
- [ ] drag-drop-cross-depth.spec.ts:196:3 › ドラッグ&ドロップによる異なる深さ間の移動 › サブツリーを別の親の子ノード間のギャップにドロップした場合、その親の子として配置されサブツリー構造が維持されること
- [ ] drag-drop-external.spec.ts:24:3 › ツリービュー外へのドラッグ&ドロップ › タブをサイドパネル外にドロップした際に新しいウィンドウが作成されること
- [ ] drag-drop-external.spec.ts:77:3 › ツリービュー外へのドラッグ&ドロップ › ドロップしたタブが新しいウィンドウに正確に移動されること
- [ ] drag-drop-external.spec.ts:197:3 › ツリービュー外へのドラッグ&ドロップ › サイドパネル内の空白領域（タブツリー下部）へのドラッグでは新規ウィンドウを作成しないこと
- [ ] drag-drop-hierarchy.spec.ts:24:3 › ドラッグ&ドロップによる階層変更（親子関係の作成） › タブを別のタブに重ねてドロップした場合、ドロップ先タブの子として配置されること
- [ ] drag-drop-hierarchy.spec.ts:65:3 › ドラッグ&ドロップによる階層変更（親子関係の作成） › 子タブを持たないタブに初めて子タブを追加した場合、親タブに展開/折りたたみアイコンが表示されること
- [ ] drag-drop-hierarchy.spec.ts:106:3 › ドラッグ&ドロップによる階層変更（親子関係の作成） › 折りたたまれた親タブに子タブをドロップした場合、親タブが自動的に展開されること
- [ ] drag-drop-hierarchy.spec.ts:158:3 › ドラッグ&ドロップによる階層変更（親子関係の作成） › 既に子を持つ親タブに新しい子をドロップした場合、子タブリストに追加されること
- [ ] drag-drop-hierarchy.spec.ts:207:3 › ドラッグ&ドロップによる階層変更（親子関係の作成） › 深い階層のタブを別の親にドロップした場合、depthが正しく再計算されること
- [ ] drag-drop-hierarchy.spec.ts:310:3 › ドラッグ&ドロップによる階層変更（親子関係の作成） › D&Dで親子関係を作成した後、新規タブを開いても既存の親子関係が維持されること
- [ ] drag-drop-hierarchy.spec.ts:525:3 › ドラッグ&ドロップによる階層変更（親子関係の作成） › D&Dで複数の親子関係を作成した後、新規タブを開いても全ての親子関係が維持されること
- [ ] drag-drop-hierarchy.spec.ts:653:3 › ドラッグ&ドロップによる階層変更（親子関係の作成） › D&Dで親子関係を作成した後、別のタブを閉じても既存の親子関係が維持されること
- [ ] drag-drop-hierarchy.spec.ts:789:3 › ドラッグ&ドロップによる階層変更（親子関係の作成） › D&Dで親子関係を作成した後、新しいウィンドウを開いても既存の親子関係が維持されること
- [ ] drag-drop-hierarchy.spec.ts:916:3 › ドラッグ&ドロップによる階層変更（親子関係の作成） › D&Dで親子関係を作成した後、SYNC_TABSメッセージを送信しても既存の親子関係が維持されること
- [ ] drag-drop-hierarchy.spec.ts:998:3 › ドラッグ&ドロップによる階層変更（親子関係の作成） › ストレージが破損した場合、背景の正しい状態から復元されること
- [ ] drag-drop-hover.spec.ts:172:3 › ドラッグ&ドロップのホバー自動展開 › 折りたたまれた親タブの上にタブをホバーした場合、一定時間後に自動的に展開されること
- [ ] drag-drop-hover.spec.ts:250:3 › ドラッグ&ドロップのホバー自動展開 › 自動展開のタイムアウト前にホバーを離れた場合、その時点では展開されていないこと
- [ ] drag-drop-hover.spec.ts:360:3 › ドラッグ&ドロップのホバー自動展開 › 深いツリー構造でルートノードへのホバーにより自動展開が機能すること
- [ ] drag-drop-improvements.spec.ts:66:5 › ドラッグ&ドロップ改善 › 隙間ドロップのインジケーター表示 › タブとタブの間にドラッグすると、ドロップインジケーターが表示されること
- [ ] drag-drop-improvements.spec.ts:103:5 › ドラッグ&ドロップ改善 › 隙間ドロップのインジケーター表示 › タブの上にホバーするとタブがハイライト表示されること
- [ ] drag-drop-improvements.spec.ts:141:5 › ドラッグ&ドロップ改善 › ドラッグ中のタブ位置固定 › ドラッグ中に他のタブの表示位置が変更されないこと
- [ ] drag-drop-improvements.spec.ts:188:5 › ドラッグ&ドロップ改善 › ドラッグ中のタブ位置固定 › ドロップ時にのみツリー構造が再構築されること
- [ ] drag-drop-improvements.spec.ts:238:5 › ドラッグ&ドロップ改善 › ドラッグ中の横スクロール防止 › ドラッグ中にoverflow-x: hiddenが適用されること
- [ ] drag-drop-improvements.spec.ts:288:5 › ドラッグ&ドロップ改善 › ドラッグ中の横スクロール防止 › ドラッグ中にマウスを左右に動かしてもビューが横スクロールしないこと
- [ ] drag-drop-improvements.spec.ts:324:5 › ドラッグ&ドロップ改善 › ドラッグ中の横スクロール防止 › ドラッグ終了後に通常のスクロール動作が復元されること
- [ ] drag-drop-improvements.spec.ts:357:5 › ドラッグ&ドロップ改善 › depthの視覚的フィードバック › 子タブをドラッグして隙間にホバーするとインジケーターがdepthに応じてインデントされること
- [ ] drag-drop-indicator-position.spec.ts:95:5 › ドラッグ&ドロップ - プレースホルダー位置精度 › サブツリーをドラッグ中のプレースホルダー位置 › サブツリーを持つタブをドラッグ中に、サブツリーの上の隙間にホバーするとプレースホルダーが正しい位置に表示されること
- [ ] drag-drop-indicator-position.spec.ts:188:5 › ドラッグ&ドロップ - プレースホルダー位置精度 › ドラッグ中のタブの隣接位置へのドロップ › タブBをドラッグ中にタブAとタブBの間にホバーするとプレースホルダーがタブAとタブBの間に表示されること
- [ ] drag-drop-indicator-position.spec.ts:248:5 › ドラッグ&ドロップ - プレースホルダー位置精度 › ドラッグ中のタブの隣接位置へのドロップ › タブBをドラッグ中にタブBとタブCの間にホバーするとプレースホルダーがタブBとタブCの間に表示されること
- [ ] drag-drop-indicator-position.spec.ts:309:5 › ドラッグ&ドロップ - プレースホルダー位置精度 › 複数の隙間を連続でホバーした場合のプレースホルダー位置 › ドラッグ中に複数の隙間をホバーするとプレースホルダーが正しく追従すること
- [ ] drag-drop-insert.spec.ts:104:5 › ドラッグ&ドロップ - タブ挿入 › タブの挿入位置 › タブをドロップすると、ドロップ操作が正常に完了すること
- [ ] drag-drop-insert.spec.ts:139:5 › ドラッグ&ドロップ - タブ挿入 › タブの挿入位置 › ドロップ後もすべてのタブが正しく表示されること
- [ ] drag-drop-insert.spec.ts:171:5 › ドラッグ&ドロップ - タブ挿入 › タブの挿入位置 › ドロップ後にタブのツリー構造が維持されること
- [ ] drag-drop-insert.spec.ts:209:5 › ドラッグ&ドロップ - タブ挿入 › ツリー構造とブラウザタブ順序の同期 › ドロップ後のツリー状態がストレージと同期されていること
- [ ] drag-drop-insert.spec.ts:258:5 › ドラッグ&ドロップ - タブ挿入 › ツリー構造とブラウザタブ順序の同期 › 複数回のドロップ操作後もすべてのタブが保持されること
- [ ] drag-drop-insert.spec.ts:302:5 › ドラッグ&ドロップ - タブ挿入 › ツリー構造とブラウザタブ順序の同期 › 子タブとして配置した場合も順序が正しく同期されること
- [ ] drag-drop-placeholder.spec.ts:98:5 › ドラッグ&ドロップ - プレースホルダー表示 › 有効なドロップ位置にのみプレースホルダーを表示 › タブとタブの隙間にドラッグするとプレースホルダーが表示されること
- [ ] drag-drop-placeholder.spec.ts:138:5 › ドラッグ&ドロップ - プレースホルダー表示 › 有効なドロップ位置にのみプレースホルダーを表示 › 最初のタブの上にドラッグするとプレースホルダーが表示されること
- [ ] drag-drop-placeholder.spec.ts:180:5 › ドラッグ&ドロップ - プレースホルダー表示 › ドロップターゲットとなるタブのハイライト表示 › タブの中央にドラッグするとタブがハイライト表示されること
- [ ] drag-drop-placeholder.spec.ts:214:5 › ドラッグ&ドロップ - プレースホルダー表示 › ドロップターゲットとなるタブのハイライト表示 › タブからマウスを離すとハイライトが解除されること
- [ ] drag-drop-placeholder.spec.ts:267:5 › ドラッグ&ドロップ - プレースホルダー表示 › プレースホルダー位置の正確性 › プレースホルダーの位置がタブ間の正確な位置にあること
- [ ] drag-drop-placeholder.spec.ts:317:5 › ドラッグ&ドロップ - プレースホルダー表示 › プレースホルダー位置の正確性 › マウスを別の隙間に移動するとプレースホルダーも移動すること
- [ ] drag-drop-placeholder.spec.ts:371:5 › ドラッグ&ドロップ - プレースホルダー表示 › プレースホルダー位置の正確性 › 不正な位置（コンテナ外）ではプレースホルダーが表示されないこと
- [ ] drag-drop-reorder.spec.ts:21:3 › ドラッグ&ドロップによるタブの並び替え（同階層） › ルートレベルのタブを別のルートレベルのタブ間にドロップした場合、タブの表示順序が変更されること
- [ ] drag-drop-reorder.spec.ts:66:3 › ドラッグ&ドロップによるタブの並び替え（同階層） › 子タブを同じ親の他の子タブ間にドロップした場合、兄弟タブ間での順序が変更されること
- [ ] drag-drop-reorder.spec.ts:136:3 › ドラッグ&ドロップによるタブの並び替え（同階層） › 複数の子を持つサブツリー内でタブを並び替えた場合、他の子タブの順序が正しく調整されること
- [ ] drag-drop-reorder.spec.ts:218:3 › ドラッグ&ドロップによるタブの並び替え（同階層） › ドラッグ中にis-draggingクラスが付与され、視覚的なフィードバックが表示されること
- [ ] drag-drop-reorder.spec.ts:254:3 › ドラッグ&ドロップによるタブの並び替え（同階層） › タブを自分より後ろの隙間にドロップした場合、正しい位置に配置されること
- [ ] drag-drop-scroll.spec.ts:89:3 › ドラッグ＆ドロップ中のスクロール制限 › ドラッグ中に横スクロールが発生しないことを検証する
- [ ] drag-drop-scroll.spec.ts:131:3 › ドラッグ＆ドロップ中のスクロール制限 › ドラッグ中にツリービューが必要以上に縦スクロールしないことを検証する
- [ ] drag-drop-scroll.spec.ts:189:3 › ドラッグ＆ドロップ中のスクロール制限 › コンテンツがビューポートを超えている場合のみスクロールが許可されることを検証する
- [ ] drag-drop-scroll.spec.ts:271:3 › ドラッグ＆ドロップ中のスクロール制限 › ドラッグ中のスクロール加速度が制限されていることを検証する
- [ ] drag-drop-subtree.spec.ts:22:3 › ドラッグ&ドロップによるサブツリー移動 › 折りたたまれた親タブをドラッグした場合、非表示の子タブも含めてサブツリー全体が移動すること
- [ ] drag-drop-subtree.spec.ts:120:3 › ドラッグ&ドロップによるサブツリー移動 › 展開された親タブをドラッグした場合、可視の子タブも含めてサブツリー全体が移動すること
- [ ] drag-drop-subtree.spec.ts:206:3 › ドラッグ&ドロップによるサブツリー移動 › サブツリーを下方向にドラッグした場合、正しい移動数で正しい位置に配置されること
- [ ] drag-drop-subtree.spec.ts:310:3 › ドラッグ&ドロップによるサブツリー移動 › 深いネストのサブツリーを移動した場合、全ての子孫が一緒に移動すること
- [ ] drag-tab-size-stability.spec.ts:53:5 › ドラッグ中のタブサイズ安定性 › タブサイズの一貫性 › ドラッグ開始前後でタブのサイズが変化しないこと
- [ ] drag-tab-size-stability.spec.ts:93:5 › ドラッグ中のタブサイズ安定性 › タブサイズの一貫性 › 親子関係形成時にドラッグ中のタブサイズが変化しないこと
- [ ] drag-tab-size-stability.spec.ts:132:5 › ドラッグ中のタブサイズ安定性 › タブサイズの一貫性 › ホバーターゲットが変化してもドラッグ中のタブサイズが一定であること
- [ ] drag-tab-size-stability.spec.ts:179:5 › ドラッグ中のタブサイズ安定性 › ハイライト表示時のサイズ安定性 › ターゲットタブがハイライトされてもサイズが変化しないこと
- [ ] drag-tab-size-stability.spec.ts:216:5 › ドラッグ中のタブサイズ安定性 › ハイライト表示時のサイズ安定性 › ハイライトが解除された後もサイズが元に戻ること
- [ ] empty-window-auto-close.spec.ts:22:5 › Empty Window Auto Close › Auto close window when all tabs moved via drag-out › should auto close window when single tab is dragged out via CREATE_WINDOW_WITH_SUBTREE
- [ ] empty-window-auto-close.spec.ts:108:5 › Empty Window Auto Close › Auto close window when all tabs moved via drag-out › should auto close window when subtree with multiple tabs is dragged out
- [ ] empty-window-auto-close.spec.ts:229:5 › Empty Window Auto Close › Keep window open when tabs remain › should NOT close window when some tabs remain after drag-out
- [ ] empty-window-auto-close.spec.ts:318:5 › Empty Window Auto Close › Keep window open when tabs remain › should NOT auto-close window when sourceWindowId is not provided
- [ ] empty-window-auto-close.spec.ts:387:5 › Empty Window Auto Close › Auto close window when all tabs are closed › should auto close window when last tab is closed via chrome.tabs.remove
- [ ] empty-window-auto-close.spec.ts:442:5 › Empty Window Auto Close › Auto close window when all tabs are closed › should NOT close last remaining window (browser protection)
- [ ] empty-window-auto-close.spec.ts:514:5 › Empty Window Auto Close › Auto close window when all tabs are closed › should NOT close window when tabs remain
- [ ] empty-window-auto-close.spec.ts:580:5 › Empty Window Auto Close › Suppress auto-close during drag and close on drag end › extension auto-close triggered on END_DRAG_SESSION when source window is empty
- [ ] empty-window-auto-close.spec.ts:696:5 › Empty Window Auto Close › Suppress auto-close during drag and close on drag end › should NOT close source window after drag if tabs still remain
- [ ] empty-window-auto-close.spec.ts:810:5 › Empty Window Auto Close › Edge Cases › should handle non-existent sourceWindowId gracefully
- [ ] empty-window-auto-close.spec.ts:867:5 › Empty Window Auto Close › Keep window open when only pinned tabs remain › should NOT close window when only pinned tabs remain after normal tabs are moved
- [ ] empty-window-auto-close.spec.ts:966:5 › Empty Window Auto Close › Keep window open when only pinned tabs remain › should NOT close window when only pinned tabs remain after normal tabs are closed
- [ ] error-handling.spec.ts:15:3 › エラーハンドリングとエッジケース › 長いタブタイトルがある場合、タブノードが正常に表示される
- [ ] error-handling.spec.ts:59:3 › エラーハンドリングとエッジケース › 無効なURLのタブがある場合、タブノードが正常に表示される
- [ ] error-handling.spec.ts:101:3 › エラーハンドリングとエッジケース › data URLのタブでもツリーに正常に表示される
- [ ] error-handling.spec.ts:122:3 › エラーハンドリングとエッジケース › タブがロード中の場合、ローディングインジケータが表示される
- [ ] error-handling.spec.ts:163:3 › エラーハンドリングとエッジケース › タブが存在しないIDで操作された場合、エラーが適切に処理される
- [ ] error-handling.spec.ts:185:3 › エラーハンドリングとエッジケース › 特殊文字を含むタブタイトルが正しく表示される
- [ ] error-handling.spec.ts:212:3 › エラーハンドリングとエッジケース › 空のタイトルを持つタブでもツリーに表示される
- [ ] error-handling.spec.ts:234:3 › エラーハンドリングとエッジケース › Unicode文字を含むタブタイトルが正しく表示される
- [ ] extension-fixture.spec.ts:11:3 › ExtensionFixture › 拡張機能がロードされ、Extension IDが取得できること
- [ ] extension-fixture.spec.ts:18:3 › ExtensionFixture › Service Workerが起動完了していること
- [ ] extension-fixture.spec.ts:40:3 › ExtensionFixture › Side Panelページが正しく開けること
- [ ] extension-fixture.spec.ts:74:3 › ExtensionFixture › ブラウザコンテキストが正しく設定されていること
- [ ] extension-fixture.spec.ts:93:3 › ExtensionFixture › 複数のテストで独立したコンテキストが提供されること
- [ ] extension-fixture.spec.ts:115:3 › ExtensionFixture › 拡張機能のmanifestが正しく読み込まれていること
- [ ] favicon-restore.spec.ts:16:5 › ファビコンの永続化復元 › ブラウザ再起動後にファビコンが永続化データから復元される › ストレージに保存されたファビコンがUIに反映されること
- [ ] favicon-restore.spec.ts:51:5 › ファビコンの永続化復元 › ブラウザ再起動後にファビコンが永続化データから復元される › ファビコンが永続化ストレージに正しく保存されること
- [ ] favicon-restore.spec.ts:87:5 › ファビコンの永続化復元 › タブがロードされていない状態でも永続化されていた画像を表示 › discardされたタブでも永続化ファビコンが表示されること
- [ ] favicon-restore.spec.ts:128:5 › ファビコンの永続化復元 › ファビコン永続化と復元のE2Eテスト検証 › 複数タブのファビコンが正しく永続化されること
- [ ] favicon-restore.spec.ts:176:5 › ファビコンの永続化復元 › ファビコン永続化と復元のE2Eテスト検証 › タブを閉じた際にファビコンデータが削除されること
- [ ] favicon-restore.spec.ts:227:5 › ファビコンの永続化復元 › ファビコン永続化と復元のE2Eテスト検証 › ファビコンの更新が正しく永続化されること
- [ ] favicon-restore.spec.ts:285:5 › ファビコンの永続化復元 › ファビコン永続化復元と表示 › 永続化されたファビコンがUI上のimgタグに正しく表示されること
- [ ] favicon-restore.spec.ts:342:5 › ファビコンの永続化復元 › ファビコン永続化復元と表示 › タブ情報にfavIconUrlがない場合でも永続化ファビコンが表示されること
- [ ] favicon-restore.spec.ts:402:5 › ファビコンの永続化復元 › ファビコン永続化復元と表示 › タブがロードされた後に新しいファビコンで表示が更新されること
- [ ] favicon-restore.spec.ts:481:5 › ファビコンの永続化復元 › ファビコン永続化復元UIテスト › ストレージに保存されたファビコンがサイドパネルリロード後もUIに反映されること
- [ ] favicon-restore.spec.ts:538:5 › ファビコンの永続化復元 › ファビコン永続化復元UIテスト › ファビコン永続化の読み書きが正しく動作すること
- [ ] favicon-restore.spec.ts:581:5 › ファビコンの永続化復元 › ファビコン永続化復元UIテスト › タブを閉じた際に永続化ファビコンデータが自動的にクリーンアップされること
- [ ] gap-drop-accuracy.spec.ts:83:5 › Gapドロップ精度のE2Eテスト › タブ間隙間へのドロップで正確な位置に配置されること › タブをGap領域にドロップすると、ドロップ操作が正常に完了すること
- [ ] gap-drop-accuracy.spec.ts:121:5 › Gapドロップ精度のE2Eテスト › タブ間隙間へのドロップで正確な位置に配置されること › タブをGap領域（after位置）にドロップすると、正常に完了すること
- [ ] gap-drop-accuracy.spec.ts:154:5 › Gapドロップ精度のE2Eテスト › タブ間隙間へのドロップで正確な位置に配置されること › 複数回のGapドロップを連続で行ってもすべてのタブが保持されること
- [ ] gap-drop-accuracy.spec.ts:192:5 › Gapドロップ精度のE2Eテスト › 異なる深度の隙間へのドロップを検証 › 親子関係があるツリーでGapドロップが正しく動作すること
- [ ] gap-drop-accuracy.spec.ts:244:5 › Gapドロップ精度のE2Eテスト › 異なる深度の隙間へのドロップを検証 › 子タブとして配置した後もGapドロップが動作すること
- [ ] gap-drop-accuracy.spec.ts:298:5 › Gapドロップ精度のE2Eテスト › テストの安定性 › Gapドロップ後にすべてのタブがUIに表示され続けること
- [ ] gap-drop-accuracy.spec.ts:344:5 › Gapドロップ精度のE2Eテスト › テストの安定性 › 高速な連続Gapドロップ操作でも安定して動作すること
- [ ] gap-drop-accuracy.spec.ts:394:5 › Gapドロップ精度のE2Eテスト › テストの安定性 › ドロップインジケーターがGap位置に正しく表示されること
- [ ] ghost-tab-cleanup.spec.ts:16:5 › Ghost Tab Cleanup › Chrome APIに存在しないタブをツリーから削除 › ストレージにのみ存在するゴーストタブが起動時にクリーンアップされること
- [ ] ghost-tab-cleanup.spec.ts:148:5 › Ghost Tab Cleanup › 初期化時にツリー内の全タブIDをChrome APIで検証 › TreeStateManager.cleanupStaleNodesが正しくゴーストタブを削除すること
- [ ] ghost-tab-cleanup.spec.ts:186:5 › Ghost Tab Cleanup › Loadingのまま消せないゴーストタブの発生を防止 › Side Panelに表示されているタブがすべてChrome APIに存在すること
- [ ] ghost-tab-cleanup.spec.ts:215:5 › Ghost Tab Cleanup › Loadingのまま消せないゴーストタブの発生を防止 › タブツリーにLoadingのまま動かないタブが存在しないこと
- [ ] ghost-tab-cleanup.spec.ts:252:5 › Ghost Tab Cleanup › 統合テスト: 複数のゴーストタブのクリーンアップ › 複数のゴーストタブが一度にクリーンアップされること
- [ ] headless-mode.spec.ts:51:3 › headlessモードの設定検証 › HEADED=true環境変数でheadedモードに切り替わること
- [ ] headless-mode.spec.ts:89:3 › headlessモードの設定検証 › CI環境変数が設定されている場合、適切な設定が適用されること
- [ ] indexeddb.spec.ts:45:5 › IndexedDB統合 › IndexedDB基本操作 › IndexedDBにデータを保存できる
- [ ] indexeddb.spec.ts:103:5 › IndexedDB統合 › IndexedDB基本操作 › IndexedDBからデータを読み込める
- [ ] indexeddb.spec.ts:197:5 › IndexedDB統合 › IndexedDB基本操作 › IndexedDBからデータを削除できる
- [ ] indexeddb.spec.ts:314:5 › IndexedDB統合 › 大量データの処理 › 100個のスナップショットデータを処理できる
- [ ] indexeddb.spec.ts:390:5 › IndexedDB統合 › 大量データの処理 › 大量データの読み込みがパフォーマンス要件を満たす
- [ ] indexeddb.spec.ts:451:5 › IndexedDB統合 › エラーハンドリング › IndexedDBが利用可能であることを確認
- [ ] indexeddb.spec.ts:467:5 › IndexedDB統合 › エラーハンドリング › 不正なデータベースバージョンでのエラーハンドリング
- [ ] indexeddb.spec.ts:504:5 › IndexedDB統合 › データ永続化 › データベースを閉じて再度開いてもデータが保持される
- [ ] indexeddb.spec.ts:605:5 › IndexedDB統合 › データ永続化 › 複数のトランザクションが順序通り処理される
- [ ] indexeddb.spec.ts:669:5 › IndexedDB統合 › 同時アクセス › 同時アクセス時のデータ整合性
- [ ] multi-selection.spec.ts:16:3 › 複数選択機能 › Shift+クリックで範囲選択ができる
- [ ] multi-selection.spec.ts:60:3 › 複数選択機能 › Ctrl+クリックで追加選択/選択解除ができる
- [ ] multi-selection.spec.ts:113:3 › 複数選択機能 › 複数選択時にコンテキストメニューで選択タブ数が表示される
- [ ] multi-selection.spec.ts:173:3 › 複数選択機能 › 複数選択時のコンテキストメニューから選択タブを一括で閉じることができる
- [ ] multi-selection.spec.ts:247:3 › 複数選択機能 › 複数選択時のコンテキストメニューでグループ化オプションが表示される
- [ ] multi-selection.spec.ts:307:3 › 複数選択機能 › 通常クリックで既存の選択がクリアされる
- [ ] multi-window-tree.spec.ts:17:3 › Multi-Window Tab Tree Display Separation › each window should only display its own tabs in the tab tree
- [ ] multi-window-tree.spec.ts:89:3 › Multi-Window Tab Tree Display Separation › when tab is moved to another window, it should appear in the destination window tree and disappear from source
- [ ] multi-window-tree.spec.ts:145:3 › Multi-Window Tab Tree Display Separation › new window should have empty tab tree except for default new tab
- [ ] new-tab-button.spec.ts:16:5 › 新規タブ追加ボタン › 新規タブ追加ボタンの存在 › 新規タブ追加ボタンがサイドパネルに表示される
- [ ] new-tab-button.spec.ts:28:5 › 新規タブ追加ボタン › 新規タブ追加ボタンの存在 › 新規タブ追加ボタンがツリービューの横幅いっぱいの幅を持つ
- [ ] new-tab-button.spec.ts:58:5 › 新規タブ追加ボタン › ボタンクリックで新規タブが追加される › 新規タブ追加ボタンをクリックすると新しいタブが作成される
- [ ] new-tab-button.spec.ts:100:5 › 新規タブ追加ボタン › ボタンクリックで新規タブが追加される › 新規タブ追加ボタンをクリックすると新しいタブがアクティブになる
- [ ] new-tab-button.spec.ts:147:5 › 新規タブ追加ボタン › 新規タブがツリー末尾に配置される › 新規タブはツリーの末尾（最後の位置）に追加される
- [ ] new-tab-button.spec.ts:240:5 › 新規タブ追加ボタン › 新規タブがツリー末尾に配置される › 複数回クリックすると複数のタブが順番に末尾に追加される
- [ ] parent-child-consistency.spec.ts:20:3 › 親子関係不整合解消 › タブを閉じた後も、他のタブの親子関係が維持される
- [ ] parent-child-consistency.spec.ts:95:3 › 親子関係不整合解消 › 親タブを閉じた後、子タブが昇格しても他の親子関係が維持される
- [ ] parent-child-consistency.spec.ts:156:3 › 親子関係不整合解消 › 複数のタブ作成と削除を連続で行っても、親子関係が維持される
- [ ] parent-child-consistency.spec.ts:222:3 › 親子関係不整合解消 › 深い階層（3階層）の親子関係が、他のタブ操作後も維持される
- [ ] parent-child-consistency.spec.ts:310:3 › 親子関係不整合解消 › 複数の独立した親子関係が、タブ操作の組み合わせ後も維持される
- [ ] parent-child-consistency.spec.ts:413:3 › 親子関係不整合解消 › ルート親タブを閉じたとき、子と孫の親子関係が維持される
- [ ] parent-child-preservation.spec.ts:19:3 › 新規タブ作成時の親子関係維持 › 既存の親子関係がある状態で新しいタブを開いても、既存の親子関係が維持される
- [ ] parent-child-preservation.spec.ts:75:3 › 新規タブ作成時の親子関係維持 › 複数のタブが親子関係にある状態で新しいタブを開いても、他のタブの親子関係を解消しない
- [ ] parent-child-preservation.spec.ts:149:3 › 新規タブ作成時の親子関係維持 › 孫タブまである親子関係が、新しいタブ作成後も維持される
- [ ] pinned-tab-reorder.spec.ts:16:5 › ピン留めタブの並び替え › ドラッグ＆ドロップによる並び替え › ピン留めタブをドラッグ＆ドロップで並び替えできる
- [ ] pinned-tab-reorder.spec.ts:127:5 › ピン留めタブの並び替え › ブラウザとの同期 › 並び替え後のピン留めタブ順序がブラウザと同期している
- [ ] pinned-tab-reorder.spec.ts:245:5 › ピン留めタブの並び替え › 包括的な順序同期テスト › 3つ以上のピン留めタブで各位置への移動が正しく同期される
- [ ] pinned-tab-reorder.spec.ts:359:5 › ピン留めタブの並び替え › ドロップ制限 › ピン留めタブを通常タブセクションにドロップしても通常タブにならない
- [ ] pinned-tab-reorder.spec.ts:453:5 › ピン留めタブの並び替え › ドラッグ可能性の確認 › ピン留めタブがソート可能として設定されている
- [ ] pinned-tab-reorder.spec.ts:608:5 › ピン留めタブの並び替え › ピン留めタブ順序同期の詳細テスト › 1つ目のピン留めタブを移動すると正しく同期される
- [ ] pinned-tab-reorder.spec.ts:653:5 › ピン留めタブの並び替え › ピン留めタブ順序同期の詳細テスト › 2つ目のピン留めタブを移動すると正しく同期される
- [ ] pinned-tab-reorder.spec.ts:697:5 › ピン留めタブの並び替え › ピン留めタブ順序同期の詳細テスト › 3つ目のピン留めタブを移動すると正しく同期される
- [ ] pinned-tab-reorder.spec.ts:741:5 › ピン留めタブの並び替え › ピン留めタブ順序同期の詳細テスト › 4つのピン留めタブで複雑な移動パターンが正しく同期される
- [ ] pinned-tab-reorder.spec.ts:782:5 › ピン留めタブの並び替え › ピン留めタブ順序同期の詳細テスト › ブラウザのchrome.tabs.moveでピン留めタブを移動するとUIが即座に更新される
- [ ] pinned-tabs.spec.ts:13:5 › ピン留めタブセクション › 基本的な表示 › ピン留めタブが上部セクションに横並びで表示される
- [ ] pinned-tabs.spec.ts:64:5 › ピン留めタブセクション › 基本的な表示 › 複数のピン留めタブが横並びで表示される
- [ ] pinned-tabs.spec.ts:123:5 › ピン留めタブセクション › 基本的な表示 › ピン留めを解除するとセクションから削除される
- [ ] pinned-tabs.spec.ts:177:5 › ピン留めタブセクション › クリック操作 › ピン留めタブをクリックするとタブがアクティブ化する
- [ ] pinned-tabs.spec.ts:237:5 › ピン留めタブセクション › 区切り線の表示 › ピン留めタブと通常タブの間に区切り線が表示される
- [ ] pinned-tabs.spec.ts:270:5 › ピン留めタブセクション › 区切り線の表示 › ピン留めタブが0件の場合は区切り線も非表示になる
- [ ] pinned-tabs.spec.ts:295:5 › ピン留めタブセクション › ピン留めタブとツリービューの統合 › ピン留めタブはピン留めセクションにのみ表示され、ツリービューには表示されない
- [ ] pinned-tabs.spec.ts:331:5 › ピン留めタブセクション › コンテキストメニュー - ピン留め解除 › ピン留めタブを右クリックするとコンテキストメニューが表示される
- [ ] pinned-tabs.spec.ts:369:5 › ピン留めタブセクション › コンテキストメニュー - ピン留め解除 › コンテキストメニューから「ピン留めを解除」を選択するとピン留めが解除される
- [ ] popup-menu.spec.ts:14:5 › ポップアップメニュー › ポップアップメニューの表示 › ポップアップページが正しく読み込まれる
- [ ] popup-menu.spec.ts:33:5 › ポップアップメニュー › ポップアップメニューの表示 › ポップアップメニューに「設定を開く」ボタンが表示される
- [ ] popup-menu.spec.ts:56:5 › ポップアップメニュー › ポップアップメニューの表示 › ポップアップメニューに「スナップショットを取得」ボタンが表示される
- [ ] popup-menu.spec.ts:81:5 › ポップアップメニュー › 設定ページを開く機能 › 「設定を開く」ボタンをクリックすると設定ページが開く
- [ ] popup-menu.spec.ts:120:5 › ポップアップメニュー › スナップショット取得機能 › 「スナップショットを取得」ボタンをクリックするとスナップショットが取得される
- [ ] popup-menu.spec.ts:158:5 › ポップアップメニュー › スナップショット取得機能 › スナップショット取得完了後にユーザーに通知される
- [ ] restored-tab-unread.spec.ts:14:3 › 復元タブの未読状態 › ブラウザ起動時に復元されたタブに未読インジケーターが表示されない
- [ ] restored-tab-unread.spec.ts:35:3 › 復元タブの未読状態 › 新しいタブをバックグラウンドで開くと未読インジケーターが表示される
- [ ] restored-tab-unread.spec.ts:70:3 › 復元タブの未読状態 › アクティブ状態で新しいタブを開くと未読インジケーターが表示されない
- [ ] restored-tab-unread.spec.ts:101:3 › 復元タブの未読状態 › サイドパネルをリロードしても既存タブに未読インジケーターが付かない
- [ ] restored-tab-unread.spec.ts:153:3 › 復元タブの未読状態 › 未読状態がストレージに正しく永続化される
- [ ] selection-auto-clear.spec.ts:19:5 › 選択状態の自動解除 › 新しいタブが開かれたときにタブ選択状態が解除される › 新しいタブを開くと複数選択状態が解除される
- [ ] selection-auto-clear.spec.ts:64:5 › 選択状態の自動解除 › タブクローズ等の操作時にも選択状態が解除される › タブをクローズすると選択状態が解除される
- [ ] selection-auto-clear.spec.ts:113:5 › 選択状態の自動解除 › タブクローズ等の操作時にも選択状態が解除される › 新規タブボタンをクリックすると選択状態が解除される
- [ ] service-worker-utils.spec.ts:19:5 › ServiceWorkerUtils › sendMessageToServiceWorker › Service Workerに既存のメッセージタイプを送信できること
- [ ] service-worker-utils.spec.ts:31:5 › ServiceWorkerUtils › sendMessageToServiceWorker › Service Workerから正しいレスポンスを受信できること
- [ ] service-worker-utils.spec.ts:56:5 › ServiceWorkerUtils › sendMessageToServiceWorker › タイムアウト時にエラーをスローすること
- [ ] service-worker-utils.spec.ts:69:5 › ServiceWorkerUtils › waitForMessageFromServiceWorker › タイムアウト時にエラーをスローすること
- [ ] service-worker-utils.spec.ts:80:5 › ServiceWorkerUtils › assertEventListenersRegistered › Service Workerにイベントリスナーが登録されていることを検証できること
- [ ] service-worker-utils.spec.ts:104:5 › ServiceWorkerUtils › assertEventListenersRegistered › 必要なChrome APIイベントリスナーが登録されていることを確認すること
- [ ] service-worker-utils.spec.ts:129:5 › ServiceWorkerUtils › assertServiceWorkerLifecycle › Service Workerが正常に起動していることを検証できること
- [ ] service-worker-utils.spec.ts:138:5 › ServiceWorkerUtils › assertServiceWorkerLifecycle › Service Workerが再起動後も状態を保持することを検証できること
- [ ] service-worker-utils.spec.ts:171:5 › ServiceWorkerUtils › 統合テスト: Service Workerとの双方向通信 › Side PanelからService Workerへのメッセージ送信とレスポンス受信
- [ ] service-worker-utils.spec.ts:193:5 › ServiceWorkerUtils › 統合テスト: Service Workerとの双方向通信 › Service WorkerからSide Panelへのメッセージ送信
- [ ] service-worker-utils.spec.ts:249:5 › ServiceWorkerUtils › エラーハンドリング › 無効なメッセージ形式でエラーハンドリングできること
- [ ] service-worker-utils.spec.ts:262:5 › ServiceWorkerUtils › エラーハンドリング › Service Workerが応答しない場合のタイムアウト処理
- [ ] service-worker.spec.ts:45:5 › Service Workerとの通信 › Side PanelからService Workerへのメッセージ送信 › Side PanelからService Workerにchrome.runtime.sendMessage()でメッセージを送信できること
- [ ] service-worker.spec.ts:58:5 › Service Workerとの通信 › Side PanelからService Workerへのメッセージ送信 › ACTIVATE_TABメッセージでタブをアクティブ化できること
- [ ] service-worker.spec.ts:92:5 › Service Workerとの通信 › Side PanelからService Workerへのメッセージ送信 › CLOSE_TABメッセージでタブを閉じることができること
- [ ] service-worker.spec.ts:128:5 › Service Workerとの通信 › Side PanelからService Workerへのメッセージ送信 › SYNC_TABSメッセージでChrome タブと同期できること
- [ ] service-worker.spec.ts:144:5 › Service Workerとの通信 › Service WorkerからSide Panelへのメッセージ送信 › chrome.runtime.onMessageリスナーがSide Panelで正しくメッセージを受信すること
- [ ] service-worker.spec.ts:176:5 › Service Workerとの通信 › Service WorkerからSide Panelへのメッセージ送信 › STATE_UPDATEDメッセージがSide Panelで正しく受信されること
- [ ] service-worker.spec.ts:215:5 › Service Workerとの通信 › タブイベント処理時のツリー状態バックグラウンド同期 › タブ作成時にService WorkerがSTATE_UPDATEDメッセージを送信すること
- [ ] service-worker.spec.ts:263:5 › Service Workerとの通信 › タブイベント処理時のツリー状態バックグラウンド同期 › タブ削除時にService WorkerがSTATE_UPDATEDメッセージを送信すること
- [ ] service-worker.spec.ts:307:5 › Service Workerとの通信 › タブイベント処理時のツリー状態バックグラウンド同期 › タブ更新時にService WorkerがSTATE_UPDATEDメッセージを送信すること
- [ ] service-worker.spec.ts:356:5 › Service Workerとの通信 › タブイベント処理時のツリー状態バックグラウンド同期 › タブアクティブ化時にツリー状態が同期されること
- [ ] service-worker.spec.ts:422:5 › Service Workerとの通信 › Service Worker再起動時の状態復元 › Service Workerが正常に起動し、状態が復元されること
- [ ] service-worker.spec.ts:429:5 › Service Workerとの通信 › Service Worker再起動時の状態復元 › Service Workerのイベントリスナーが登録されていること
- [ ] service-worker.spec.ts:436:5 › Service Workerとの通信 › Service Worker再起動時の状態復元 › Service Workerの状態がストレージから復元されること
- [ ] service-worker.spec.ts:447:5 › Service Workerとの通信 › Service Worker再起動時の状態復元 › Service Worker再起動後もchrome.runtimeが利用可能であること
- [ ] service-worker.spec.ts:464:5 › Service Workerとの通信 › 長時間非アクティブ後の通信再確立 › 一定時間経過後もService Workerとの通信が可能であること
- [ ] service-worker.spec.ts:489:5 › Service Workerとの通信 › 長時間非アクティブ後の通信再確立 › 複数回のメッセージ送信が正常に処理されること
- [ ] service-worker.spec.ts:501:5 › Service Workerとの通信 › 長時間非アクティブ後の通信再確立 › 同時に複数のメッセージを送信しても正常に処理されること
- [ ] service-worker.spec.ts:517:5 › Service Workerとの通信 › 長時間非アクティブ後の通信再確立 › ドラッグ状態のSet/Get/Clearが正常に動作すること
- [ ] service-worker.spec.ts:554:5 › Service Workerとの通信 › 統合テスト: Service Workerとの完全な通信フロー › タブ作成からツリー更新までの完全なフロー
- [ ] service-worker.spec.ts:645:5 › Service Workerとの通信 › 統合テスト: Service Workerとの完全な通信フロー › 複数タブ間でのService Worker通信
- [ ] service-worker.spec.ts:719:5 › Service Workerとの通信 › エラーハンドリング › 不明なメッセージタイプに対してエラーレスポンスが返ること
- [ ] service-worker.spec.ts:730:5 › Service Workerとの通信 › エラーハンドリング › 存在しないタブIDに対する操作でエラーが返ること
- [ ] service-worker.spec.ts:741:5 › Service Workerとの通信 › エラーハンドリング › メッセージタイムアウトが正しく処理されること
- [ ] settings-tab-title.spec.ts:18:3 › 設定タブのタイトル表示 › 設定タブがツリーで「Settings」というタイトルで表示される
- [ ] settings-tab-title.spec.ts:101:3 › 設定タブのタイトル表示 › 設定タブのHTMLタイトルが「Settings」である
- [ ] settings-tab-title.spec.ts:122:3 › 内部ページのタイトル表示 › chrome://versionページがツリーでブラウザのタイトルと同じタイトルで表示される
- [ ] settings-tab-title.spec.ts:193:3 › 内部ページのタイトル表示 › chrome://settingsページがツリーでブラウザのタイトルと同じタイトルで表示される
- [ ] settings-tab-title.spec.ts:271:3 › 内部ページのタイトル表示 › about:blankページがツリーで適切なタイトルで表示される
- [ ] settings-tab-title.spec.ts:329:3 › タイトル表示の安定性テスト › 複数の設定タブを連続で開いても正しくタイトルが表示される
- [ ] settings.spec.ts:51:3 › 設定変更とUI/UXカスタマイゼーション › サイドパネルに設定ボタンが存在しない
- [ ] settings.spec.ts:64:3 › 設定変更とUI/UXカスタマイゼーション › 設定ページが直接URLでアクセスできる
- [ ] settings.spec.ts:83:3 › 設定変更とUI/UXカスタマイゼーション › 設定ページがブラウザタブの全幅を利用できるレイアウトで表示される
- [ ] settings.spec.ts:99:3 › 設定変更とUI/UXカスタマイゼーション › 設定ページで現在の設定値が表示される
- [ ] settings.spec.ts:121:3 › 設定変更とUI/UXカスタマイゼーション › フォントサイズを変更した場合、設定が保存される
- [ ] settings.spec.ts:159:3 › 設定変更とUI/UXカスタマイゼーション › フォントサイズのプリセットボタン（小・中・大）が機能する
- [ ] settings.spec.ts:193:3 › 設定変更とUI/UXカスタマイゼーション › フォントファミリーを変更した場合、設定が保存される
- [ ] settings.spec.ts:231:3 › 設定変更とUI/UXカスタマイゼーション › カスタムCSSを設定した場合、Side Panelに適用される
- [ ] settings.spec.ts:270:3 › 設定変更とUI/UXカスタマイゼーション › 設定を保存した場合、ブラウザを再起動しても設定が保持される（設定の永続化）
- [ ] settings.spec.ts:325:3 › 設定変更とUI/UXカスタマイゼーション › サイドパネル内には設定パネルが表示されない
- [ ] settings.spec.ts:350:3 › 設定タブの名前表示 › 設定ページのタブタイトルが「Settings」である
- [ ] settings.spec.ts:369:3 › 設定タブの名前表示 › 設定ページのタブタイトルが「新しいタブ」ではない
- [ ] settings.spec.ts:396:3 › スナップショット自動保存設定 › スナップショット自動保存のトグルが機能する
- [ ] settings.spec.ts:428:3 › スナップショット自動保存設定 › スナップショット自動保存の間隔設定が保存される
- [ ] settings.spec.ts:460:3 › スナップショット自動保存設定 › 最大スナップショット数の設定が保存される
- [ ] settings.spec.ts:492:3 › スナップショット自動保存設定 › 自動保存無効時は間隔と最大数の入力が無効化される
- [ ] settings.spec.ts:524:3 › スナップショット自動保存設定 › スナップショット自動保存設定がブラウザ再起動後も保持される
- [ ] side-panel.spec.ts:18:5 › Side Panelの表示とリアルタイム更新 › 基本的な表示テスト › Side Panelを開いた場合、Side Panelが正しく表示される
- [ ] side-panel.spec.ts:35:5 › Side Panelの表示とリアルタイム更新 › 基本的な表示テスト › Side Panelを開いた場合、現在のタブツリーが正しく表示される
- [ ] side-panel.spec.ts:51:5 › Side Panelの表示とリアルタイム更新 › リアルタイム更新テスト › 新しいタブを作成した場合、Side Panelがリアルタイムで更新される
- [ ] side-panel.spec.ts:76:5 › Side Panelの表示とリアルタイム更新 › リアルタイム更新テスト › タブを閉じた場合、Side Panelからタブが削除される
- [ ] side-panel.spec.ts:104:5 › Side Panelの表示とリアルタイム更新 › リアルタイム更新テスト › タブのURLを変更した場合、ツリー表示が更新される
- [ ] side-panel.spec.ts:135:5 › Side Panelの表示とリアルタイム更新 › 展開/折りたたみテスト › 親タブに子タブがある場合、展開ボタンが表示される
- [ ] side-panel.spec.ts:179:5 › Side Panelの表示とリアルタイム更新 › 展開/折りたたみテスト › 展開ボタンをクリックすると、子タブの表示/非表示が切り替わる
- [ ] side-panel.spec.ts:240:5 › Side Panelの表示とリアルタイム更新 › スクロール性能テスト › 大量のタブがある場合、スクロールが滑らかに動作する
- [ ] side-panel.spec.ts:278:5 › Side Panelの表示とリアルタイム更新 › favIcon更新テスト › タブのfavIconが変更された場合、ツリー表示のアイコンが更新される
- [ ] start-page-title.spec.ts:40:5 › スタートページタイトル › 新規タブボタンでVivaldiスタートページURLが設定される › 新規タブ追加ボタンで作成されたタブにVivaldiスタートページURLが設定され、タイトルが「スタートページ」と表示される
- [ ] start-page-title.spec.ts:132:5 › スタートページタイトル › 新規タブのタイトルが「スタートページ」または「新しいタブ」であること › chrome.tabs.createで作成された新規タブのタイトルが適切に表示される
- [ ] start-page-title.spec.ts:184:5 › スタートページタイトル › ページ遷移後のタイトル更新 › 新規タブから別のページに遷移するとタイトルが更新される
- [ ] subtree-promotion.spec.ts:18:3 › 親タブ削除時のサブツリー親子関係維持 › 親タブを閉じても子タブ間の親子関係が維持される
- [ ] subtree-promotion.spec.ts:136:3 › 親タブ削除時のサブツリー親子関係維持 › 3階層のツリーで親を閉じても孫の親子関係が維持される
- [ ] subtree-promotion.spec.ts:250:3 › 親タブ削除時のサブツリー親子関係維持 › 複数の子タブにそれぞれ孫がある場合、親を閉じても全ての親子関係が維持される
- [ ] tab-duplicate.spec.ts:19:5 › タブ複製時の配置 › 複製されたタブが元のタブの兄弟として配置される › タブを複製すると兄弟タブとして配置される
- [ ] tab-duplicate.spec.ts:114:5 › タブ複製時の配置 › 複製されたタブが元のタブの直下（1つ下）に表示される › 複製されたタブは複製元タブの直後（インデックス+1）に配置される
- [ ] tab-duplicate.spec.ts:198:5 › タブ複製時の配置 › 複製されたタブが元のタブの直下（1つ下）に表示される › 複製されたタブは元のタブの直後に配置される
- [ ] tab-duplicate.spec.ts:289:5 › タブ複製時の配置 › 複製されたタブが元のタブの子タブとして配置されない › 親タブを持つタブを複製しても、複製タブは子タブにならない
- [ ] tab-grouping.spec.ts:50:5 › タブグループ化機能 › 複数タブのグループ化 › 複数タブを選択してグループ化した際にグループ親タブが作成される
- [ ] tab-grouping.spec.ts:138:5 › タブグループ化機能 › 複数タブのグループ化 › グループ親タブが専用のタブとして表示される
- [ ] tab-grouping.spec.ts:220:5 › タブグループ化機能 › 複数タブ選択によるグループ化の追加テスト › 複数タブを新しいグループにグループ化できる
- [ ] tab-grouping.spec.ts:328:5 › タブグループ化機能 › 複数タブ選択によるグループ化の追加テスト › 複数タブのグループ化時にデフォルト名「新しいグループ」が設定される
- [ ] tab-grouping.spec.ts:392:5 › タブグループ化機能 › 単一タブのグループ追加 › 単一タブをグループに追加できる
- [ ] tab-grouping.spec.ts:552:5 › タブグループ化機能 › 単一タブのグループ追加 › 利用可能なグループがない場合はメニュー項目が無効化される
- [ ] tab-grouping.spec.ts:619:5 › タブグループ化機能 › 実タブグループ化機能 › グループ化するとchrome-extension://スキームのグループタブが作成される
- [ ] tab-grouping.spec.ts:712:5 › タブグループ化機能 › 実タブグループ化機能 › グループ化後にグループ親タブが実際のブラウザタブとして存在する
- [ ] tab-grouping.spec.ts:802:5 › タブグループ化機能 › 実タブグループ化機能 › グループ化後にタブがグループタブの子として配置される
- [ ] tab-grouping.spec.ts:904:5 › タブグループ化機能 › 実タブグループ化機能 › 複数タブをグループ化すると実タブのグループ親が作成される
- [ ] tab-grouping.spec.ts:993:5 › タブグループ化機能 › 実タブグループ化機能 › グループ化後にグループノードがストレージに正しく保存される
- [ ] tab-grouping.spec.ts:1089:5 › タブグループ化機能 › タブグループ化 追加検証 › 単一タブ選択時にグループ化オプションがグレーアウトされる
- [ ] tab-grouping.spec.ts:1138:5 › タブグループ化機能 › タブグループ化 追加検証 › グループ化後にグループタブは展開状態である
- [ ] tab-grouping.spec.ts:1233:5 › タブグループ化機能 › タブグループ化 追加検証 › グループ化後に子タブの元の順序が維持される
- [ ] tab-grouping.spec.ts:1353:5 › タブグループ化機能 › タブグループ化 追加検証 › グループタブが生成され子タブが正しく配置される
- [ ] tab-lifecycle.spec.ts:19:3 › タブライフサイクルとツリー構造の基本操作 › 新しいタブを作成した場合、タブが正常に作成される
- [ ] tab-lifecycle.spec.ts:57:3 › タブライフサイクルとツリー構造の基本操作 › 親タブから新しいタブを開いた場合、親子関係が正しく確立される
- [ ] tab-lifecycle.spec.ts:92:3 › タブライフサイクルとツリー構造の基本操作 › タブを閉じた場合、タブが正常に削除される
- [ ] tab-lifecycle.spec.ts:127:3 › タブライフサイクルとツリー構造の基本操作 › 子タブを持つ親タブを閉じた場合、親タブが正常に削除される
- [ ] tab-lifecycle.spec.ts:177:3 › タブライフサイクルとツリー構造の基本操作 › タブのタイトルまたはURLが変更された場合、変更が反映される
- [ ] tab-lifecycle.spec.ts:234:3 › タブライフサイクルとツリー構造の基本操作 › タブがアクティブ化された場合、アクティブ状態が正しく設定される
- [ ] tab-persistence.spec.ts:18:5 › Tab Persistence › タブ状態の正確な復元 › タブのタイトルがストレージに永続化されること
- [ ] tab-persistence.spec.ts:69:5 › Tab Persistence › タブ状態の正確な復元 › ファビコンがストレージに永続化されること（直接設定）
- [ ] tab-persistence.spec.ts:109:5 › Tab Persistence › 余分なLoadingタブ防止 › ツリーに表示されるタブ数が実際のブラウザタブ数と一致すること
- [ ] tab-persistence.spec.ts:165:5 › Tab Persistence › 余分なLoadingタブ防止 › 存在しないタブがツリーに表示されないこと
- [ ] tab-persistence.spec.ts:201:5 › Tab Persistence › タイトルの永続化更新 › タブ内でのページ遷移時にタイトルの永続化データが更新されること
- [ ] tab-persistence.spec.ts:263:5 › Tab Persistence › ファビコンの永続化更新 › ファビコンが変更された際に永続化データが更新されること（直接設定）
- [ ] tab-persistence.spec.ts:322:5 › Tab Persistence › 不整合データ削除 › タブを閉じた際にタイトルの永続化データが削除されること
- [ ] tab-persistence.spec.ts:373:5 › Tab Persistence › 不整合データ削除 › タブを閉じた際にファビコンの永続化データが削除されること
- [ ] tab-persistence.spec.ts:427:5 › Tab Persistence › 不整合データ削除 › ストレージ内のゴーストタブが起動時にクリーンアップされること
- [ ] tab-persistence.spec.ts:584:5 › Tab Persistence › 統合テスト: タブ永続化の全体フロー › 複数タブの作成・更新・削除が正しく永続化されること
- [ ] tab-position-settings.spec.ts:57:5 › タブ位置とタイトル表示のE2Eテスト › タブ位置設定の各シナリオ検証 › リンククリックで開かれたタブが「リンククリックのタブの位置」設定に従って配置される（child設定）
- [ ] tab-position-settings.spec.ts:166:5 › タブ位置とタイトル表示のE2Eテスト › タブ位置設定の各シナリオ検証 › 手動で開かれたタブが「手動で開かれたタブの位置」設定に従って配置される（end設定）
- [ ] tab-position-settings.spec.ts:214:5 › タブ位置とタイトル表示のE2Eテスト › タブ位置設定の各シナリオ検証 › 設定変更後に新しいタブが変更された設定に従って配置される
- [ ] tab-position-settings.spec.ts:262:5 › タブ位置とタイトル表示のE2Eテスト › タブ位置設定の各シナリオ検証 › システムページ（chrome://）はopenerTabIdがあっても手動タブとして扱われる
- [ ] tab-position-settings.spec.ts:316:5 › タブ位置とタイトル表示のE2Eテスト › タブ位置設定の各シナリオ検証 › 「兄弟として配置」設定でリンクから開いたタブが兄弟として配置される（sibling設定）
- [ ] tab-position-settings.spec.ts:391:5 › タブ位置とタイトル表示のE2Eテスト › タブ位置設定の各シナリオ検証 › ネストした親タブから開いたリンクタブが兄弟として配置される（sibling設定）
- [ ] tab-position-settings.spec.ts:492:5 › タブ位置とタイトル表示のE2Eテスト › タブ位置設定の各シナリオ検証 › 「リストの最後」設定でリンクから開いたタブがルートレベルに配置される
- [ ] tab-position-settings.spec.ts:563:5 › タブ位置とタイトル表示のE2Eテスト › 新規タブタイトルとURL検証 › 新規タブボタンで作成されたタブのURLがスタートページ関連である
- [ ] tab-position-settings.spec.ts:611:5 › タブ位置とタイトル表示のE2Eテスト › 新規タブタイトルとURL検証 › 新規タブのタイトルが「スタートページ」と表示される
- [ ] tab-position-settings.spec.ts:667:5 › タブ位置とタイトル表示のE2Eテスト › デフォルト設定の確認 › デフォルト設定で「リンククリックのタブの位置」は「子」、「手動で開かれたタブの位置」は「リストの最後」
- [ ] tab-reorder-sync.spec.ts:25:5 › タブ並び替え同期テスト › chrome.tabs.move APIによるタブ移動 › chrome.tabs.moveでタブを移動した場合、ツリービューの表示順序が更新されること
- [ ] tab-reorder-sync.spec.ts:71:5 › タブ並び替え同期テスト › chrome.tabs.move APIによるタブ移動 › chrome.tabs.moveでタブを末尾に移動した場合、ツリービューが正しく更新されること
- [ ] tab-reorder-sync.spec.ts:111:5 › タブ並び替え同期テスト › chrome.tabs.move APIによるタブ移動 › chrome.tabs.moveで複数回タブを移動した場合、ツリービューが毎回正しく更新されること
- [ ] tab-reorder-sync.spec.ts:168:5 › タブ並び替え同期テスト › ドラッグ&ドロップによるタブ移動と同期 › D&Dでタブを並び替えた後、ブラウザタブの順序とツリービューが同期していること
- [ ] tab-reorder-sync.spec.ts:205:5 › タブ並び替え同期テスト › ドラッグ&ドロップによるタブ移動と同期 › D&Dでタブを並び替えた後、ブラウザタブの順序がストレージに反映されていること
- [ ] tab-reorder-sync.spec.ts:249:5 › タブ並び替え同期テスト › エッジケース › タブが1つしかない場合、chrome.tabs.moveを呼んでもエラーが発生しないこと
- [ ] tab-reorder-sync.spec.ts:271:5 › タブ並び替え同期テスト › エッジケース › 高速に連続してタブを移動した場合、最終的な順序が正しく反映されること
- [ ] text-selection.spec.ts:14:3 › テキスト選択禁止機能 › Shift+クリックでの複数タブ選択時にテキストが選択されない
- [ ] text-selection.spec.ts:53:3 › テキスト選択禁止機能 › ツリービュー内のテキストがドラッグ選択できない
- [ ] text-selection.spec.ts:95:3 › テキスト選択禁止機能 › ツリービュー全体に select-none クラスが適用されている
- [ ] text-selection.spec.ts:111:3 › テキスト選択禁止機能 › タブノードに select-none クラスが適用されている
- [ ] text-selection.spec.ts:127:3 › テキスト選択禁止機能 › user-select CSSプロパティがnoneに設定されている
- [ ] tree-expand-on-new-tab.spec.ts:20:3 › 新規タブ作成時のツリー展開 › 折りたたまれた親タブから子タブを開くと、親タブが自動展開される
- [ ] tree-expand-on-new-tab.spec.ts:117:3 › 新規タブ作成時のツリー展開 › 既に展開されている親タブから子タブを開いても展開状態が維持される
- [ ] tree-state-persistence.spec.ts:24:5 › ツリー状態永続化 › 親子関係の永続化 › 親子関係がストレージに正しく保存されること
- [ ] tree-state-persistence.spec.ts:76:5 › ツリー状態永続化 › 親子関係の永続化 › サイドパネルリロード後に親子関係が復元されること
- [ ] tree-state-persistence.spec.ts:149:5 › ツリー状態永続化 › 親子関係の永続化 › 深いネストの親子関係がストレージに正しく保存・復元されること
- [ ] tree-state-persistence.spec.ts:233:5 › ツリー状態永続化 › 折りたたみ状態の永続化 › 折りたたみ状態がストレージに正しく保存されること
- [ ] tree-state-persistence.spec.ts:321:5 › ツリー状態永続化 › 折りたたみ状態の永続化 › サイドパネルリロード後に折りたたみ状態が復元されること（折りたたみ状態）
- [ ] tree-state-persistence.spec.ts:400:5 › ツリー状態永続化 › 折りたたみ状態の永続化 › サイドパネルリロード後に折りたたみ状態が復元されること（展開状態）
- [ ] tree-state-persistence.spec.ts:485:5 › ツリー状態永続化 › 統合テスト › 親子関係と折りたたみ状態の両方がリロード後に復元されること
- [ ] tree-state-persistence.spec.ts:608:5 › ツリー状態永続化 › 統合テスト › 複数回の折りたたみ操作後もストレージが正しく更新されること
- [ ] tree-structure-restore.spec.ts:19:3 › ブラウザ再起動時のツリー構造復元 › treeStructureがストレージに正しく保存される
- [ ] tree-structure-restore.spec.ts:77:3 › ブラウザ再起動時のツリー構造復元 › 深い階層のツリーがtreeStructureに正しく保存される
- [ ] tree-structure-restore.spec.ts:153:3 › ブラウザ再起動時のツリー構造復元 › syncWithChromeTabsがtreeStructureから親子関係を復元する
- [ ] tree-structure-restore.spec.ts:295:3 › ブラウザ再起動時のツリー構造復元 › D&Dで作成した親子関係がtreeStructureに保存され、復元される
- [ ] tree-to-chrome-sync.spec.ts:37:5 › ツリー→Chromeタブ同期テスト › 子タブ配置後のChrome同期 › タブを子として配置した後、Chromeタブインデックスが深さ優先順になること
- [ ] tree-to-chrome-sync.spec.ts:84:5 › ツリー→Chromeタブ同期テスト › 子タブ配置後のChrome同期 › ネストした子タブを作成した場合、Chromeタブインデックスが深さ優先順になること
- [ ] tree-to-chrome-sync.spec.ts:136:5 › ツリー→Chromeタブ同期テスト › 兄弟配置後のChrome同期 › タブを兄弟として並び替えた後、Chromeタブインデックスが更新されること
- [ ] tree-to-chrome-sync.spec.ts:178:5 › ツリー→Chromeタブ同期テスト › サブツリー移動後のChrome同期 › サブツリーを移動した後、子タブも含めてChromeタブインデックスが更新されること
- [ ] tree-to-chrome-sync.spec.ts:231:5 › ツリー→Chromeタブ同期テスト › ツリービューとChromeタブの順序一致確認 › ドラッグ操作後、ツリービューの表示順序とChromeタブインデックスが一致すること
- [ ] ui-display.spec.ts:31:5 › UI表示の一貫性 › フォントサイズ設定の反映 › フォントサイズを変更するとタブタイトルのフォントサイズが変更される
- [ ] ui-display.spec.ts:89:5 › UI表示の一貫性 › フォントサイズ設定の反映 › フォントサイズのプリセットボタンでタブタイトルのサイズが変わる
- [ ] ui-display.spec.ts:140:5 › UI表示の一貫性 › フォントサイズ設定の反映 › フォントサイズ変更後にページをリロードしても設定が保持される
- [ ] ui-display.spec.ts:187:5 › UI表示の一貫性 › スタートページタイトルの表示 › スタートページURLのタイトル変換ロジックが正しく実装されている
- [ ] ui-display.spec.ts:269:5 › UI表示の一貫性 › スタートページタイトルの表示 › 新しいタブのURL判定ロジックが正しく動作する
- [ ] ui-display.spec.ts:313:5 › UI表示の一貫性 › スタートページタイトルの表示 › 通常のWebサイトはそのままのタイトルで表示される
- [ ] ui-display.spec.ts:349:5 › UI表示の一貫性 › スタートページタイトルの表示 › ローディング中のタブは「Loading...」と表示され、完了後に正しいタイトルになる
- [ ] ui-tree-depth-verification.spec.ts:18:3 › UIツリービューのdepth属性検証 › ドラッグ&ドロップで作成した親子関係がUIに正しく反映される
- [ ] ui-tree-depth-verification.spec.ts:48:3 › UIツリービューのdepth属性検証 › 親子関係作成後に新しいタブを開いても親子関係が維持される（UI検証）
- [ ] ui-tree-depth-verification.spec.ts:89:3 › UIツリービューのdepth属性検証 › 3階層の親子関係が新しいタブ作成後もUI上で維持される
- [ ] unread-indicator.spec.ts:14:3 › 未読インジケータ機能 › タブがバックグラウンドで読み込まれた場合、未読バッジが表示される
- [ ] unread-indicator.spec.ts:44:3 › 未読インジケータ機能 › 未読タブをアクティブにした場合、未読バッジが消える
- [ ] unread-indicator.spec.ts:87:3 › 未読インジケータ機能 › 親タブの子に未読タブがあっても、親タブには未読子タブ数のバッジが表示されない
- [ ] unread-indicator.spec.ts:137:3 › 未読インジケータ機能 › 複数の未読タブがある場合、未読数がカウントされて表示される
- [ ] unread-indicator.spec.ts:204:3 › 未読インジケーター位置 › 未読インジケーターがタブノード内の左下角に表示される
- [ ] unread-indicator.spec.ts:257:3 › 未読インジケーター位置 › 短いタイトルと長いタイトルの両方で未読インジケーターの相対位置が一定である
- [ ] unread-indicator.spec.ts:336:3 › 未読インジケーター位置 › 未読バッジがタブノードの左下に三角形として表示される
- [ ] unread-indicator.spec.ts:389:3 › 未読インジケーター位置 › 未読インジケーターがタブの右端に固定されていること（タイトル長に依存しない）
- [ ] unread-indicator.spec.ts:477:3 › 未読インジケーターdepth対応 › ルートレベル（depth=0）の未読タブでインジケーターが左端に表示される
- [ ] unread-indicator.spec.ts:522:3 › 未読インジケーターdepth対応 › depth=1の未読タブでインジケーターがインデントされた位置に表示される
- [ ] unread-indicator.spec.ts:579:3 › 未読インジケーターdepth対応 › depth=2の未読タブでインジケーターがさらにインデントされた位置に表示される
- [ ] unread-indicator.spec.ts:649:3 › 未読インジケーターdepth対応 › 異なるdepthの未読タブでインジケーター位置が正しくスケールする
- [ ] unread-indicator.spec.ts:730:3 › 未読インジケーターUI改善 › 未読インジケーターが左下三角形の形状で表示される
- [ ] unread-indicator.spec.ts:802:3 › 未読インジケーターUI改善 › 未読インジケーターがタブ要素に重なる形で配置される
- [ ] unread-indicator.spec.ts:855:3 › 未読インジケーターUI改善 › 既読になったときに未読インジケーターが非表示になる
- [ ] unread-indicator.spec.ts:892:3 › 未読インジケーターUI改善 › 複数タブで未読インジケーターの形状が一貫していること
- [ ] unread-restore.spec.ts:19:3 › 未読インジケーター復元時制御 › ブラウザ起動時の既存タブに未読インジケーターが表示されない
- [ ] unread-restore.spec.ts:88:3 › 未読インジケーター復元時制御 › 起動完了後に作成されたバックグラウンドタブに未読インジケーターが表示される
- [ ] unread-restore.spec.ts:123:3 › 未読インジケーター復元時制御 › 起動完了後のタブをアクティブ化すると未読インジケーターが消える
- [ ] unread-restore.spec.ts:163:3 › 未読インジケーター復元時制御 › 複数のバックグラウンドタブを同時に作成した場合も正しく未読インジケーターが表示される
- [ ] unread-restore.spec.ts:208:3 › 未読インジケーター復元時制御 › アクティブとして作成されたタブには未読インジケーターが表示されない
- [ ] utils/drag-drop-utils.spec.ts:13:5 › DragDropUtils › startDrag › タブノードをドラッグ開始できる
- [ ] utils/drag-drop-utils.spec.ts:30:5 › DragDropUtils › hoverOverTab › 別のタブノード上にホバーできる
- [ ] utils/drag-drop-utils.spec.ts:53:5 › DragDropUtils › dropTab › ドロップを実行できる
- [ ] utils/drag-drop-utils.spec.ts:73:5 › DragDropUtils › reorderTabs › 同階層のタブを並び替えできる（before）
- [ ] utils/drag-drop-utils.spec.ts:96:5 › DragDropUtils › reorderTabs › 同階層のタブを並び替えできる（after）
- [ ] utils/drag-drop-utils.spec.ts:121:5 › DragDropUtils › moveTabToParent › タブを別のタブの子にできる
- [ ] utils/drag-drop-utils.spec.ts:146:5 › DragDropUtils › assertDropIndicator › ドロップインジケータの表示を検証できる
- [ ] utils/drag-drop-utils.spec.ts:174:5 › DragDropUtils › assertAutoExpand › ホバー自動展開を検証できる
- [ ] utils/side-panel-utils.spec.ts:17:3 › SidePanelUtils › openSidePanelはSide Panelを開く
- [ ] utils/side-panel-utils.spec.ts:29:3 › SidePanelUtils › assertTreeVisibleはツリーが表示されることを検証する
- [ ] utils/side-panel-utils.spec.ts:36:3 › SidePanelUtils › assertRealTimeUpdateは別タブでのタブ作成をSide Panelで検証する
- [ ] utils/side-panel-utils.spec.ts:60:3 › SidePanelUtils › assertRealTimeUpdateはタブ削除もSide Panelで検証する
- [ ] utils/side-panel-utils.spec.ts:88:3 › SidePanelUtils › assertSmoothScrollingは大量タブ時のスクロール動作を検証する
- [ ] utils/side-panel-utils.spec.ts:110:3 › SidePanelUtils › assertSmoothScrollingは少数のタブでも動作する
- [ ] utils/tab-utils.spec.ts:18:3 › TabTestUtils › createTabは新しいタブを作成し、ツリーに表示されるまで待機する
- [ ] utils/tab-utils.spec.ts:32:3 › TabTestUtils › createTabは親タブを指定して子タブを作成できる
- [ ] utils/tab-utils.spec.ts:51:3 › TabTestUtils › closeTabはタブを閉じ、ツリーから削除されることを検証する
- [ ] utils/tab-utils.spec.ts:68:3 › TabTestUtils › activateTabはタブをアクティブ化し、ツリーでハイライトされることを検証する
- [ ] utils/tab-utils.spec.ts:90:3 › TabTestUtils › assertTabInTreeはツリー内のタブノードを検証する
- [ ] utils/tab-utils.spec.ts:103:3 › TabTestUtils › assertTabNotInTreeはツリーからタブノードが削除されたことを検証する
- [ ] utils/tab-utils.spec.ts:119:3 › TabTestUtils › assertUnreadBadgeは未読バッジが表示されることを検証する
- [ ] utils/tab-utils.spec.ts:137:3 › TabTestUtils › assertUnreadBadgeはタブをアクティブ化すると未読バッジが消えることを検証する
- [ ] utils/window-utils.spec.ts:17:3 › WindowTestUtils › createWindowは新しいウィンドウを作成する
- [ ] utils/window-utils.spec.ts:25:3 › WindowTestUtils › moveTabToWindowはタブを別ウィンドウに移動する
- [ ] utils/window-utils.spec.ts:47:3 › WindowTestUtils › dragTabToWindowはタブを別ウィンドウにドラッグ&ドロップで移動する
- [ ] utils/window-utils.spec.ts:70:3 › WindowTestUtils › assertWindowTreeSyncは各ウィンドウのツリー状態が正しく同期されることを検証する
- [ ] utils/window-utils.spec.ts:82:3 › WindowTestUtils › 複数ウィンドウ間でタブを移動した後、各ウィンドウのツリー状態が正しく同期されることを検証する
- [ ] utils/window-utils.spec.ts:119:3 › WindowTestUtils › 子タブを持つ親タブを別ウィンドウに移動した場合、サブツリー全体が一緒に移動する
- [ ] ux-improvements.spec.ts:16:5 › UX改善機能 › ピン留めタブの閉じるボタン非表示 › ピン留めタブには閉じるボタンが表示されない
- [ ] ux-improvements.spec.ts:70:5 › UX改善機能 › ピン留めタブの閉じるボタン非表示 › 通常タブをピン留めすると閉じるボタンが非表示になる
- [ ] ux-improvements.spec.ts:110:5 › UX改善機能 › ビュースクロール切り替え › ビューリスト上でマウスホイールを下にスクロールすると次のビューに切り替わる
- [ ] ux-improvements.spec.ts:144:5 › UX改善機能 › ビュースクロール切り替え › ビューリスト上でマウスホイールを上にスクロールすると前のビューに切り替わる
- [ ] ux-improvements.spec.ts:179:5 › UX改善機能 › ビュースクロール切り替え › 最初のビューで上スクロールしても切り替わらない（ループしない）
- [ ] ux-improvements.spec.ts:212:5 › UX改善機能 › ビュースクロール切り替え › 最後のビューで下スクロールしても切り替わらない（ループしない）
- [ ] ux-improvements.spec.ts:245:5 › UX改善機能 › サブメニュー操作 - 別のビューへ移動 › タブのコンテキストメニューで「別のビューへ移動」にホバーするとサブメニューが表示される
- [ ] ux-improvements.spec.ts:324:5 › UX改善機能 › サブメニュー操作 - 別のビューへ移動 › サブメニューからビューを選択するとタブがそのビューに移動する
- [ ] ux-improvements.spec.ts:411:5 › UX改善機能 › サブメニュー操作 - 別のビューへ移動 › 現在のビューはサブメニューに表示されない
- [ ] view-icon-selection.spec.ts:16:3 › ビューアイコン選択即時反映 › プリセットからアイコンを選択すると即座に反映される（Selectボタン不要）
- [ ] view-icon-selection.spec.ts:91:3 › ビューアイコン選択即時反映 › アイコン選択後にツリービューパネル上のビューアイコンが即座に更新される
- [ ] view-icon-selection.spec.ts:174:3 › ビューアイコン選択即時反映 › アイコン選択時にIconPickerが即座に閉じる（Selectボタン不要）
- [ ] view-icon-selection.spec.ts:239:3 › ビューアイコン選択即時反映 › 複数回アイコンを変更しても正しく反映される
- [ ] view-new-tab.spec.ts:17:5 › ビューへの新規タブ追加 › ビューを開いている状態で新しいタブをそのビューに追加 › カスタムビューを開いている状態で新しいタブを開いた場合、そのビューに追加される
- [ ] view-new-tab.spec.ts:84:5 › ビューへの新規タブ追加 › 新規タブ追加後もViewSwitcherが現在のビューを維持（ビューが閉じずに維持される） › 新しいタブを開いた後もビュースイッチャーは同じビューを表示し続ける
- [ ] view-new-tab.spec.ts:139:5 › ビューへの新規タブ追加 › 新規タブ追加後もViewSwitcherが現在のビューを維持（ビューが閉じずに維持される） › 複数のタブを追加してもビュースイッチャーは同じビューを維持する
- [ ] view-new-tab.spec.ts:178:5 › ビューへの新規タブ追加 › デフォルトビュー以外のビューでも新規タブが現在ビューに属する › デフォルトビューで新しいタブを開いた場合、デフォルトビューに追加される
- [ ] view-new-tab.spec.ts:223:5 › ビューへの新規タブ追加 › デフォルトビュー以外のビューでも新規タブが現在ビューに属する › カスタムビューAからカスタムビューBに切り替えた後、新しいタブはビューBに追加される
- [ ] view-new-tab.spec.ts:307:5 › ビューへの新規タブ追加 › E2Eテスト検証 › NewTabButtonを使用してカスタムビューに新規タブを追加できる
- [ ] view-switching.spec.ts:13:5 › ビュー切り替え機能 › ビュー一覧とビュー切り替え › Side Panelを開いた場合、ビュースイッチャーが表示される
- [ ] view-switching.spec.ts:26:5 › ビュー切り替え機能 › ビュー一覧とビュー切り替え › デフォルトビューが表示され、クリックするとアクティブ状態になる
- [ ] view-switching.spec.ts:44:5 › ビュー切り替え機能 › ビュー一覧とビュー切り替え › ビューボタンをクリックするとビューが切り替わる
- [ ] view-switching.spec.ts:73:5 › ビュー切り替え機能 › ビュー一覧とビュー切り替え › ビュー間を切り替えた場合、ツリー表示が即座に更新される
- [ ] view-switching.spec.ts:108:5 › ビュー切り替え機能 › カスタムビュー作成 › 新しいビュー追加ボタンをクリックすると、新しいビューが作成される
- [ ] view-switching.spec.ts:135:5 › ビュー切り替え機能 › カスタムビュー作成 › カスタムビューを作成した場合、新しいビューがビューリストに追加される
- [ ] view-switching.spec.ts:155:5 › ビュー切り替え機能 › カスタムビュー編集 › ビュー名や色を変更した場合、UI上の表示が即座に反映される
- [ ] view-switching.spec.ts:211:5 › ビュー切り替え機能 › カスタムビュー編集 › 編集をキャンセルした場合、変更は破棄される
- [ ] view-switching.spec.ts:254:5 › ビュー切り替え機能 › ビュー切り替え動作の修正 › ビューを切り替えた後に新しいタブを開いた場合、現在アクティブなビューにタブを追加する
- [ ] view-switching.spec.ts:296:5 › ビュー切り替え機能 › ビュー切り替え動作の修正 › ビューを追加した場合、ページをリロードしてもビューが永続化されている
- [ ] view-switching.spec.ts:325:5 › ビュー切り替え機能 › ビュー切り替え動作の修正 › ビューの切り替え状態が正しく管理され、意図せず消えない
- [ ] view-switching.spec.ts:360:5 › ビュー切り替え機能 › ビュー削除 › ビューを削除した場合、デフォルトビューに自動的に切り替わる
- [ ] view-switching.spec.ts:404:5 › ビュー切り替え機能 › ビュー削除 › デフォルトビューは削除できない
- [ ] view-tab-count.spec.ts:20:5 › ビューのタブカウント正確性 › タブ追加・削除時のカウント即時更新 › タブを追加した場合、ViewSwitcherのタブカウントバッジが即座に更新される
- [ ] view-tab-count.spec.ts:68:5 › ビューのタブカウント正確性 › タブ追加・削除時のカウント即時更新 › タブを削除した場合、ViewSwitcherのタブカウントバッジが即座に更新される
- [ ] view-tab-count.spec.ts:127:5 › ビューのタブカウント正確性 › タブ追加・削除時のカウント即時更新 › 複数タブを連続で追加した場合、タブカウントが正確に更新される
- [ ] view-tab-count.spec.ts:178:5 › ビューのタブカウント正確性 › 不整合タブ削除時のカウント再計算 › ストレージに不整合タブが存在する場合、クリーンアップ後にカウントが再計算される
- [ ] view-tab-count.spec.ts:311:5 › ビューのタブカウント正確性 › 不整合タブ削除時のカウント再計算 › ビューのタブカウントは実際に存在するタブのみをカウントする
- [ ] view-tab-count.spec.ts:381:5 › タブ数表示の視認性 › タブ数が正しく表示される › タブ数バッジが表示され、正しい数値を表示する
- [ ] view-tab-count.spec.ts:441:5 › タブ数表示の視認性 › タブ数が正しく表示される › 2桁のタブ数が正しく表示される
- [ ] view-tab-count.spec.ts:506:5 › タブ数表示の視認性 › タブ数バッジの視認性 › タブ数バッジは適切なサイズで表示される
- [ ] view-tab-count.spec.ts:563:5 › タブ数表示の視認性 › タブ数バッジの視認性 › タブ数が0の場合はバッジが非表示になる
