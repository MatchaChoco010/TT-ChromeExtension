# 状態管理アーキテクチャ リファクタリング計画

## 概要

TreeStateManager（Service Worker）をSingle Source of Truthとし、状態管理の一貫性を確保するためのリファクタリング計画。

## 現状の問題点

### 1. 二重の状態管理

現在、状態を変更する経路が2つ存在する：

**経路A: Service Worker経由（正しい）**
```
Chromeイベント → event-handlers.ts → TreeStateManager → UI/Chrome
```

**経路B: Side Panel直接（問題あり）**
```
UI操作 → TreeStateProvider.tsx → chrome.storage.local → （TreeStateManagerを経由しない）
```

### 2. レースコンディションの発生

- Side Panelの`handleDragEnd`が直接`chrome.storage.local`に書き込む
- その後`chrome.tabs.move()`を呼び出す
- これが`onMoved`イベントを発火させ、`handleTabMoved`が実行される
- `handleTabMoved`はTreeStateManagerのメモリ（古い状態）を使って同期しようとする
- 結果：状態の不整合、タブ順序の巻き戻り

### 3. 共有メモリ（chrome.storage.local）を介した非同期通信

- STATE_UPDATEDメッセージを受け取った後にストレージを読み込む設計
- 「書き込み → 通知 → 読み込み」の間に別の書き込みが入る可能性
- メッセージと状態の1対1対応が保証されない

### 4. chrome.storage.localの一貫性の不確実性

- Service WorkerとSide Panelは異なるプロセスで動作
- `chrome.storage.local`の強い一貫性（read-after-write保証）は公式ドキュメントで明記されていない
- Service Workerで`await chrome.storage.local.set()`が完了しても、Side Panelで即座に最新値が読めるとは限らない可能性
- フレーキーテスト（タブがUIに表示されない、expanded状態の不一致）の原因となりうる

### 5. 異常系の検出困難

- `handleTabCreated`内の早期リターンが静かにNOOPを返す
- タブが作成されずにテストが失敗しても、どの条件でスキップされたか特定が困難
- 正常系では起こり得ない異常を検出・報告する仕組みがない

## 目標アーキテクチャ

```
Action（UI操作/Chromeイベント）
    │
    ▼
Service Worker (event-handlers.ts)
    │
    ▼
TreeStateManager
    │
    ├──→ メモリ上の状態を変更（純粋な状態変更）
    │    ※例外: addTab/duplicateTabのみtabId取得のためChrome API呼び出し
    │
    ├──→ syncTreeStateToChromeTabs() → Chrome APIs
    │         TreeStateManagerの状態を正として、Chromeタブを同期
    │         - 順序（chrome.tabs.move）
    │         - ピン留め（chrome.tabs.update({pinned})）
    │         - ウィンドウ配置（chrome.tabs.move({windowId})）
    │
    ├──→ persistState() → chrome.storage.local (永続化のみ)
    │
    └──→ sendMessage({ type: 'STATE_UPDATED', payload: state })
              │
              ▼
         Side Panel (React state更新 → UI再レンダリング)
```

**原則**:
1. **TreeStateManager（Service Worker）がSingle Source of Truth**
2. **TreeStateManagerのメソッドは純粋にメモリ上の状態変更のみ**（addTab/duplicateTabのみ例外：tabIdを得るためChrome APIが必要）
3. **`syncTreeStateToChromeTabs()`でChromeタブの状態をTreeStateManagerに合わせる** - 順序、ピン留め、ウィンドウ配置など全てを同期
4. **Chrome APIを直接呼ぶのはsyncメソッド内のみ**（addTab/duplicateTabの例外を除く）
5. chrome.storage.localは永続化専用（ブラウザ再起動時の復元用）
6. リアルタイム同期にはメッセージの引数（payload）を使用
7. Side Panelは読み取り専用（状態変更はService Workerにメッセージを送信）

## 変更対象ファイル

### 1. TreeStateManager.ts

