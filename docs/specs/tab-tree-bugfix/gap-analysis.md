# Gap Analysis Document

## 分析サマリー

- **スコープ**: タブ状態の永続化・復元、UI表示の一貫性、ドラッグ＆ドロップ、グループ化、複数ウィンドウ対応の12要件
- **主要な課題**: 既存の永続化・復元ロジックには構造的な問題があり、休止タブ（discarded）の表示や正確な復元ロジックが不足している
- **実装の複雑性**: ドラッグ＆ドロップのプレースホルダー位置とドロップ処理は既存実装があるが、バグ修正が必要
- **推奨アプローチ**: 既存コンポーネントを拡張・修正する形でのバグ修正（新規実装ではなくバグ修正中心）

### 主要な発見されたバグ（実装済みとされていたが動作していない機能）

1. **Req 1.3 タイトル永続化**: `tab.title || persistedTitle`の優先順位で永続化タイトルが無視される
2. **Req 2.2 スタートページタイトル**: 正規表現がクエリパラメータ付きURLを判定できない
3. **Req 9.1 ツリー外ドラッグ検知**: dnd-kitの`event.over`がツリー外でもnullにならない
4. **Req 12.1 複数ウィンドウ対応**: `loadCurrentWindowId()`が`chrome.windows.getCurrent()`を呼び出さずnullのまま

---

## 1. 要件と既存実装のマッピング

### Requirement 1: タブ状態の永続化と復元

| 受け入れ基準 | 既存実装 | ギャップ |
|-------------|---------|----------|
| 1.1 前回のタブ情報を正確に復元 | `TreeStateManager.ts` - `loadState()`, `syncWithChromeTabs()` | **バグあり** - 同期ロジックに問題があり、不要な「Loading」タブが生成される |
| 1.2 余分なLoadingタブを生成しない | `event-handlers.ts` - `handleTabCreated()` | **バグあり** - 起動時の同期処理で実タブと永続化データの整合性チェックが不十分 |
| 1.3 タイトル変更時に即座に永続化 | `TitlePersistenceService.ts` | **バグあり** - `saveTitle()`は呼ばれているが、`loadTabInfoMap()`でタイトル復元時に`tab.title \|\| persistedTitle`の優先順位が誤っており、古いタイトルが表示され続ける。ページ遷移後のタイトル更新が永続化されていない可能性あり |
| 1.4 ファビコン変更時に即座に永続化 | 未実装 | **未実装** - ファビコンの永続化サービスが存在しない |
| 1.5 不整合エントリの削除 | `TreeStateManager.syncWithChromeTabs()` | **バグあり** - 同期ロジックの精査が必要 |

**関連ファイル:**
- `src/services/TreeStateManager.ts:167-233` (syncWithChromeTabs)
- `src/services/TitlePersistenceService.ts`
- `src/background/event-handlers.ts:208-234` (handleTabUpdated)
- `src/sidepanel/providers/TreeStateProvider.tsx:238` (タイトル復元ロジック - 優先順位の問題)

**発見されたバグ:**
- `TreeStateProvider.tsx:238`で `const title = tab.title || persistedTitle || '';` となっているが、この優先順位ではChrome APIから返されるtab.titleが空でない限り永続化タイトルが無視される
- ページ遷移でタイトルが変わった後、ブラウザを再起動すると古いタイトルが表示される問題は、永続化タイミングまたは復元ロジックのバグが原因

**実装アプローチ:**
- **オプションA (推奨)**: 既存の `TitlePersistenceService` を拡張してファビコン永続化も追加
- **オプションB**: 新規 `FaviconPersistenceService` を作成
- タイトル復元ロジックの優先順位を見直し（ローディング中のタブのみ永続化タイトルを使用するなど）

---

### Requirement 2: UI表示の一貫性

