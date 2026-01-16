# 状態管理リファクタリング - コード監査結果

このドキュメントは、TreeStateManagerをSingle Source of Truthとするリファクタリングに必要な修正箇所を洗い出した結果をまとめたものです。

## 修正の基本方針

### 原則
1. **SidePanelはストレージやChrome APIに直接アクセスしない** - 全ての状態変更はServiceWorkerにメッセージを送信して行う
2. **TreeStateManagerのメソッドは純粋にメモリ上の状態変更のみ**（`addTab`と`duplicateTab`のみ例外：tabIdを得るためにChrome APIが必要）
3. **`syncTreeStateToChromeTabs()`でChromeタブの状態をTreeStateManagerに合わせる** - 順序、ピン留め状態、ウィンドウ配置など全てを同期
4. **Chrome APIを直接呼ぶのはsyncメソッド内のみ**（addTab/duplicateTabの例外を除く）
5. **STATE_UPDATEDメッセージにペイロードを含める** - ストレージを共有メモリとして使わず、メッセージで状態を伝達する

### syncメソッドの拡張

現在の`syncTreeOrderToChromeTabs()`を拡張し、`syncTreeStateToChromeTabs()`として以下を同期：
- タブの順序（`chrome.tabs.move`）
- ピン留め状態（`chrome.tabs.update({pinned: ...})`）
- ウィンドウ配置（`chrome.tabs.move({windowId: ...})`）

### TreeStateManagerに追加/拡張するメソッド

| メソッド | 説明 | Chrome API呼び出し |
|---------|------|-------------------|
| `addTab(options, position, parentNodeId?, viewId?)` | タブをツリーに追加 | `chrome.tabs.create()`（例外：tabId取得のため） |
| `duplicateTab(tabId)` | タブを複製 | `chrome.tabs.duplicate()`（例外：tabId取得のため） |
| `pinTab(tabId)` | タブをピン留め状態に変更 | なし（syncで反映） |
| `unpinTab(tabId, viewId?)` | ピン留め解除状態に変更 | なし（syncで反映） |
| `moveTabsToNewWindow(tabIds)` | 新ウィンドウ移動状態に変更 | なし（syncで反映） |
| `moveTabsToWindow(tabIds, windowId)` | ウィンドウ移動状態に変更 | なし（syncで反映） |
| `moveNodeToParent(nodeId, targetParentId, index)` | ノードを親の子として移動 | なし（syncで反映） |
| `moveNodeAsSibling(nodeId, aboveNodeId, belowNodeId)` | ノードを兄弟位置に移動 | なし（syncで反映） |

### イベントハンドラでの使用パターン

```typescript
async function handleSomeAction() {
  // 1. TreeStateManagerのメソッドでメモリ上の状態を変更（複数回呼んでもOK）
  treeStateManager.pinTab(tabId);
  treeStateManager.moveNodeToParent(nodeId, targetParentId, index);

  // 2. 一連の操作完了後にChromeタブの状態を同期
  await treeStateManager.syncTreeStateToChromeTabs();

  // 3. 永続化と通知
  await treeStateManager.persistState();
  treeStateManager.notifyStateChanged();
}
```

---

## 1. SidePanel側の修正箇所

### 1.1 TreeStateProvider.tsx

#### 問題1: updateTreeState関数（556-559行目）
**現状**: `chrome.storage.local.set()`を直接呼び出している

```typescript
const updateTreeState = useCallback((newState: TreeState) => {
  chrome.storage.local.set({ [STORAGE_KEYS.TREE_STATE]: newState });
  setTreeState(newState);
}, []);
```

**修正方針**: この関数を削除し、全ての状態変更をServiceWorkerへのメッセージ送信に置き換える

---

#### 問題2: switchView（592-668行目）
**現状**: `updateTreeState` + `chrome.tabs.update`を呼び出している