**変更内容**:
- `toJSON()`メソッドの確認・最適化（シリアライズ可能な形式への変換）
- 状態変更後に`STATE_UPDATED`メッセージを送信するヘルパーメソッド追加

**追加するメソッド**:
```typescript
/**
 * 状態変更後の通知を送信
 * payloadにシリアライズした状態を含める
 */
notifyStateChanged(): void {
  const serializedState = this.toJSON();
  chrome.runtime.sendMessage({
    type: 'STATE_UPDATED',
    payload: serializedState
  });
}
```

### 2. event-handlers.ts

**変更内容**:
- 各ハンドラーで`STATE_UPDATED`送信時にpayloadを含める
- Side Panelからのアクションを処理する新しいメッセージハンドラーを追加
- 異常系の早期リターンを例外に変更（Phase 0で実施）

**追加するメッセージタイプ**:

| メッセージタイプ | 用途 | パラメータ |
|-----------------|------|-----------|
| `MOVE_NODE` | ノードを別の親の子として移動 | `nodeId`, `targetParentId`, `targetIndex` |
| `MOVE_NODE_AS_SIBLING` | ノードを兄弟として移動（Gap drop） | `nodeId`, `aboveNodeId`, `belowNodeId` |
| `SWITCH_VIEW` | ビュー切り替え | `viewId`, `windowId` |
| `CREATE_VIEW` | ビュー作成 | - |
| `DELETE_VIEW` | ビュー削除 | `viewId` |
| `UPDATE_VIEW` | ビュー更新 | `viewId`, `updates` |
| `MOVE_TABS_TO_VIEW` | タブをビューに移動 | `viewId`, `tabIds` |
| `REORDER_PINNED_TAB` | ピン留めタブの並び替え | `tabId`, `newIndex` |

**既存ハンドラーの修正**:
```typescript
// Before
chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });

// After
chrome.runtime.sendMessage({
  type: 'STATE_UPDATED',
  payload: treeStateManager.toJSON()
});
```

### 3. TreeStateProvider.tsx

**削除する機能**:
- `updateTreeState`での直接的な`chrome.storage.local.set()`呼び出し
- `handleDragEnd`内の`chrome.tabs.move()`呼び出し
- `handleSiblingDrop`内の`chrome.tabs.move()`呼び出し
- `handlePinnedTabReorder`内の`chrome.tabs.move()`呼び出し
- `syncTreeToChromeTabs()`関数

**変更する機能**:

#### handleDragEnd
```typescript
// Before: 直接状態を更新してchrome.tabs.move()を呼び出す
const handleDragEnd = useCallback(async (event: DragEndEvent) => {
  // ... ノード計算 ...
  await updateTreeState(newTreeState);
  await syncTreeToChromeTabs(newViewState, tabInfoMap);
  chrome.runtime.sendMessage({ type: 'REFRESH_TREE_STRUCTURE' });
}, [...]);

// After: Service Workerにメッセージを送信
const handleDragEnd = useCallback(async (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  await chrome.runtime.sendMessage({
    type: 'MOVE_NODE',
    nodeId: active.id,
    targetParentId: over.id,
    selectedNodeIds: Array.from(selectedNodeIds)
  });
}, [selectedNodeIds]);
```

#### handleSiblingDrop
```typescript
// After: Service Workerにメッセージを送信
const handleSiblingDrop = useCallback(async (info: SiblingDropInfo) => {
  await chrome.runtime.sendMessage({
    type: 'MOVE_NODE_AS_SIBLING',
    nodeId: info.activeNodeId,
    aboveNodeId: info.aboveNodeId,
    belowNodeId: info.belowNodeId,
    selectedNodeIds: Array.from(selectedNodeIds)
  });
}, [selectedNodeIds]);
```

#### switchView
```typescript
// After: Service Workerにメッセージを送信
const switchView = useCallback(async (viewId: string) => {
  await chrome.runtime.sendMessage({
    type: 'SWITCH_VIEW',
    viewId,
    windowId: currentWindowId
  });
}, [currentWindowId]);
```