| 受け入れ基準 | 既存実装 | ギャップ |
|-------------|---------|----------|
| 2.1 フォントサイズ設定の反映 | `ThemeProvider.tsx` - CSS変数 `--font-size` | **部分的** - タブタイトルに適用されていない可能性 |
| 2.2 スタートページのタイトル表示 | `TreeNode.tsx` - `getDisplayTitle()` | **バグあり** - `isInternalOrNewTabUrl()` の正規表現がクエリパラメータ付きURLを正しく判定できない（例: `vivaldi://startpage?section=Speed%20Dial` がマッチしない） |

**関連ファイル:**
- `src/sidepanel/providers/ThemeProvider.tsx:120-131` (CSSスタイル適用)
- `src/sidepanel/components/TreeNode.tsx:27-40` (内部URL判定)
- `src/sidepanel/components/TabTreeView.tsx:263` (タイトル表示)

**実装アプローチ:**
- TabTreeView内のタイトル表示部分が `text-sm` 固定になっている。CSS変数を参照するように修正

---

### Requirement 3: 休止タブの視覚的区別

| 受け入れ基準 | 既存実装 | ギャップ |
|-------------|---------|----------|
| 3.1 休止タブをグレーアウト表示 | 未実装 | **未実装** - `discarded` プロパティの参照・表示ロジックなし |
| 3.2 アクティブ化時にグレーアウト解除 | 未実装 | **未実装** |

**関連ファイル:**
- `src/types/index.ts:15-21` (TabInfo - discardedプロパティ未定義)
- `src/sidepanel/components/TabTreeView.tsx` (表示コンポーネント)

**実装アプローチ:**
- TabInfo型に `discarded` プロパティを追加
- タブ情報取得時に `discarded` 状態を含める
- TabTreeView/TreeNodeでスタイル条件分岐を追加

---

### Requirement 4: テキスト選択の禁止

| 受け入れ基準 | 既存実装 | ギャップ |
|-------------|---------|----------|
| 4.1 テキスト要素をuser-select: none | `TreeNode.tsx:169` - `select-none` クラス | **実装済み** |
| 4.2 Shift+クリック時のテキスト選択防止 | 同上 | **要検証** - E2Eテストで確認必要 |

**関連ファイル:**
- `src/sidepanel/components/TreeNode.tsx:169`
- `src/sidepanel/components/TabTreeView.tsx:203`

---

### Requirement 5: アクティブタブのハイライト

| 受け入れ基準 | 既存実装 | ギャップ |
|-------------|---------|----------|
| 5.1 通常タブのハイライト | `TabTreeView.tsx:203` - `isActive && !isDragging` | **実装済み** |
| 5.2 ピン留めタブのハイライト | `PinnedTabsSection.tsx` | **未実装** - アクティブ状態のスタイルがない |
| 5.3 前アクティブタブのハイライト解除 | 状態管理で対応 | **要検証** |
| 5.4 常に1つのタブのみハイライト | 状態管理で対応 | **要検証** |

**関連ファイル:**
- `src/sidepanel/components/PinnedTabsSection.tsx:72` (スタイルにアクティブ状態なし)
- `src/sidepanel/providers/TreeStateProvider.tsx` (activeTabId管理)

**実装アプローチ:**
- PinnedTabsSectionにactiveTabIdをpropsとして渡し、アクティブなピン留めタブをハイライト表示

---

### Requirement 6: ドラッグ＆ドロップ - プレースホルダー表示

| 受け入れ基準 | 既存実装 | ギャップ |
|-------------|---------|----------|
| 6.1 有効なドロップ位置にのみ表示 | `GapDropDetection.ts`, `DropIndicator.tsx` | **要修正** - 計算ロジックにバグがある |
| 6.2 タブのハイライト表示 | `TabTreeView.tsx:203` - `isDragHighlighted` | **実装済み** |
| 6.3 プレースホルダー位置の正確性 | `calculateIndicatorY()` | **要修正** - 位置計算に問題がある |

**関連ファイル:**
- `src/sidepanel/components/GapDropDetection.ts:73-156` (ドロップターゲット計算)
- `src/sidepanel/components/DropIndicator.tsx` (インジケーター表示)
- `src/sidepanel/components/TabTreeView.tsx:1019-1032` (位置計算)