**修正方針**: `SWITCH_VIEW`メッセージをServiceWorkerに送信し、ServiceWorker側で処理。STATE_UPDATEDのペイロードで新しい状態を受け取る

---

#### 問題3: createView, deleteView, updateView
**現状**: `updateTreeState`を使用

**修正方針**:
- `CREATE_VIEW`、`DELETE_VIEW`、`UPDATE_VIEW`メッセージをServiceWorkerに送信
- ServiceWorker側でTreeStateManager経由で処理

---

#### 問題4: handleDragEnd（802-974行目）
**現状**:
- `updateTreeState`で状態を保存
- `syncTreeToChromeTabs`（内部でchrome.tabs.move）を呼び出し
- `REFRESH_TREE_STRUCTURE`メッセージを送信

**修正方針**:
- D&D操作の結果（移動元、移動先、挿入位置）をServiceWorkerに送信
- ServiceWorker側でTreeStateManagerを更新し、syncTreeOrderToChromeTabs()を呼び出す
- STATE_UPDATEDのペイロードで新しい状態を受け取る

---

#### 問題5: handleSiblingDrop（980-1243行目）
**現状**:
- `updateTreeState`で状態を保存
- `chrome.tabs.move`を直接呼び出し
- `REFRESH_TREE_STRUCTURE`メッセージを送信

**修正方針**: handleDragEndと同様に、ServiceWorkerにメッセージを送信して処理

---

#### 問題6: deleteGroup, addTabToGroup, removeTabFromGroup
**現状**: `updateTreeState`を使用

**修正方針**: ServiceWorkerにメッセージを送信して処理（一部は既存のメッセージタイプで対応可能）

---

#### 問題7: handlePinnedTabReorder（1452-1460行目）
**現状**: `chrome.tabs.move`を直接呼び出し

```typescript
const handlePinnedTabReorder = useCallback(async (draggedTabId: number, targetTabId: number, insertBefore: boolean) => {
  // ... 省略 ...
  await chrome.tabs.move(draggedTabId, { index: targetIndex });
}, []);
```

**修正方針**:
- `REORDER_PINNED_TAB`メッセージをServiceWorkerに送信
- ServiceWorker側でTreeStateManagerを更新し、`syncTreeOrderToChromeTabs()`を呼び出す

---

#### 問題8: moveTabsToView（1592-1769行目）
**現状**:
- `updateTreeState`で状態を保存
- `REFRESH_TREE_STRUCTURE`メッセージを送信

**修正方針**: `MOVE_TABS_TO_VIEW`メッセージをServiceWorkerに送信して処理

---

#### 問題9: loadGroups（281行目）
**現状**: `chrome.storage.local.get('groups')`を直接呼び出し

**修正方針**:
- グループ情報をTreeStateに統合し、STATE_UPDATEDのペイロードで取得
- または`GET_GROUPS`メッセージで取得

---

#### 問題10: loadUnreadTabs（292行目）
**現状**: `chrome.storage.local.get(STORAGE_KEYS.UNREAD_TABS)`を直接呼び出し

**修正方針**:
- 未読タブ情報をTreeStateに統合し、STATE_UPDATEDのペイロードで取得

---

#### 問題11: loadTabInfoMap（332-338行目）
**現状**: `chrome.storage.local.get()`、`chrome.tabs.query({})`を直接呼び出し

**修正方針**:
- tabInfoMapをSTATE_UPDATEDのペイロードに含める
- タブ情報はServiceWorkerからの通知で更新

---

#### 問題12: saveGroups（379行目）
**現状**: `chrome.storage.local.set({ groups: newGroups })`を直接呼び出し

**修正方針**:
- `UPDATE_GROUPS`メッセージをServiceWorkerに送信
- ServiceWorker側でTreeStateManagerを経由して保存

---

#### 問題13: loadTreeState（384-395行目）
**現状**: `chrome.storage.local.get('tree_state')`を直接呼び出し