#### STATE_UPDATEDハンドラー
```typescript
// Before: ストレージから読み込む
const messageListener = (message: { type: string }) => {
  if (message.type === 'STATE_UPDATED') {
    processStateUpdate(); // chrome.storage.local.get()を呼ぶ
  }
};

// After: payloadから直接状態を取得
const messageListener = (message: { type: string; payload?: TreeState }) => {
  if (message.type === 'STATE_UPDATED' && message.payload) {
    const reconstructedState = reconstructChildrenReferences(message.payload);
    setTreeState(reconstructedState);
    // tabInfoMapなどは別途loadTabInfoMap()で更新
  }
};
```

### 4. TreeStateManager.tsに追加するメソッド

#### 設計原則

1. **TreeStateManagerのメソッドは純粋にメモリ上の状態変更のみ**（`addTab`と`duplicateTab`のみ例外：tabIdを得るためにChrome APIが必要）
2. **`syncTreeStateToChromeTabs()`でChromeタブの状態をTreeStateManagerに合わせる** - 順序、ピン留め状態、ウィンドウ配置など全てを同期
3. **Chrome APIを直接呼ぶのはsyncメソッド内のみ**（addTab/duplicateTabの例外を除く）

#### 4.1 syncメソッドの拡張

現在の`syncTreeOrderToChromeTabs()`を拡張し、`syncTreeStateToChromeTabs()`として以下を同期：

```typescript
/**
 * TreeStateManagerの状態をChromeタブに反映
 * - タブの順序（chrome.tabs.move）
 * - ピン留め状態（chrome.tabs.update({pinned: ...})）
 * - ウィンドウ配置（chrome.tabs.move({windowId: ...})）
 */
async syncTreeStateToChromeTabs(): Promise<void> {
  // TreeStateManagerの状態を正として、Chromeタブを同期
  // 1. 各タブのピン留め状態を同期
  // 2. 各タブのウィンドウ配置を同期
  // 3. 各タブの順序を同期
}
```

#### 4.2 タブ作成メソッド（例外的にChrome API呼び出しを含む）

```typescript
/**
 * タブをツリーに追加（tabIdを得るためにchrome.tabs.create()を呼ぶ）
 * @param options - chrome.tabs.createに渡すオプション
 * @param position - 追加位置（'end': 末尾, 'child': 親の子として, 'afterOpener': openerの直後）
 * @param parentNodeId - position='child'の場合の親ノードID
 * @param viewId - 追加先のビューID
 * @returns 作成されたタブのID
 */
async addTab(
  options: chrome.tabs.CreateProperties,
  position: 'end' | 'child' | 'afterOpener',
  parentNodeId?: string,
  viewId?: string
): Promise<number> {
  const tab = await chrome.tabs.create(options);
  if (!tab.id) throw new Error('Failed to create tab');
  // メモリ上の状態を更新（positionに応じて適切な位置に配置）
  // ...
  return tab.id;
}

/**
 * タブを複製（tabIdを得るためにchrome.tabs.duplicate()を呼ぶ）
 */
async duplicateTab(tabId: number): Promise<number> {
  const tab = await chrome.tabs.duplicate(tabId);
  if (!tab?.id) throw new Error('Failed to duplicate tab');
  // 複製元の直後に配置するよう状態を更新
  // ...
  return tab.id;
}
```

#### 4.3 ツリー構造操作メソッド（純粋にメモリ上の状態変更のみ）