**実装アプローチ:**
- `calculateDropTarget()` のY座標計算ロジックをデバッグ・修正
- コンテナスクロール位置を考慮した計算に修正

---

### Requirement 7: ドラッグ＆ドロップ - ドロップ処理

| 受け入れ基準 | 既存実装 | ギャップ |
|-------------|---------|----------|
| 7.1 プレースホルダー位置に挿入 | `TabTreeView.tsx:887-912` - `onSiblingDrop` | **要修正** - ドロップ処理が正しく動作していない |
| 7.2 ツリー構造とブラウザタブの同期 | `TreeStateManager.moveNode()` | **要検証** |

**関連ファイル:**
- `src/sidepanel/components/TabTreeView.tsx:840-920` (handleDragEnd)
- `src/sidepanel/providers/TreeStateProvider.tsx` (handleSiblingDrop)
- `src/services/TreeStateManager.ts` (moveNode)

---

### Requirement 8: ドラッグ＆ドロップ - スクロール制限

| 受け入れ基準 | 既存実装 | ギャップ |
|-------------|---------|----------|
| 8.1 縦スクロールをコンテンツ範囲内に制限 | `TabTreeView.tsx:40-50` - `AUTO_SCROLL_CONFIG` | **要修正** - 設定が不十分 |
| 8.2 横スクロールを禁止 | `TabTreeView.tsx:1036-1042` - `overflow-x-hidden` | **実装済み** - isDragging中に適用 |
| 8.3 コンテンツ超過時のみスクロール許可 | dnd-kit設定 | **要検証** |

**関連ファイル:**
- `src/sidepanel/components/TabTreeView.tsx:40-50` (AUTO_SCROLL_CONFIG)
- `src/sidepanel/components/SidePanelRoot.tsx:254` (overflow-x-hidden)

---

### Requirement 9: ツリービュー外へのドラッグ＆ドロップ

| 受け入れ基準 | 既存実装 | ギャップ |
|-------------|---------|----------|
| 9.1 ツリービュー外へのドラッグ検知 | `TabTreeView.tsx:855-885` - `onExternalDrop` | **バグあり** - dnd-kitの`event.over`はマウスがツリービュー外に移動してもnullにならない |
| 9.2 新しいウィンドウを作成 | `event-handlers.ts:529-587` - `handleCreateWindowWithSubtree` | **機能は実装済み** - ただし9.1の検知が動作しないため呼び出されない |
| 9.3 タブを新しいウィンドウに移動 | 同上 | **機能は実装済み** - ただし9.1の検知が動作しないため呼び出されない |
| 9.4 マウス位置によるツリービュー外検知 | `TabTreeView.tsx:840-885` | **未実装** - dnd-kitの`event.over`に依存しているが、ツリー外でもnullにならないため別の検知方法が必要 |

**発見されたバグ:**
- dnd-kitライブラリの仕様上、ドラッグ中に`event.over`がnullになるのはドロップターゲットが存在しない場合のみで、マウスがドロップ領域外に移動しても`event.over`は最後に触れた要素を保持し続ける
- ツリービュー外へのドロップを検知するには、マウス座標を直接監視してコンテナ境界との比較が必要

**関連ファイル:**
- `src/sidepanel/components/TabTreeView.tsx:855-885` (handleDragEnd内のツリー外検出)
- `src/sidepanel/components/SidePanelRoot.tsx:203-209` (handleExternalDrop)
- `src/sidepanel/hooks/useCrossWindowDrag.ts`

**実装アプローチ:**
- `onDragEnd`のevent引数から`activatorEvent`経由でマウス座標を取得
- ツリーコンテナの`getBoundingClientRect()`と比較してツリー外判定
- または、`onDragMove`でマウス位置を追跡し、外部フラグを管理

---

### Requirement 10: ピン留めタブの並び替え