**修正方針**:
- 初期ロードは`GET_STATE`メッセージで取得
- 以降の更新はSTATE_UPDATEDのペイロードから取得

---

#### 問題14: chrome.storage.onChangedリスナー（473-484行目）
**現状**: `chrome.storage.onChanged`でストレージ変更を検知

**修正方針**:
- STATE_UPDATEDメッセージのペイロードのみで状態更新を受け取る
- `chrome.storage.onChanged`リスナーを削除

---

### 1.2 SidePanelRoot.tsx

#### 問題15: handleNodeClick（123行目）
**現状**: `chrome.tabs.update(tabId, { active: true })`を直接呼び出し

**修正方針**:
- 既存の`ACTIVATE_TAB`メッセージをServiceWorkerに送信
- 直接呼び出しを削除

---

#### 問題16: handlePinnedTabClick（235行目）
**現状**: `chrome.tabs.update(tabId, { active: true })`を直接呼び出し

**修正方針**: handleNodeClickと同様

---

### 1.3 useMenuActions.ts

#### 問題17: close（28行目）
**現状**: `chrome.tabs.remove(tabIds)`を直接呼び出し

**修正方針**:
- 既存の`CLOSE_TAB`メッセージをServiceWorkerに送信
- 複数タブの場合は`CLOSE_TABS`メッセージを追加

---

#### 問題18: closeOthers（41-46行目）
**現状**: `chrome.tabs.query({ currentWindow: true })`、`chrome.tabs.remove(tabIdsToClose)`を直接呼び出し

**修正方針**:
- `CLOSE_OTHER_TABS`メッセージをServiceWorkerに送信
- ServiceWorker側でタブのクエリと削除を実行

---

#### 問題19: duplicate（51-95行目）
**現状**: `chrome.tabs.duplicate`、`chrome.tabs.move`を直接呼び出し

**修正方針**:
- `DUPLICATE_TAB`メッセージをServiceWorkerに送信
- ServiceWorker側で`TreeStateManager.duplicateTab()`を呼び出す
- `duplicateTab()`内部で`chrome.tabs.duplicate()`を呼び、返り値のtabIdで状態を更新

---

#### 問題20: pin/unpin（97-107行目）
**現状**: `chrome.tabs.update`を直接呼び出し

**修正方針**:
- `PIN_TAB`、`UNPIN_TAB`メッセージをServiceWorkerに送信
- ServiceWorker側で`TreeStateManager.pinTab()`または`TreeStateManager.unpinTab()`を呼び出す（メモリ上の状態変更のみ）
- その後`syncTreeStateToChromeTabs()`で実際のピン留め状態を反映

---

#### 問題21: newWindow（109-134行目）
**現状**: `chrome.windows.create`、`chrome.tabs.move`を直接呼び出し

**修正方針**:
- `MOVE_TABS_TO_NEW_WINDOW`メッセージをServiceWorkerに送信
- ServiceWorker側で`TreeStateManager.moveTabsToNewWindow()`を呼び出す（メモリ上の状態変更のみ）
- その後`syncTreeStateToChromeTabs()`で実際のウィンドウ作成・タブ移動を反映

---

#### 問題22: reload（138行目）
**現状**: `chrome.tabs.reload(tabId)`を直接呼び出し

**修正方針**:
- `RELOAD_TAB`メッセージをServiceWorkerに送信
- ServiceWorker側でchrome.tabs.reloadを実行（TreeStateManagerの状態変更不要）

---

#### 問題23: discard（144-172行目）
**現状**: `chrome.tabs.query`、`chrome.tabs.update`、`chrome.tabs.get`、`chrome.tabs.discard`を直接呼び出し

**修正方針**:
- `DISCARD_TAB`メッセージをServiceWorkerに送信
- ServiceWorker側でタブの休止処理を実行（onReplacedイベントでTreeStateManagerが対応）

---