```typescript
/**
 * タブをピン留め状態に変更（ツリーから除去）
 * 実際のピン留めはsyncTreeStateToChromeTabs()で反映
 */
pinTab(tabId: number): void {
  // メモリ上の状態を更新（ノードをツリーから除去、ピン留めリストに追加）
}

/**
 * タブのピン留めを解除（ツリーに追加）
 * 実際のピン留め解除はsyncTreeStateToChromeTabs()で反映
 */
unpinTab(tabId: number, viewId?: string): void {
  // メモリ上の状態を更新（ピン留めリストから除去、ツリーに追加）
}

/**
 * タブを新しいウィンドウに移動する状態に変更
 * 実際のウィンドウ作成・移動はsyncTreeStateToChromeTabs()で反映
 */
moveTabsToNewWindow(tabIds: number[]): void {
  // メモリ上の状態を更新（新しいウィンドウIDを割り当て）
  // ※新規ウィンドウ作成はsyncメソッドで行う
}

/**
 * タブを別のウィンドウに移動する状態に変更
 * 実際の移動はsyncTreeStateToChromeTabs()で反映
 */
moveTabsToWindow(tabIds: number[], targetWindowId: number): void {
  // メモリ上の状態を更新
}

/**
 * ノードを別の親の子として移動
 */
moveNodeToParent(nodeId: string, targetParentId: string, index: number): void {
  // メモリ上の状態を更新
}

/**
 * ノードを兄弟として移動（Gap drop）
 */
moveNodeAsSibling(nodeId: string, aboveNodeId: string | null, belowNodeId: string | null): void {
  // メモリ上の状態を更新
}

/**
 * ビューを切り替え
 */
switchView(viewId: string, windowId: number): void {
  // メモリ上の状態を更新
}

/**
 * タブをビューに移動
 */
moveTabsToView(viewId: string, tabIds: number[]): void {
  // メモリ上の状態を更新
}
```

#### 4.4 イベントハンドラでの使用パターン

```typescript
// イベントハンドラでの使用例
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

## 実装順序

### Phase 0: 診断強化（異常系の検出）

**目的**: フレーキーテストの原因特定を容易にするため、異常系を検出可能にする

**handleTabCreatedの早期リターン分析**:

| 条件 | 分類 | 対応 |
|------|------|------|
| `!tab.id` | 正常系 | ログのみ（Chrome APIの仕様） |
| `waitForSyncComplete() === false` | **異常系** | 例外をthrow |
| `existingNode` | 正常系 | ログのみ（重複防止） |
| `isCreatingGroupTab && pendingGroupTabIds` | 正常系 | ログのみ（グループタブフロー） |
| `isGroupTabUrl` | 正常系 | ログのみ（グループタブスキップ） |
| `tabs.get failed` | **異常系** | 例外をthrow |
| `isRestoringSnapshot` | 正常系 | ログのみ（スナップショット復元中） |

**変更内容**:

1. **event-handlers.ts**
   - `waitForSyncComplete()`がfalseを返した場合に例外をthrow
   - `chrome.tabs.get()`が失敗した場合は例外をそのまま伝播（catchしない）
   - 例外はChrome拡張機能のエラーログとして自動的に記録される（明示的なcatchは不要）

```typescript
// Before
if (!completed) {
  logTabCreation(tab.id, `handleTabCreatedInternal EARLY_RETURN: syncNotCompleted`);
  return;
}

// After
if (!completed) {
  throw new Error(`Sync did not complete within timeout for tab ${tab.id}`);
}
```

```typescript
// Before
try {
  const refreshedTab = await chrome.tabs.get(tab.id);
  // ...
} catch {
  return;  // 例外を握りつぶしている
}

