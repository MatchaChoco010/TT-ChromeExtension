# Research & Design Decisions

## Summary
- **Feature**: tab-tree-ux-improvements
- **Discovery Scope**: Extension（既存システムの大規模拡張）
- **Key Findings**:
  - dnd-kitのカスタム衝突検出とドロップインジケーター実装が複数選択・depth選択の基盤となる
  - TabInfoデータはTreeStateProviderで一元管理し、chrome.tabs.onUpdatedイベントで同期する方式が最適
  - 設定画面は`options_ui`でなく`chrome.tabs.create()`で新規タブに開く方式が柔軟性高い

## Research Log

### dnd-kit Drop Indicator実装方法

- **Context**: 要件7-8でドラッグ中のビジュアルフィードバック（ドロップインジケーター）が必要
- **Sources Consulted**:
  - [dnd-kit Documentation](https://docs.dndkit.com/)
  - [GitHub Issue #1450 - Drop above or below](https://github.com/clauderic/dnd-kit/issues/1450)
  - [dnd-kit-sortable-tree](https://github.com/Shaddix/dnd-kit-sortable-tree)
- **Findings**:
  - dnd-kitの`SortableContext`はデフォルトでリアルタイム並べ替えを行う
  - ドロップインジケーターはオーバーアイテムの`index`比較で上/下を判定可能
  - `over.data?.current?.sortable?.index`と`active.data?.current?.sortable?.index`の比較でドロップ位置を特定
  - カスタム`DragOverlay`とインジケーター用の別要素でビジュアルフィードバックを実現
- **Implications**:
  - 隙間へのドロップ検出には、タブ間にドロップゾーン要素を挿入するか、カスタム衝突検出を実装
  - 要件16（ドラッグ中位置固定）には`transform`をnullに固定するカスタムスタイルが必要

### Depth選択機能のマウスX座標連動

- **Context**: 要件8.5でドラッグ中のマウスX座標でdepthを変更する機能が必要
- **Sources Consulted**:
  - dnd-kit `useDraggable` / `useSortable` hooks documentation
  - 既存の`TabTreeView.tsx`実装（インデント幅: `depth * 20 + 8`px）
- **Findings**:
  - `useDndMonitor`の`onDragMove`イベントでマウス座標を取得可能
  - マウスX座標とツリービューの左端からのオフセットでdepthを計算
  - 計算式: `depth = Math.max(0, Math.floor((mouseX - containerLeft) / INDENT_WIDTH))`
  - 最大depthは上下のタブのdepth+1に制限
- **Implications**:
  - ドラッグ中の状態として`targetDepth`を管理
  - インジケーターのインデントでdepthを視覚化

### 複数選択機能の実装パターン

- **Context**: 要件9でShift/Ctrl+クリックによる複数選択が必要
- **Sources Consulted**:
  - [MUI X Tree View - Selection](https://mui.com/x/react-tree-view/simple-tree-view/selection/)
  - [Syncfusion React TreeView - Multiple Selection](https://ej2.syncfusion.com/react/documentation/treeview/multiple-selection)
  - [react-accessible-treeview](https://dgreene1.github.io/react-accessible-treeview/docs/examples-MultiSelectDirectoryTree)
- **Findings**:
  - 業界標準パターン: Ctrl+クリック=個別トグル、Shift+クリック=範囲選択
  - 状態管理: `selectedIds: Set<string>`と`lastSelectedId: string | null`
  - 範囲選択にはフラット化されたノードリストでのインデックス計算が必要
- **Implications**:
  - TreeStateProviderに`selectedNodeIds`と選択操作メソッドを追加
  - 既存の`ContextMenu`は`targetTabIds: number[]`を受け取るため、複数選択との統合は容易

### Chrome Extension設定画面の新規タブ表示

- **Context**: 要件5で設定画面を新しいブラウザタブで開く必要がある
- **Sources Consulted**:
  - [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
  - Chrome Extensions Manifest V3 documentation
- **Findings**:
  - `options_ui`の`open_in_tab: true`は拡張機能管理画面からの設定アクセス用
  - サイドパネルからは`chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') })`で開く
  - 新規HTMLエントリポイント（`settings.html`）の作成が必要
  - `manifest.json`への`web_accessible_resources`設定は不要（`runtime.getURL`で内部URLを取得）
- **Implications**:
  - 新しいViteエントリポイント`src/settings/index.tsx`を追加
  - 設定コンポーネントをサイドパネルと共有し、レイアウトのみ変更

### ピン留めタブのChrome API

- **Context**: 要件12でピン留めタブを特別に表示する機能が必要
- **Sources Consulted**:
  - Chrome tabs API documentation
  - 既存の`event-handlers.ts`実装
- **Findings**:
  - `chrome.tabs.Tab`には`pinned: boolean`プロパティあり
  - `chrome.tabs.onUpdated`で`changeInfo.pinned`の変更を検知可能
  - ピン留めタブはブラウザ側でindex順が保証される（通常タブより前）
- **Implications**:
  - `TabInfo`型または`TabNode`型に`isPinned`フィールドを追加
  - TreeStateProviderでピン留め状態を追跡・同期

### サイドパネルのブラウザ組み込みUI制御

- **Context**: 要件13でサイドパネルのナビゲーションボタンを非表示にしたい
- **Sources Consulted**:
  - Chrome Side Panel API documentation
  - Vivaldi browser behavior testing
- **Findings**:
  - Chrome Side Panel APIにはブラウザ組み込みUI（履歴ボタン等）を制御するオプションなし
  - サイドパネルのヘッダー部分はブラウザ制御下で、拡張機能からは変更不可
  - Vivaldiでも同様の制約が存在する可能性が高い
- **Implications**:
  - ナビゲーションボタン非表示は実装不可能（要件13.2は制約により実現困難）
  - 拡張機能独自のヘッダー削除（要件13.1）は実現可能

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| **A: Provider拡張** | 既存TreeStateProviderに選択状態・TabInfo管理を追加 | 既存パターン継承、統合テスト容易 | Providerの責務肥大化 | **採用** - コロケーション維持 |
| B: 分離Provider | SelectionProvider、TabInfoProviderを新規作成 | 責務分離、単体テスト容易 | Context階層の複雑化 | 将来的なリファクタリング候補 |
| C: 状態管理ライブラリ | Zustand/Jotaiで状態管理を外部化 | ボイラープレート削減 | 新規依存追加、学習コスト | 現時点では過剰 |

## Design Decisions

### Decision: TabInfoデータ管理方式

- **Context**: 要件1でタブのタイトル・ファビコン表示が必要だが、現在SortableTreeNodeItemにはTabInfoが渡されていない
- **Alternatives Considered**:
  1. **Option A**: TreeStateProviderに`tabInfoMap: Record<number, TabInfo>`を追加 - **採用**
  2. Option B: 各コンポーネントで`chrome.tabs.get()`を都度呼び出し - パフォーマンス懸念
  3. Option C: TabNode型にTabInfoフィールドを統合 - 構造変更が大きい
- **Selected Approach**: Option A - TreeStateProviderに`tabInfoMap`を追加し、`chrome.tabs.onUpdated`イベントで更新
- **Rationale**: 既存のProvider構造を維持しつつ、タブ情報を一元管理できる。パフォーマンスも良好。
- **Trade-offs**: Providerの状態が増加するが、責務の一貫性は保たれる
- **Follow-up**: タブ情報のメモリ使用量を監視し、必要に応じて古いタブの情報を削除

### Decision: ドロップインジケーター実装方式

- **Context**: 要件7-8でドラッグ中のビジュアルフィードバック（インジケーター）が必要
- **Alternatives Considered**:
  1. **Option A**: 各タブ間に`DropZone`コンポーネントを挿入 - **採用**
  2. Option B: CSSの疑似要素（`::before`/`::after`）でインジケーター表示
  3. Option C: Canvas/SVGでオーバーレイ描画
- **Selected Approach**: Option A - タブ間に専用の`DropZone`コンポーネントを配置し、ドラッグ中のみ表示
- **Rationale**: dnd-kitのドロップ可能要素として認識され、衝突検出が容易。depth選択UIも統合可能。
- **Trade-offs**: コンポーネント数増加、レンダリングコスト増加の可能性
- **Follow-up**: パフォーマンスへの影響を計測し、必要に応じてメモ化を強化

### Decision: 選択状態管理の責務配置

- **Context**: 要件9で複数選択機能が必要
- **Alternatives Considered**:
  1. **Option A**: TreeStateProviderに選択状態を追加 - **採用**
  2. Option B: 新規SelectionProviderを作成
  3. Option C: カスタムhook（`useMultiSelect`）でローカル管理
- **Selected Approach**: Option A - TreeStateProviderに`selectedNodeIds: Set<string>`を追加
- **Rationale**: 選択状態はツリー操作（コンテキストメニュー、ドラッグ&ドロップ）と密接に関連するため、同一Providerでの管理が適切
- **Trade-offs**: TreeStateProviderの責務がさらに拡大するが、一貫性のある状態管理が可能
- **Follow-up**: Providerが肥大化した場合は、useReducerパターンへのリファクタリングを検討

### Decision: 設定画面のアーキテクチャ

- **Context**: 要件5で設定画面を新しいブラウザタブで開く必要がある
- **Alternatives Considered**:
  1. **Option A**: 新規エントリポイント`src/settings/index.tsx`を作成、SettingsPanelコンポーネントを共有 - **採用**
  2. Option B: manifest.jsonの`options_ui`を使用
  3. Option C: 新規ウィンドウ（popup window）として表示
- **Selected Approach**: Option A - Viteのマルチエントリポイント設定で`settings.html`を追加
- **Rationale**: サイドパネルと設定ページでコンポーネントを共有でき、メンテナンスコスト低減。`chrome.tabs.create()`で開くことでURL取得が容易。
- **Trade-offs**: ビルド設定の複雑化（Vite設定の修正が必要）
- **Follow-up**: crxjs/vite-pluginのマルチエントリポイント設定を確認

### Decision: ピン留めタブセクションの表示方式

- **Context**: 要件12でピン留めタブを上部に横並び表示する必要がある
- **Alternatives Considered**:
  1. **Option A**: `PinnedTabsSection`コンポーネントを新規作成、TabTreeViewの上部に配置 - **採用**
  2. Option B: TabTreeView内でピン留めタブをフィルタリングして先頭に表示
  3. Option C: 別のProviderでピン留めタブ専用の状態管理
- **Selected Approach**: Option A - 専用コンポーネントで分離し、ファビコンサイズの横並びグリッド表示
- **Rationale**: ピン留めタブは通常タブと異なるUI/UXのため、責務分離が明確。ドラッグ&ドロップの対象外とすることも容易。
- **Trade-offs**: 新規コンポーネント追加によるファイル数増加
- **Follow-up**: ピン留めタブ間のドラッグ操作の要否を確認

## Risks & Mitigations

- **Risk 1**: dnd-kitのカスタム衝突検出が複雑化し、既存のドラッグ機能にリグレッションが発生する可能性
  - **Mitigation**: 既存E2Eテスト（`drag-drop-reorder.spec.ts`等）を事前に強化し、変更後に10回繰り返しテストで安定性を確認

- **Risk 2**: TabInfoの同期遅延により、タイトル/ファビコン表示が一時的に古い状態になる可能性
  - **Mitigation**: ローディング状態の表示（skeleton loader）と、`chrome.tabs.onUpdated`のchangeInfo確認による即時反映

- **Risk 3**: 複数選択とドラッグ&ドロップの組み合わせでの複雑な操作フロー
  - **Mitigation**: 要件9とRequirement 7-8は段階的に実装し、統合テストで操作シナリオを網羅

- **Risk 4**: crxjs/vite-pluginでのマルチエントリポイント設定の互換性問題
  - **Mitigation**: 設定変更後に`npm run build`で確認し、必要に応じてrollup設定でフォールバック

## References

- [dnd-kit Documentation](https://docs.dndkit.com/) - ドラッグ&ドロップの公式ドキュメント
- [dnd-kit GitHub Issue #1450](https://github.com/clauderic/dnd-kit/issues/1450) - ドロップ位置判定の議論
- [dnd-kit-sortable-tree](https://github.com/Shaddix/dnd-kit-sortable-tree) - ツリー型ドラッグ&ドロップの参考実装
- [MUI X Tree View Selection](https://mui.com/x/react-tree-view/simple-tree-view/selection/) - 複数選択UIの参考
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) - サイドパネルの公式API
- [Chrome tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs) - タブ操作API