#### 問題24: copyUrl（203行目）
**現状**: `chrome.tabs.get(tabIds[0])`を直接呼び出し

**修正方針**:
- tabInfoMapから情報を取得（STATE_UPDATEDのペイロードに含まれる）
- Chrome APIの直接呼び出しを削除

---

### 1.4 SnapshotManager.ts（Servicesだが、SidePanelから直接呼ばれる場合）

#### 問題25: createSnapshot（107行目）
**現状**: `chrome.tabs.query({})`を直接呼び出し

**修正方針**:
- createSnapshotはServiceWorkerからのみ呼び出すように変更
- SidePanelからは`CREATE_SNAPSHOT`メッセージを送信
- または、読み取り操作のため例外的に許容

---

## 2. ServiceWorker側の修正箇所

### 2.1 event-handlers.ts

**共通方針**:
- イベントハンドラはTreeStateManagerのメソッドでメモリ上の状態を変更
- その後`syncTreeStateToChromeTabs()`でChromeタブの状態を同期
- 生のChrome APIを直接呼ばない（addTab/duplicateTabの例外を除く）

---

#### 問題26: handleTabCreated（669行目、701行目）
**現状**: `chrome.tabs.move`を直接呼び出し

```typescript
// 669行目付近
await chrome.tabs.move(tab.id, { index: insertIndex });

// 701行目付近
await chrome.tabs.move(tab.id, { index: chromeTabIds.length });
```

**修正方針**:
- `handleTabCreated`は`chrome.tabs.onCreated`イベントから呼ばれるため、タブ作成自体はブラウザが行う
- TreeStateManagerでノードを追加（メモリ上の状態変更のみ）
- その後`syncTreeStateToChromeTabs()`でタブ位置を同期
- 個別の`chrome.tabs.move`呼び出しを削除

---

#### 問題27: handleWindowRemoved（1000行目）
**現状**: `chrome.tabs.remove(tabId)`を直接呼び出し（ピン留めタブの削除）

**修正方針**:
- ウィンドウ削除時のピン留めタブ削除は、TreeStateManagerの状態変更後に`syncTreeStateToChromeTabs()`で反映
- 個別の`chrome.tabs.remove`呼び出しを削除

---

#### 問題28: handleActivateTab（1200行目）
**現状**: `chrome.tabs.update(tabId, { active: true })`を直接呼び出し

**修正方針**:
- タブのアクティベーションはUI即時応答が必要なため、例外的に直接呼び出しを許容
- または`TreeStateManager.activateTab()`を追加し、syncメソッド内で実行

**注意**: アクティベーションはTreeStateManagerの状態（タブ順序、ピン留め等）に影響しないため、直接呼び出しでも整合性問題は発生しない。ただし、一貫性のためにTreeStateManager経由にすることも検討。

---

#### 問題29: handleCloseTab（1216行目）
**現状**: `chrome.tabs.remove(tabId)`を直接呼び出し

**修正方針**:
- タブ削除はonRemovedイベントでTreeStateManagerが反応するため、直接呼び出しでも整合性は保たれる
- ただし、一貫性のためにTreeStateManager経由にすることを検討
- 削除後に自動的にonRemovedが発火し、TreeStateManagerが状態を更新

---

#### 問題30: handleCloseSubtree（1252行目）
**現状**: `chrome.tabs.remove(tabIds)`を直接呼び出し

**修正方針**: handleCloseTabと同様

---

#### 問題31: handleCloseSubtreeBatch（1297行目）
**現状**: `chrome.tabs.remove([...allTabIdsToClose])`を直接呼び出し

**修正方針**: handleCloseTabと同様

---

#### 問題32: handleMoveTabToWindow（1319行目）
**現状**: `chrome.tabs.move`を直接呼び出し

**修正方針**:
- `TreeStateManager.moveTabsToWindow()`を使用（メモリ上の状態変更のみ）
- その後`syncTreeStateToChromeTabs()`で実際のウィンドウ移動を反映