// After
const refreshedTab = await chrome.tabs.get(tab.id);  // 例外はそのまま伝播
// ...
```

**注意**: TreeStateManagerがSingle Source of Truthになった後、`loadState()`の呼び出しが不要になる。その過程で`handleTabCreated`の構造が大きく変わる可能性があるため、Phase 1の修正と合わせて再評価する。

### Phase 1: メッセージ基盤の整備

1. **TreeStateManager.tsの修正**
   - `notifyStateChanged()`メソッド追加
   - `toJSON()`の最適化（必要に応じて）

2. **event-handlers.tsの修正**
   - 既存のSTATE_UPDATED送信箇所にpayload追加
   - 新しいメッセージタイプのハンドラー追加（空実装）
   - `handleTabCreated`から`loadState()`呼び出しを削除（TreeStateManagerのメモリが正）

3. **TreeStateProvider.tsxの修正**
   - STATE_UPDATEDハンドラーをpayload対応に変更
   - ストレージ読み込みのフォールバックを残す（移行期間中）

### Phase 2: ドラッグ&ドロップの移行

4. **TreeStateManager.tsに移動ロジック追加**
   - `moveNodeToParent()`実装
   - `moveNodeAsSibling()`実装

5. **event-handlers.tsにハンドラー追加**
   - `handleMoveNode()`実装
   - `handleMoveNodeAsSibling()`実装

6. **TreeStateProvider.tsxの修正**
   - `handleDragEnd`をメッセージ送信に変更
   - `handleSiblingDrop`をメッセージ送信に変更
   - `syncTreeToChromeTabs()`削除

### Phase 3: ビュー操作の移行

7. **TreeStateManager.tsにビュー操作追加**
   - `switchView()`実装
   - `createView()`実装
   - `deleteView()`実装
   - `updateView()`実装
   - `moveTabsToView()`実装

8. **event-handlers.tsにハンドラー追加**
   - `handleSwitchView()`実装
   - `handleCreateView()`実装
   - `handleDeleteView()`実装
   - `handleUpdateView()`実装
   - `handleMoveTabsToView()`実装

9. **TreeStateProvider.tsxの修正**
   - 各ビュー操作をメッセージ送信に変更

### Phase 4: ピン留めタブの移行

10. **event-handlers.tsにハンドラー追加**
    - `handleReorderPinnedTab()`実装

11. **TreeStateProvider.tsxの修正**
    - `handlePinnedTabReorder`をメッセージ送信に変更

### Phase 5: クリーンアップ

12. **TreeStateProvider.tsxから不要なコード削除**
    - `updateTreeState`のストレージ書き込み削除
    - `chrome.storage.onChanged`リスナーの削除（STATE_UPDATEDのみで十分）
    - フォールバックコードの削除

13. **テストの更新**
    - ユニットテストの更新
    - E2Eテストの確認

### Phase 6: queueStateOperationのリファクタリング

**背景**:

現在、`queueStateOperation`は多くのイベントハンドラーで使用されているが、本来の目的は「loadState→メモリ変更→persistState」のアトミック性確保のみ。TreeStateManagerがSingle Source of Truthになれば、loadState()の呼び出しが不要になり、queueStateOperationの必要性も変わる。

**現状のqueueStateOperation使用箇所**:

| ハンドラー | loadState呼び出し | queueStateOperation必要性 |
|-----------|------------------|-------------------------|
| handleTabCreated | あり | 現状は必要（リファクタ後は不要） |
| handleTabRemoved | あり | 現状は必要（リファクタ後は不要） |
| handleTabMoved | なし | **不要** |
| handleTabActivated | なし | **不要** |
| handleTabUpdated | なし | **不要** |
| handleTabReplaced | あり | 現状は必要（リファクタ後は不要） |
| handleWindowRemoved | あり | 現状は必要（リファクタ後は不要） |
| handleUpdateTree | なし | **不要** |
| handleCloseSubtree | なし | **不要** |
| handleCreateGroup | なし | **不要** |
| handleDissolveGroup | なし | **不要** |
| handleMoveTabToWindow | なし | **不要** |
| handleCreateWindowWithTab | なし | **不要** |
| handleSyncTabs | あり | 現状は必要（リファクタ後は不要） |
| service-worker初期化 | あり | 現状は必要（リファクタ後は不要） |

**リファクタリング方針**:

1. **updateState APIの導入**（TreeStateManager.ts）

```typescript
/**
 * 状態変更をアトミックに実行する
 * loadState→変更→persistStateをカプセル化
 */
async updateState<T>(
  operation: (state: TreeStateManager) => Promise<T>
): Promise<T> {
  // キューで直列化
  return this.enqueue(async () => {
    await this.loadState();
    const result = await operation(this);
    await this.persistState();
    return result;
  });
}
```

2. **loadStateが不要になった後の簡素化**

TreeStateManagerがSingle Source of Truthになれば：
- loadState()はブラウザ再起動時のみ使用
- 各ハンドラーでloadState()を呼ぶ必要がない
- queueStateOperationは不要になる
- 状態変更はTreeStateManagerのメソッドを直接呼び出すだけ

```typescript
// Before（現状）
return queueStateOperation(async () => {
  await treeStateManager.loadState();
  // 状態変更
  await treeStateManager.persistState();
  chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
}, 'handleSomething');

