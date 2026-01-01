# ギャップ分析ドキュメント

## 1. 分析概要

### スコープ
Vivaldi-TTツリー型タブマネージャーにおける13項目のバグ修正要件に対する既存コードベースのギャップ分析

### 主要な発見事項
- **E2Eテスト基盤**: 66ファイル、873行のポーリングユーティリティが整備済み。ただし9箇所でwaitForTimeoutを使用
- **コア機能**: 全13要件に対応する機能は既に実装済みだが、複数のバグが存在
- **根本原因**: 主にレースコンディション、状態同期の不整合、永続化/復元ロジックの欠陥

---

## 2. 要件-資産マッピング

### Requirement 1: E2Eテストの安定化

| 資産 | 状態 | ギャップ |
|------|------|---------|
| `e2e/utils/polling-utils.ts` (873行) | ✅ 存在 | 20+のポーリング関数が実装済み |
| `e2e/tab-persistence.spec.ts` | ✅ 存在 | polling-utilsを使用した適切な実装 |
| waitForTimeout使用箇所 | ⚠️ 問題あり | 4ファイル9箇所で使用 |

**ギャップ詳細**:
- `ghost-tab-cleanup.spec.ts`: 1箇所
- `settings-tab-title.spec.ts`: 2箇所
- `ui-display.spec.ts`: 3箇所
- `ux-improvements.spec.ts`: 3箇所

**推奨アプローチ**: Option A (既存コンポーネント拡張)
- waitForTimeoutをwaitForConditionに置換
- 必要に応じてpolling-utils.tsに新しいポーリング関数を追加

---

### Requirement 2: サブツリーのドラッグ移動

| 資産 | 状態 | ギャップ |
|------|------|---------|
| `src/sidepanel/hooks/useDragDrop.ts` | ✅ 存在 | ドラッグ制御実装済み |
| `src/sidepanel/components/GapDropDetection.ts` | ✅ 存在 | ドロップ位置計算実装済み |
| `src/sidepanel/components/TabTreeView.tsx` | ✅ 存在 | getSubtreeNodeIds実装済み |
| サブツリー除外ロジック | ⚠️ 不完全 | プレースホルダー位置計算にタイミング問題 |

**発見されたバグ**:
1. **dropIndicatorPositionのmemo依存配列問題** (TabTreeView.tsx:1188-1201)
   - `tabPositionsRef.current`の更新が依存配列に含まれていない
   - スクロール時にプレースホルダー位置がずれる可能性

2. **サブツリードラッグ時のadjacent depthsキャッシュ問題**
   - mousemove中とonDragEnd時で異なるtabPositionsを参照する可能性

**推奨アプローチ**: Option A (既存コンポーネント拡張)
- dropIndicatorPositionの依存配列を修正
- プレースホルダー位置計算のタイミングを統一

---

### Requirement 3 & 8: 新規タブ作成時の親子関係維持

| 資産 | 状態 | ギャップ |
|------|------|---------|
| `src/background/event-handlers.ts` | ✅ 存在 | handleTabCreated実装済み |
| `src/services/TreeStateManager.ts` | ✅ 存在 | addTab, persistState実装済み |
| persistState競合処理 | ❌ 欠損 | レースコンディション対策なし |

**発見されたバグ (最重要)**:

1. **persistState内のレースコンディション** (TreeStateManager.ts:473-515)
   ```typescript
   // 問題: awaitの間に他のpersistState呼び出しが実行される可能性
   const existingState = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
   // この間に状態が変更される可能性
   await this.storageService.set(STORAGE_KEYS.TREE_STATE, treeState);
   ```

2. **syncWithChromeTabs でのdefaultViewId強制設定** (TreeStateManager.ts:317-371)
   - 全タブが'default'ビューに追加される
   - 他のビューに属していたタブのビュー情報が失われる

**推奨アプローチ**: Option C (ハイブリッド)
- persistStateにミューテックスまたはキューイングを導入
- syncWithChromeTabs のビュー情報保持ロジックを改善

---

### Requirement 4: タブのグループ化機能

| 資産 | 状態 | ギャップ |
|------|------|---------|
| `src/services/GroupManager.ts` | ✅ 存在 | グループストレージ管理 |
| `src/services/TreeStateManager.ts` createGroupWithRealTab | ✅ 存在 | グループノード作成 |
| `src/background/event-handlers.ts` handleCreateGroup | ✅ 存在 | グループ作成ハンドラ |
| `src/group/GroupPage.tsx` | ✅ 存在 | グループタブUI |
| グループ作成のレースコンディション対策 | ❌ 欠損 | handleTabCreatedとの競合 |

**発見されたバグ**:

1. **handleCreateGroupのレースコンディション** (event-handlers.ts:923-951)
   - `chrome.tabs.create()` 直後に `handleTabCreated` イベントが発火
   - tabIdがまだツリー状態に登録されていない状態で処理される可能性
   - active: falseで作成しているため、イベント順序が不確定

2. **isGrouped propの未渡し** (TabTreeView.tsx:359-372)
   - コンテキストメニューでグループタブの「グループを解除」が表示されない

3. **dissolveGroupのストレージ未削除** (TreeStateManager.ts:915-961)
   - groupsストレージキーの該当グループエントリが削除されない

**推奨アプローチ**: Option A (既存コンポーネント拡張)
- handleCreateGroupでグループタブ作成前にフラグを設定
- handleTabCreatedでフラグを確認してスキップ

---

### Requirement 5: クロスウィンドウドラッグ

| 資産 | 状態 | ギャップ |
|------|------|---------|
| `src/background/drag-session-manager.ts` | ✅ 存在 | セッション管理実装済み |
| `src/sidepanel/hooks/useCrossWindowDrag.ts` | ✅ 存在 | クロスウィンドウドラッグフック |
| ドラッグアウト判定 | ⚠️ 調査必要 | 誤判定の可能性 |

**調査必要項目**:
- notifyDragOut()とnotifyTreeViewHover()の呼び出しタイミング
- isOutsideTreeフラグの状態遷移

**推奨アプローチ**: Option A (既存コンポーネント拡張)

---

### Requirement 6: 空ウィンドウの自動クローズ

| 資産 | 状態 | ギャップ |
|------|------|---------|
| 既存実装 | 🔍 調査必要 | ドラッグ完了後のウィンドウ状態確認ロジック |

**推奨アプローチ**: Option B (新規コンポーネント作成)
- ウィンドウ監視サービスの追加

---

### Requirement 7: ビューへの新規タブ追加

| 資産 | 状態 | ギャップ |
|------|------|---------|
| `src/services/ViewManager.ts` | ✅ 存在 | ビュー管理 |
| `src/sidepanel/providers/TreeStateProvider.tsx` | ✅ 存在 | 状態プロバイダー |
| currentViewId同期 | ❌ 欠損 | Service WorkerとUI間で同期遅延 |

**発見されたバグ (重要)**:

1. **ビュー状態の同期遅延**
   - Service Workerの`getCurrentViewId()`とTreeStateProviderの状態が不一致
   - ストレージ操作の非同期処理による状態競合

2. **chrome.storage.onChangedリスナーでの状態上書き**
   - 複数のストレージ変更が競合する可能性

**推奨アプローチ**: Option C (ハイブリッド)
- ビュー状態の一元管理
- ストレージアクセスの同期化

---

### Requirement 9: ファビコンの永続化復元

| 資産 | 状態 | ギャップ |
|------|------|---------|
| `STORAGE_KEYS.TAB_FAVICONS` | ✅ 存在 | ストレージキー定義済み |
| ファビコン永続化 (event-handlers.ts:347-357) | ✅ 存在 | バックエンド実装 |
| ファビコン永続化 (TreeStateProvider.tsx:499-510) | ⚠️ 重複 | フロントエンドでも実装 |
| ファビコン復元 (TreeStateProvider.tsx:236-280) | ⚠️ 不完全 | タイミング問題 |

**発見されたバグ**:

1. **永続化の重複実装**
   - バックエンドとフロントエンドの両方でファビコン永続化を実行

2. **復元タイミング問題**
   - Chrome tabs APIがfavIconUrlを返す前に初期レンダリングが完了する可能性
   - Service Worker起動時に永続化ファビコンを読み込む処理がない

**推奨アプローチ**: Option A (既存コンポーネント拡張)
- Service Worker起動時に永続化ファビコンをキャッシング
- 復元後のUI更新を確実にする

---

### Requirement 10: ツリー状態の永続化

| 資産 | 状態 | ギャップ |
|------|------|---------|
| TreeStateManager.persistState() | ✅ 存在 | 永続化実装 |
| TreeStateManager.loadState() | ✅ 存在 | 復元実装 |
| children再構築ロジック | ✅ 存在 | parentIdから再構築 |
| orphanノード修復 | ❌ 欠損 | 親が存在しないノードの処理なし |

**推奨アプローチ**: Option A (既存コンポーネント拡張)
- loadStateにorphanノード検出・修復ロジックを追加

---

### Requirement 11: タブ複製時の配置

| 資産 | 状態 | ギャップ |
|------|------|---------|
| 複製タブ処理 | 🔍 調査必要 | 兄弟タブとしての配置ロジック |