---

#### 問題33: handleCreateWindowWithTab（1345行目）
**現状**: `chrome.windows.create({ tabId })`を直接呼び出し

**修正方針**:
- `TreeStateManager.moveTabsToNewWindow()`を使用（メモリ上の状態変更のみ）
- その後`syncTreeStateToChromeTabs()`で実際のウィンドウ作成を反映

---

#### 問題34: handleCreateWindowWithSubtree（1398行目）
**現状**: `chrome.windows.create`、`chrome.tabs.move`を直接呼び出し

**修正方針**:
- `TreeStateManager.moveTabsToNewWindow()`を使用（メモリ上の状態変更のみ）
- その後`syncTreeStateToChromeTabs()`で実際のウィンドウ作成・タブ移動を反映

---

#### 問題35: handleMoveSubtreeToWindow（1461行目）
**現状**: `chrome.tabs.move`を直接呼び出し

**修正方針**:
- `TreeStateManager.moveTabsToWindow()`を使用（メモリ上の状態変更のみ）
- その後`syncTreeStateToChromeTabs()`で実際のウィンドウ移動を反映

---

#### 問題36: handleCreateGroup（1612, 1627, 1632行目）
**現状**: `chrome.tabs.create()`、`chrome.tabs.update()`を直接呼び出し

**修正方針**:
- グループタブの作成は`TreeStateManager.addTab()`を使用（tabId取得のため例外的にChrome API呼び出し）
- URL更新とアクティベーションは`syncTreeStateToChromeTabs()`で反映
- または、グループタブ特有の処理として例外的に許容

---

#### 問題37: handleDuplicateSubtree（1732, 1738行目）
**現状**: `chrome.tabs.get()`、`chrome.tabs.duplicate()`を直接呼び出し

**修正方針**:
- `TreeStateManager.duplicateTab()`を使用（tabId取得のため例外的にChrome API呼び出し）
- サブツリーの複製は複数回のduplicateTab呼び出しで実現

---

#### 問題38: handleRestoreSnapshot（1946, 1966, 1985, 2126行目）
**現状**: `chrome.windows.create()`、`chrome.tabs.create()`、`chrome.tabs.remove()`、`storageService.set()`を直接呼び出し

**修正方針**:
- `TreeStateManager.restoreFromSnapshot()`メソッドを追加
- スナップショットからメモリ上の状態を復元
- 各タブの作成は`addTab()`を使用（tabId取得のため例外的にChrome API呼び出し）
- 既存タブの削除はTreeStateManagerの状態変更後にonRemovedで処理
- その後`syncTreeStateToChromeTabs()`で全体の状態を同期

---

## 3. 新規追加が必要なメッセージタイプ

### SidePanel → ServiceWorker

#### ビュー操作

| メッセージタイプ | 用途 | TreeStateManagerメソッド |
|---|---|---|
| `SWITCH_VIEW` | ビュー切り替え | `switchView()` |
| `CREATE_VIEW` | ビュー作成 | `createView()` |
| `DELETE_VIEW` | ビュー削除 | `deleteView()` |
| `UPDATE_VIEW` | ビュー更新 | `updateView()` |
| `MOVE_TABS_TO_VIEW` | タブをビューに移動 | `moveTabsToView()` |

#### D&D操作

| メッセージタイプ | 用途 | TreeStateManagerメソッド |
|---|---|---|
| `DRAG_END` | D&D操作完了（ツリー内移動） | `moveNodeToParent()` |
| `SIBLING_DROP` | D&D操作完了（兄弟位置への移動） | `moveNodeAsSibling()` |
| `REORDER_PINNED_TAB` | ピン留めタブの並び替え | （ピン留めタブは専用の処理） |

#### タブ操作