| 受け入れ基準 | 既存実装 | ギャップ |
|-------------|---------|----------|
| 10.1 ピン留めタブセクション内でのドラッグ許可 | 未実装 | **未実装** - PinnedTabsSectionにドラッグ機能なし |
| 10.2 ピン留めタブの順序変更 | 未実装 | **未実装** |
| 10.3 ブラウザタブ順序との同期 | 未実装 | **未実装** |
| 10.4 通常タブセクションへのドロップ禁止 | 未実装 | **未実装** |

**関連ファイル:**
- `src/sidepanel/components/PinnedTabsSection.tsx` (現在ドラッグ機能なし)

**実装アプローチ:**
- PinnedTabsSectionにdnd-kitを導入
- `chrome.tabs.move()` でブラウザタブ順序を同期
- ドロップ制約の実装

---

### Requirement 11: タブグループ化機能

| 受け入れ基準 | 既存実装 | ギャップ |
|-------------|---------|----------|
| 11.1 複数タブのグループ化 | `TreeStateManager.createGroupFromTabs()` | **要検証** - 動作していない報告 |
| 11.2 グループ親タブの表示 | `TabTreeView.tsx:647-686` - `GroupNodeHeader` | **実装済み** |
| 11.3 グループ一覧の表示 | 未実装 | **未実装** - サブメニューに既存グループ一覧を表示する機能がない |
| 11.4 タブをグループに追加 | 未実装 | **未実装** |

**関連ファイル:**
- `src/services/TreeStateManager.ts` (createGroupFromTabs)
- `src/sidepanel/components/ContextMenu.tsx:243-250` (グループ化メニュー)
- `src/sidepanel/hooks/useMenuActions.ts:86-100` (グループ化アクション)

**実装アプローチ:**
- createGroupFromTabsの動作をデバッグ・修正
- ContextMenuに「グループに追加」サブメニューを追加（既存グループ一覧表示）

---

### Requirement 12: 複数ウィンドウ対応

| 受け入れ基準 | 既存実装 | ギャップ |
|-------------|---------|----------|
| 12.1 各ウィンドウで独立したタブツリー表示 | `SidePanelRoot.tsx:97-161` - `buildTree()` | **バグあり** - `currentWindowId`が常にnullのため、全ウィンドウのタブが表示される |
| 12.2 新しいウィンドウでそのウィンドウのタブのみ表示 | 同上 | **バグあり** - 12.1と同じ理由で動作しない |
| 12.3 他ウィンドウのタブは表示しない | 同上 | **バグあり** - 12.1と同じ理由で動作しない |

**発見されたバグ:**
- `TreeStateProvider.tsx:204-220`の`loadCurrentWindowId()`がURLパラメータ（`?windowId=xxx`）からのみwindowIdを取得しようとするが、このパラメータは設定されることがない
- `chrome.windows.getCurrent()`が呼び出されないため、`currentWindowId`が常にnullのまま
- `currentWindowId`がnullの場合、`buildTree()`内のフィルタリングがスキップされ、全ウィンドウのタブが表示される

**関連ファイル:**
- `src/sidepanel/components/SidePanelRoot.tsx:97-161` (buildTree内のウィンドウフィルタリング)
- `src/sidepanel/providers/TreeStateProvider.tsx:204-220` (loadCurrentWindowId - バグの原因)
- `src/types/index.ts:26-28` (ExtendedTabInfo.windowId)

**実装アプローチ:**
- `loadCurrentWindowId()`で`chrome.windows.getCurrent()`を呼び出してwindowIdを取得
- URLパラメータはフォールバックとして残すか削除

---

## 2. 技術的リスクと考慮事項

### 高リスク項目

1. **タブ状態の永続化と復元（Req 1）**
   - 既存の `syncWithChromeTabs()` ロジックが複雑で、バグの原因特定が困難な可能性
   - ファビコンの永続化は新規実装が必要

2. **ドラッグ＆ドロップのプレースホルダー位置（Req 6）**
   - dnd-kitとスクロール位置の相互作用による計算誤差
   - コンテナのスクロール状態を正確に反映する必要あり

3. **グループ化機能（Req 11）**
   - 既存実装が動作していない報告があり、デバッグが必要
   - 「グループに追加」は新規UI実装が必要