**推奨アプローチ**: Option A (既存コンポーネント拡張)

---

### Requirement 12: リンクから開いたタブの配置設定

| 資産 | 状態 | ギャップ |
|------|------|---------|
| event-handlers.ts (行157-171) | ✅ 存在 | newTabPositionFromLink設定 |
| 設定反映ロジック | ⚠️ 不完全 | 「リストの最後」設定が正しく動作しない |

**推奨アプローチ**: Option A (既存コンポーネント拡張)
- 設定反映ロジックのデバッグと修正

---

### Requirement 13: 未読インジケーターの復元時制御

| 資産 | 状態 | ギャップ |
|------|------|---------|
| `src/services/UnreadTracker.ts` | ✅ 存在 | 未読追跡サービス |
| 復元時の未読状態制御 | 🔍 調査必要 | 復元タブの未読フラグ初期化 |

**推奨アプローチ**: Option A (既存コンポーネント拡張)

---

## 3. 実装アプローチ比較

### Option A: 既存コンポーネント拡張

**適用要件**: R1, R2, R4, R5, R9, R10, R11, R12, R13

**メリット**:
- 既存パターンの活用
- 最小限の新規コード
- 既存テストの再利用

**デメリット**:
- 既存コードの複雑化リスク
- 依存関係の増加

### Option B: 新規コンポーネント作成

**適用要件**: R6

**メリット**:
- 責務の明確な分離
- テストしやすい

**デメリット**:
- 新規ファイルの追加
- 統合作業が必要

### Option C: ハイブリッドアプローチ

**適用要件**: R3, R7, R8

**メリット**:
- 根本的な問題解決
- 長期的な保守性向上

**デメリット**:
- 実装コストが高い
- 既存テストへの影響

---

## 4. 工数・リスク評価

| 要件 | 工数 | リスク | 理由 |
|------|------|--------|------|
| R1: E2Eテスト安定化 | S | Low | waitForTimeout置換のみ |
| R2: サブツリードラッグ | M | Medium | タイミング問題の解決が必要 |
| R3: 親子関係維持 | L | High | レースコンディション対策が必要 |
| R4: グループ化 | M | Medium | レースコンディション対策が必要 |
| R5: クロスウィンドウ | M | Medium | 既存実装のデバッグ |
| R6: 空ウィンドウクローズ | S | Low | シンプルな条件判定 |
| R7: ビュー新規タブ | L | High | 状態同期の根本解決が必要 |
| R8: 親子関係不整合 | L | High | R3と同じ根本原因 |
| R9: ファビコン復元 | M | Medium | タイミング問題の解決 |
| R10: ツリー永続化 | M | Medium | orphanノード対策 |
| R11: タブ複製配置 | S | Low | 配置ロジック修正 |
| R12: リンクタブ配置 | S | Low | 設定反映修正 |
| R13: 未読インジケーター | S | Low | 復元時フラグ制御 |

---

## 5. 設計フェーズへの推奨事項

### 優先度: 高

1. **persistStateのレースコンディション対策** (R3, R7, R8)
   - ミューテックスまたはキューイング機構の導入
   - ストレージ操作の原子性確保

2. **グループ化のイベント順序制御** (R4)
   - handleTabCreatedとhandleCreateGroupの調整

### 優先度: 中

3. **ファビコン復元タイミング** (R9)
   - Service Worker起動時のキャッシング

4. **サブツリードラッグのプレースホルダー** (R2)
   - memo依存配列の修正

5. **E2EテストのwaitForTimeout除去** (R1)
   - ポーリング関数への置換

### 優先度: 低

6. **その他のバグ修正** (R5, R6, R10, R11, R12, R13)
   - 個別のデバッグと修正

### 追加調査が必要な項目

- R5: クロスウィンドウドラッグのドラッグアウト誤判定の再現手順
- R6: 空ウィンドウ自動クローズの既存実装状況
- R11: タブ複製時の配置ロジック詳細
- R13: 未読インジケーターの復元時制御の詳細

---

## 6. 技術的制約

1. **Chrome Extensions API の制約**
   - 非同期APIのため、状態同期にタイムラグが発生
   - Service WorkerとSide Panelは別プロセス

2. **IndexedDB / chrome.storage の制約**
   - 非同期操作のため、レースコンディションが発生しやすい
   - トランザクション機能が限定的

3. **React状態管理の制約**
   - 非同期更新のため、UI反映にタイムラグ
   - useEffect依存配列の管理が複雑

---

## 7. 次のステップ

1. `/kiro:spec-design tree-stability-v2` を実行して技術設計を作成
2. 優先度の高い問題（persistStateレースコンディション）から対処
3. 各要件に対するE2Eテストを追加・修正