| メッセージタイプ | 用途 | TreeStateManagerメソッド |
|---|---|---|
| `PIN_TAB` | タブをピン留め | `pinTab()` |
| `UNPIN_TAB` | タブのピン留め解除 | `unpinTab()` |
| `DUPLICATE_TAB` | タブを複製 | `duplicateTab()` |
| `CLOSE_TABS` | 複数タブを閉じる | （onRemovedで処理） |
| `CLOSE_OTHER_TABS` | 他のタブを閉じる | （onRemovedで処理） |
| `RELOAD_TAB` | タブをリロード | （状態変更なし） |
| `DISCARD_TAB` | タブを休止 | （onReplacedで処理） |

#### ウィンドウ操作

| メッセージタイプ | 用途 | TreeStateManagerメソッド |
|---|---|---|
| `MOVE_TABS_TO_NEW_WINDOW` | 新しいウィンドウにタブを移動 | `moveTabsToNewWindow()` |

#### グループ操作

| メッセージタイプ | 用途 | TreeStateManagerメソッド |
|---|---|---|
| `UPDATE_GROUPS` | グループ情報を更新 | （グループ専用処理） |

### ServiceWorker → SidePanel

| メッセージタイプ | 用途 |
|---|---|
| `STATE_UPDATED` | 状態更新通知（ペイロードに新しい状態を含める） |

### 既存メッセージ（変更なし）

以下のメッセージは既にServiceWorkerで処理されているため、変更不要：
- `ACTIVATE_TAB` - タブのアクティベーション
- `CLOSE_TAB` - 単一タブを閉じる
- `CLOSE_SUBTREE` - サブツリーを閉じる
- `MOVE_TAB_TO_WINDOW` - タブを別ウィンドウに移動
- `CREATE_WINDOW_WITH_TAB` - タブで新ウィンドウ作成
- `CREATE_WINDOW_WITH_SUBTREE` - サブツリーで新ウィンドウ作成
- `MOVE_SUBTREE_TO_WINDOW` - サブツリーを別ウィンドウに移動
- `CREATE_GROUP` - グループ作成
- `DISSOLVE_GROUP` - グループ解除
- `DUPLICATE_SUBTREE` - サブツリーを複製

---

## 4. 実装順序の提案

### Phase 1: 基盤整備
1. STATE_UPDATEDメッセージにペイロードを追加（tabInfoMap、groups、unreadTabs等を含む）
2. TreeStateProvider側でペイロードから状態を受け取るように変更
3. chrome.storage.onChangedリスナーを削除
4. loadTreeState、loadGroups、loadUnreadTabs、loadTabInfoMapをペイロードベースに変更
5. saveGroupsをUPDATE_GROUPSメッセージに変更

### Phase 2: タブアクティベーションの統一
1. SidePanelRoot.tsxのhandleNodeClick、handlePinnedTabClickを既存のACTIVATE_TABメッセージに変更
2. 直接のchrome.tabs.update呼び出しを削除

### Phase 3: useMenuActionsのリファクタリング
1. close、closeOthersを既存メッセージまたは新規CLOSE_TABS、CLOSE_OTHER_TABSメッセージに変更
2. duplicateをDUPLICATE_TABメッセージに変更
3. pin/unpinをPIN_TAB、UNPIN_TABメッセージに変更
4. newWindowをMOVE_TABS_TO_NEW_WINDOWメッセージに変更
5. reload、discardをRELOAD_TAB、DISCARD_TABメッセージに変更
6. copyUrlをtabInfoMapから情報取得に変更

### Phase 4: ビュー操作のリファクタリング
1. SWITCH_VIEW, CREATE_VIEW, DELETE_VIEW, UPDATE_VIEW, MOVE_TABS_TO_VIEWメッセージの追加
2. TreeStateProvider側のビュー操作をメッセージ送信に変更