// After（リファクタ後）
// 状態変更
treeStateManager.someMethod(...);
await treeStateManager.persistState();
treeStateManager.notifyStateChanged();
```

3. **不要なqueueStateOperation呼び出しの削除**

Phase 1〜5の完了後、以下のハンドラーからqueueStateOperationを削除：
- handleTabMoved
- handleTabActivated
- handleTabUpdated
- handleUpdateTree
- handleCloseSubtree
- handleCreateGroup
- handleDissolveGroup
- handleMoveTabToWindow
- handleCreateWindowWithTab

4. **loadState呼び出しの削除**

以下のハンドラーから`await treeStateManager.loadState()`を削除：
- handleTabCreated
- handleTabRemoved
- handleTabReplaced
- handleWindowRemoved
- handleSyncTabs
- service-worker初期化

**実装順序**:

14. **Phase 1〜5完了後に実施**
    - loadState()を呼んでいるハンドラーからloadState()を削除
    - queueStateOperationでラップしていないloadState不要ハンドラーからqueueStateOperationを削除
    - queueStateOperation自体を削除または簡素化

15. **テストの確認**
    - 競合状態が発生しないことを確認
    - E2Eテスト50回連続成功

## テスト計画

### ユニットテスト

- TreeStateManager.tsの新メソッドのテスト
- event-handlers.tsの新ハンドラーのテスト

### E2Eテスト

各Phase完了後にE2Eテストを実行し、リグレッションがないことを確認：

```bash
# 10回実行してフレーキーがないことを確認
for i in {1..10}; do
  npm run test:e2e 2>&1 | tee e2e-phase-X-run-$i.log
  grep -E "failed|passed" e2e-phase-X-run-$i.log
done
```

### 確認すべきシナリオ

1. **ドラッグ&ドロップ**
   - 親の子としてドロップ
   - 兄弟としてドロップ（Gap drop）
   - 複数選択してドロップ
   - 折りたたまれたタブのドロップ

2. **ビュー操作**
   - ビュー切り替え
   - ビュー作成・削除
   - タブのビュー間移動

3. **ピン留めタブ**
   - ピン留めタブの並び替え

4. **複数ウィンドウ**
   - 複数ウィンドウでの同時操作
   - ウィンドウ間のタブ移動後の状態同期

## リスクと対策

### リスク1: 移行期間中の不整合

**対策**: Phase 1でフォールバックを残し、段階的に移行

### リスク2: メッセージのペイロードサイズ

**対策**:
- toJSON()で必要最小限のデータのみシリアライズ
- 大きな状態の場合は差分送信を検討（将来的）

### リスク3: メッセージ処理の順序

**対策**:
- Phase 6完了前: queueStateOperationで直列化を維持
- Phase 6完了後: TreeStateManagerのメモリ操作は同期的なため、queueStateOperation不要

## 完了条件

1. Side Panelから`chrome.storage.local`への直接書き込みがゼロ
2. Side Panelから`chrome.tabs.*`、`chrome.windows.*`の直接呼び出しがゼロ
3. **ServiceWorkerのイベントハンドラから生のChrome API呼び出しがゼロ** - `chrome.tabs.create()`、`chrome.tabs.update()`、`chrome.tabs.move()`、`chrome.windows.create()`等は全てTreeStateManagerのメソッド内でのみ呼び出す
4. すべての状態変更がTreeStateManagerを経由している
5. E2Eテストが50回連続成功
6. 型チェック・ユニットテストがすべてパス
7. 異常系の早期リターンが例外として検出可能になっている
8. イベントハンドラーから`loadState()`呼び出しがゼロ（ブラウザ起動時の初期化を除く）
9. 不要な`queueStateOperation`呼び出しがゼロ