### 中リスク項目

1. **ピン留めタブの並び替え（Req 10）**
   - 新規ドラッグ＆ドロップ実装が必要
   - ブラウザタブ順序との同期処理

2. **休止タブの視覚的区別（Req 3）**
   - 型定義の変更と表示ロジックの追加
   - Chrome APIの `tab.discarded` プロパティの取り扱い

### 低リスク項目

1. **テキスト選択の禁止（Req 4）** - 既存実装の検証のみ
2. **アクティブタブのハイライト（Req 5）** - 条件分岐とスタイル追加

### 追加発見されたバグ（要対応）

1. **UI表示の一貫性 - スタートページタイトル（Req 2.2）**
   - 正規表現がクエリパラメータ付きURLを処理できない
   - 修正は比較的容易（正規表現の調整）

2. **ツリービュー外へのドラッグ検知（Req 9）**
   - dnd-kitのevent.overがツリー外でもnullにならない仕様問題
   - 別の検知方法（マウス座標監視）が必要

3. **複数ウィンドウ対応（Req 12）**
   - `loadCurrentWindowId()`がchrome.windows.getCurrent()を呼び出していない
   - 修正は比較的容易だが、既存のフィルタリングロジックの検証が必要

---

## 3. 実装戦略の推奨

### Phase 1: 緊急度の高いバグ修正
1. Req 1（タブ状態の永続化と復元）- ユーザー体験に最も影響
2. Req 6, 7（ドラッグ＆ドロップのプレースホルダーとドロップ処理）- 基本操作の問題
3. Req 12（複数ウィンドウ対応）- `loadCurrentWindowId()`が`chrome.windows.getCurrent()`を呼び出していない
4. Req 9（ツリービュー外へのドラッグ検知）- dnd-kitのevent.over依存問題の解消

### Phase 2: 視覚的改善
1. Req 2.1（フォントサイズ反映）
2. Req 2.2（スタートページタイトル - 正規表現のバグ修正）
3. Req 3（休止タブのグレーアウト）
4. Req 5（ピン留めタブのハイライト）

### Phase 3: 機能追加・拡張
1. Req 10（ピン留めタブの並び替え）- 新規ドラッグ＆ドロップ実装
2. Req 11（グループ化機能）- 既存バグ修正 + 新規UI

### Phase 4: 検証・安定化
1. Req 4（テキスト選択禁止）- E2Eテストで検証
2. Req 8（スクロール制限）- 設定調整

---

## 4. 追加調査が必要な項目

1. **syncWithChromeTabs()の詳細ロジック確認**
   - 「Loading」タブ生成の根本原因を特定するため

2. **dnd-kitのautoScroll設定**
   - 過剰スクロールを制限するための最適な設定値

3. **createGroupFromTabsの動作確認**
   - グループ化が動作しない原因の特定

## 5. 調査完了項目（バグ確認済み）

1. **マウス位置によるツリー外ドロップ検知（Req 9）**
   - **結論**: dnd-kitの`event.over`はツリー外でもnullにならない仕様
   - **対策**: マウス座標を直接監視してコンテナ境界と比較する方法で実装が必要

2. **複数ウィンドウ対応（Req 12）**
   - **結論**: `loadCurrentWindowId()`がURLパラメータのみを参照し、`chrome.windows.getCurrent()`を呼び出していない
   - **対策**: `chrome.windows.getCurrent()`を呼び出すよう修正

3. **タイトル永続化（Req 1.3）**
   - **結論**: `tab.title || persistedTitle`の優先順位で永続化タイトルが無視される
   - **対策**: ローディング中や休止中のタブの場合のみ永続化タイトルを優先するなど、条件分岐の見直し

4. **スタートページタイトル（Req 2.2）**
   - **結論**: 正規表現がクエリパラメータ付きURLを正しく判定できない
   - **対策**: 正規表現の修正（例: `/^vivaldi:\/\/startpage/` → `/^vivaldi:\/\/startpage/` のままでも動くはずだが、実際のURL形式を確認して調整）