### Phase 5: D&D操作のリファクタリング
1. DRAG_END, SIBLING_DROP, REORDER_PINNED_TABメッセージの追加
2. handleDragEnd, handleSiblingDrop, handlePinnedTabReorderをメッセージ送信に変更
3. syncTreeToChromeTabs()関数を削除
4. ServiceWorker側でsyncTreeStateToChromeTabs()を呼び出すように変更

### Phase 6: ServiceWorker内のChrome API直接呼び出しの整理
1. handleTabCreatedのchrome.tabs.moveを削除し、syncTreeStateToChromeTabs()経由に変更
2. handleMoveTabToWindow、handleCreateWindowWithTab等をTreeStateManager経由に変更
3. handleCreateGroup、handleDuplicateSubtreeをTreeStateManager経由に変更

### Phase 7: handleRestoreSnapshotのリファクタリング
1. TreeStateManagerにrestoreFromSnapshot()メソッドを追加
2. handleRestoreSnapshotをTreeStateManager経由に変更

### Phase 8: queueStateOperationの削除
リファクタリング完了後、queueStateOperationは不要になる：
- TreeStateManagerのメモリ状態が常に正（Single Source of Truth）
- `loadState()`はブラウザ再起動時のみ使用
- 各ハンドラで`loadState()`を呼ぶ必要がない
- 「loadState→変更→persistState」のアトミック性確保のためのキューイングも不要

---

## 5. 修正箇所サマリー

### 修正箇所数

| カテゴリ | 件数 |
|---------|------|
| TreeStateProvider.tsx | 14件（問題1〜14） |
| SidePanelRoot.tsx | 2件（問題15〜16） |
| useMenuActions.ts | 8件（問題17〜24） |
| SnapshotManager.ts | 1件（問題25） |
| event-handlers.ts | 13件（問題26〜38） |
| **合計** | **38件** |

### Chrome API直接呼び出しの分類

| 分類 | 例 | 方針 |
|------|-----|------|
| 状態変更を伴う操作 | tabs.move, tabs.update({pinned}), windows.create | TreeStateManager経由 + syncTreeStateToChromeTabs() |
| tabIdが必要な操作 | tabs.create, tabs.duplicate | TreeStateManagerメソッド内で例外的に許容 |
| 削除操作 | tabs.remove | 直接呼び出し可（onRemovedでTreeStateManagerが反応） |
| 読み取り操作 | tabs.get, tabs.query | STATE_UPDATEDのペイロードで取得、または必要時のみ許容 |
| UI即時応答操作 | tabs.update({active}) | 例外的に直接呼び出し可、または一貫性のためTreeStateManager経由 |
| 状態変更なし操作 | tabs.reload | 直接呼び出し可（TreeStateManagerの状態に影響なし） |

---

## 6. 注意事項

### 競合状態への対処
- リファクタリング完了後、`queueStateOperation`は不要になる
- TreeStateManagerのメモリ操作は同期的なため、キューイングは不要

### エラーハンドリング
- 例外は握りつぶさず、上位に伝播させる
- 不要なtry-catchは追加しない

### 既存テストへの影響
- メッセージインターフェースの変更に伴い、テストの更新が必要
- E2Eテストは動作確認として使用

### 例外的に直接呼び出しを許容するケース
以下のケースは、TreeStateManager経由ではなく直接Chrome API呼び出しを許容する：

1. **タブ作成時のtabId取得**: `chrome.tabs.create()`、`chrome.tabs.duplicate()`はtabIdを得るために必要
2. **タブ削除**: `chrome.tabs.remove()`は呼び出し後にonRemovedイベントでTreeStateManagerが反応
3. **タブリロード**: `chrome.tabs.reload()`はTreeStateManagerの状態に影響しない
4. **タブアクティベーション**: UI即時応答が必要な場合は例外的に許容（ただし一貫性のためTreeStateManager経由を推奨）

---

## 確認事項

上記の修正箇所（38件）と方針について、実装を開始する前に確認をお願いします。
