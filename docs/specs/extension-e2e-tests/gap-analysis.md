# Implementation Gap Analysis: Playwright E2E Tests

## Executive Summary

Vivaldi-TTは現在、Vitest + React Testing Libraryによる包括的なテストスイート（約16,000行、50+ファイル）を持っていますが、実際のブラウザ環境でのE2Eテストは不足しています。本分析は、Playwright for Chrome Extensionsを使用した真のE2Eテスト環境の追加に必要なギャップを特定し、実装戦略を提示します。

### 主要な発見
- **既存テスト基盤**: Vitestベースのユニット/統合テストが充実しており、テストパターンが確立されている
- **新規技術スタック**: Playwrightは新規追加となり、公式の`@playwright/test`パッケージを使用
- **アーキテクチャギャップ**: Chrome拡張機能のロード、Service Worker検証、Side Panelテストの基盤が必要
- **テスト分離**: 既存Vitestテストとの明確な責務分離が必須

---

## 1. Current State Investigation

### 1.1 Existing Test Infrastructure

#### テストファイル構成
- **総テスト行数**: 約16,000行
- **テストファイル数**: 50+ファイル
- **テスト種別**:
  - Unit tests: `*.test.ts(x)` - コンポーネント、サービス、ユーティリティ
  - Integration tests: `*.integration.test.tsx` - 複数コンポーネントの統合
  - E2E tests (現行): `*.e2e.test.tsx` - Vitestベースの疑似E2E（実ブラウザ非使用）

#### Vitest設定 (`vitest.config.ts`)
```typescript
{
  test: {
    globals: true,
    environment: 'jsdom',      // JSDOMシミュレーション
    setupFiles: ['./src/test/setup.ts']
  }
}
```

**重要な発見**:
- `fake-indexeddb`: IndexedDBのモック
- `chrome-mock.ts`: Chrome API全体をモック（tabs, windows, storage, runtime, sidePanel）
- `@testing-library/react`: React コンポーネントテスト

#### テストパターン
1. **Chrome APIモック**: `chromeMock`シングルトンで全Chrome APIをシミュレート
2. **Colocation**: テストはテスト対象ファイルと同ディレクトリに配置
3. **Setup/Teardown**: `beforeEach`でモックをクリア
4. **Testing Library**: ユーザー視点のテスト（`screen.getByRole`等）

### 1.2 Build & Development Infrastructure

#### Vite設定 (`vite.config.ts`)
- **Build Tool**: Vite 5 + `@crxjs/vite-plugin`
- **Output**: `dist/`ディレクトリにChrome拡張機能をビルド
- **Entry Points**: `sidepanel.html`
- **Alias**: `@/` → `./src/`

#### Package Scripts
```json
{
  "dev": "vite",
  "build": "tsc && vite build",
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:run": "vitest run"
}
```

**ギャップ**: E2Eテスト用のスクリプトが不在

#### Build Output (`dist/`)
- `manifest.json`: Chrome拡張機能マニフェスト
- `service-worker-loader.js`: Service Worker
- `sidepanel.html`: Side Panel UI
- `assets/`: バンドルされたJS/CSS

### 1.3 Project Structure Patterns

#### ディレクトリ構成
```
src/
├── background/          # Service Worker
├── sidepanel/           # React UI (components, providers, hooks)
├── services/            # Business logic (SnapshotManager, ViewManager, etc.)
├── storage/             # IndexedDB abstraction
├── types/               # 共有型定義
└── test/                # クロスカッティングテスト
```

#### 命名規則
- Components: PascalCase (`TreeNode.tsx`)
- Tests: `*.test.ts(x)`, `*.integration.test.tsx`, `*.e2e.test.tsx`
- Services: PascalCase classes

---

## 2. Requirements Feasibility Analysis

### 2.1 Technical Needs from Requirements

#### Requirement 1: Playwrightテスト環境のセットアップ

**必要な技術コンポーネント**:
1. **npm Dependencies**:
   - `@playwright/test` (公式テストランナー)
   - 理由: 公式ドキュメントで推奨、Chrome拡張機能対応、TypeScript完全サポート

2. **Configuration Files**:
   - `playwright.config.ts`: Chromiumチャンネル、headless/headedモード、タイムアウト、レポート設定
   - 理由: Playwrightは設定ファイルベースのセットアップが必要

3. **npm Scripts**:
   - `test:e2e`: Playwrightテスト実行
   - `test:e2e:ui`: UI モード（デバッグ用）
   - `test:e2e:debug`: インスペクターモード
   - `test:all`: Vitest + Playwright統合実行

**ギャップ**:
- ❌ `@playwright/test`パッケージ未インストール
- ❌ `playwright.config.ts`未作成
- ❌ E2E用npmスクリプト未定義

**制約**:
- Chromium bundledチャンネル必須（Google Chrome/Edgeは拡張機能ロード用フラグが削除済み）
- Headlessモードは限定的サポート（Playwrightの最近のバージョンで改善）

#### Requirement 2: Chrome拡張機能のロードとテスト実行基盤

**必要な技術コンポーネント**:
1. **Test Fixtures**:
   - `extensionContext`: 拡張機能をロードした永続的ブラウザコンテキスト
   - `extensionId`: Service Worker URLから抽出
   - 理由: テストの再利用性とセットアップのカプセル化

2. **Extension Loading Logic**:
   ```typescript
   const context = await chromium.launchPersistentContext(userDataDir, {
     channel: 'chromium',
     args: [
       `--disable-extensions-except=${distPath}`,
       `--load-extension=${distPath}`
     ]
   });
   ```

3. **Build Integration**:
   - Pre-test hook: `npm run build`実行
   - `dist/`ディレクトリの存在確認

**ギャップ**:
- ❌ Playwright Fixturesの定義がない
- ❌ 拡張機能ロード用ユーティリティがない
- ❌ ビルドとテストの自動連携がない

**制約**:
- `launchPersistentContext`必須（通常のcontextでは拡張機能ロード不可）
- `userDataDir`が必要（テストごとに独立したプロファイルを推奨）

#### Requirement 3: コアユーザーフローのE2Eテストシナリオ

**必要な技術コンポーネント**:
1. **Page Objects / Test Utilities**:
   - Side Panelページオブジェクト
   - タブ操作ヘルパー
   - ドラッグ&ドロップヘルパー
   - 理由: 68の受入基準を効率的にテストするため

2. **Wait Strategies**:
   - `waitForSelector`: DOM要素の出現待機
   - `waitForLoadState`: ページロード完了待機
   - カスタム条件: Service Worker起動、ツリー同期完了等

3. **Assertion Helpers**:
   - ツリー構造検証
   - タブ状態検証
   - UI状態検証

**ギャップ**:
- ❌ Page Objectsが未定義
- ❌ テストユーティリティが未実装
- ❌ カスタムマッチャーが未定義

**制約**:
- Playwrightのドラッグ&ドロップAPIは`@dnd-kit`との互換性要確認（Research Needed）
- Side Panel APIの直接操作可能性（Research Needed）

#### Requirement 4: ブラウザAPIとの統合テスト

**必要な技術コンポーネント**:
1. **Service Worker Access**:
   ```typescript
   const [serviceWorker] = context.serviceWorkers();
   await serviceWorker.evaluate(() => { /* Service Workerコード実行 */ });
   ```

2. **Chrome DevTools Protocol (CDP)**:
   - `chrome.tabs` API操作の検証
   - `chrome.storage` 永続化検証
   - IndexedDB直接検証

3. **Multi-Context Testing**:
   - 複数ウィンドウシミュレーション
   - ウィンドウ間タブ移動

**ギャップ**:
- ❌ Service Worker評価ユーティリティがない
- ❌ CDP統合がない
- ❌ 複数コンテキストテストパターンがない

**制約**:
- Service Workerのライフサイクル管理（スリープ/復帰）の再現性（Research Needed）

### 2.2 Non-Functional Requirements

#### Performance
- **要件**: 大量タブ（100個以上）での滑らかなレンダリング検証
- **技術**: Playwrightのパフォーマンスメトリクス収集、スクリーンショット比較
- **ギャップ**: パフォーマンステストユーティリティ未実装

#### Reliability
- **要件**: Flakyテスト回避、リトライ戦略（最大2回）
- **技術**: Playwrightのビルトインリトライ、明示的wait
- **ギャップ**: リトライ設定、wait戦略の標準化が必要

#### CI/CD Integration
- **要件**: Headlessモード、JUnit XML出力、HTMLレポート
- **技術**: Playwright設定で対応可能
- **ギャップ**: CI設定ファイル（GitHub Actions等）未作成

---

## 3. Implementation Approach Options

### Option A: 新規E2Eテストインフラを並行構築 (Recommended)

**概要**: 既存Vitestテストと完全分離した新規Playwrightインフラを構築

#### 実装詳細

**新規ファイル**:
```
e2e/
├── fixtures/
│   └── extension.ts         # 拡張機能ロード用fixture
├── utils/
│   ├── side-panel.ts        # Side Panelページオブジェクト
│   ├── tab-helpers.ts       # タブ操作ヘルパー
│   └── drag-drop.ts         # ドラッグ&ドロップヘルパー
├── test-data/
│   └── sample-tabs.json     # テストデータ
└── specs/
    ├── tab-lifecycle.spec.ts        # 3.1 タブライフサイクル
    ├── drag-drop-same-level.spec.ts # 3.2 同階層D&D
    ├── drag-drop-hierarchy.spec.ts  # 3.3 階層変更
    ├── drag-drop-complex.spec.ts    # 3.4 複雑なツリー移動
    ├── drag-drop-hover.spec.ts      # 3.5 ホバー自動展開
    ├── cross-window-dnd.spec.ts     # 3.6 クロスウィンドウ
    ├── side-panel-ui.spec.ts        # 3.7 Side Panel表示
    ├── view-switching.spec.ts       # 3.8 ビュー切り替え
    ├── groups.spec.ts               # 3.9 グループ機能
    ├── snapshots.spec.ts            # 3.10 スナップショット
    ├── context-menu.spec.ts         # 3.11 コンテキストメニュー
    ├── settings-ui.spec.ts          # 3.12 設定UI
    ├── unread-indicator.spec.ts     # 3.13 未読インジケータ
    ├── error-handling.spec.ts       # 3.14 エラーハンドリング
    └── browser-api/
        ├── tabs-api.spec.ts         # 4.1 chrome.tabs API
        ├── windows-api.spec.ts      # 4.2 chrome.windows API
        ├── indexeddb.spec.ts        # 4.3 IndexedDB
        ├── storage-api.spec.ts      # 4.4 chrome.storage API
        └── service-worker.spec.ts   # 4.5 Service Worker通信

playwright.config.ts                 # Playwright設定
```

**Integration Points**:
- `package.json`: 新規スクリプト追加（`test:e2e`, `test:e2e:ui`, `test:e2e:debug`, `test:all`）
- `tsconfig.json`: `e2e/`ディレクトリをincludeに追加（オプション）
- CI/CD: 新規ステップ追加（ビルド → E2Eテスト → レポート）

**既存コードへの影響**:
- **ゼロ**: 既存Vitestテストは一切変更なし
- **ゼロ**: `src/`以下のコードに変更なし

#### Trade-offs
- ✅ **完全分離**: Vitestとの干渉なし、独立した進化が可能
- ✅ **責務明確**: ユニット/統合（Vitest） vs E2E（Playwright）の棲み分けが明瞭
- ✅ **並行実行**: CI/CDで並列実行可能、開発者体験向上
- ✅ **段階的導入**: 優先度の高いテストから段階的に追加可能
- ❌ **新規学習曲線**: Playwrightのベストプラクティス習得が必要
- ❌ **初期セットアップコスト**: Fixtures、ユーティリティ、ページオブジェクトの構築

---

### Option B: Vitestを拡張してPlaywrightを統合

**概要**: Vitestの設定を拡張し、同一テストランナー内でPlaywrightを使用

#### 実装詳細

**変更ファイル**:
- `vitest.config.ts`: Playwrightテスト用の別環境設定追加
- `src/test/setup-playwright.ts`: Playwright専用セットアップ
- 既存`src/**/*.e2e.test.tsx`を段階的にPlaywright版に移行

**Integration Points**:
- Vitestの`test.environment`でカスタム環境を定義
- `@playwright/test`のAPIをVitest内で使用

#### Trade-offs
- ✅ **単一ツール**: テストランナーが統一され、スクリプトがシンプル
- ❌ **設定複雑化**: Vitestの設定が複雑になり、メンテナンス負荷増
- ❌ **ツールの制約**: Playwrightの機能がVitestの制約下で制限される可能性
- ❌ **アンチパターン**: Playwrightは独自テストランナーを推奨、統合は非推奨

**評価**: ❌ **非推奨** - PlaywrightとVitestは設計思想が異なり、強制的な統合はアンチパターン

---

### Option C: ハイブリッドアプローチ（段階的移行）

**概要**: Option Aを採用しつつ、既存の`*.e2e.test.tsx`を段階的にPlaywright化

#### Phase 1: 新規Playwrightインフラ構築（Option A）
- Playwright環境セットアップ
- 基本的なFixtures、ユーティリティ作成
- 1-2の代表的なテストシナリオ実装

#### Phase 2: 既存E2Eテストの分析と移行判定
- 既存3つの`*.e2e.test.tsx`を評価:
  - `FullIntegration.e2e.test.tsx`
  - `UnreadIndicator.e2e.test.tsx`
  - `CrossWindowDragDrop.e2e.test.tsx`
- 移行価値の高いもののみPlaywright化
- 低価値のものはVitest内で維持（モックで十分なケース）

#### Phase 3: 新規テスト追加
- 要件の残りシナリオをPlaywrightで実装

#### Trade-offs
- ✅ **段階的リスク管理**: 初期投資を抑え、価値を確認しながら拡大
- ✅ **既存資産活用**: Vitestテストの知見を活用
- ❌ **移行判断コスト**: 各テストの移行判定に時間が必要
- ❌ **過渡期の複雑さ**: 2つのテスト体系が並存する期間が発生

---

## 4. Implementation Complexity & Risk

### 4.1 Effort Estimation

#### Setup Phase (Requirement 1 & 2)
- **Effort**: **M (3-7 days)**
- **Rationale**:
  - Playwright設定ファイル作成: 1日
  - Fixtures（拡張機能ロード、Service Worker取得）: 2日
  - ビルド統合とnpmスクリプト: 1日
  - 初期テストケース実装（検証用）: 2-3日

#### Core Test Scenarios (Requirement 3)
- **Effort**: **XL (2+ weeks)**
- **Rationale**:
  - 68の受入基準を14のテストファイルに実装
  - Page Objects、ヘルパー関数の構築: 3日
  - ドラッグ&ドロップテスト（3.2-3.6）: 5日（複雑な操作、安定性確保）
  - UI/ビジネスロジックテスト（3.7-3.14）: 5日
  - デバッグとFlakyテスト修正: 2-3日

#### Browser API Integration (Requirement 4)
- **Effort**: **M (3-7 days)**
- **Rationale**:
  - Service Worker評価ユーティリティ: 2日
  - Chrome APIテスト（5サブセクション）: 3-4日
  - 複雑な統合シナリオのデバッグ: 1-2日

#### Test Infrastructure (Requirement 5-9)
- **Effort**: **S (1-3 days)**
- **Rationale**:
  - ディレクトリ構成、命名規則の確立: 0.5日
  - CI/CD統合（GitHub Actions等）: 1日
  - レポート設定、デバッグツール設定: 1日

**Total Effort**: **L-XL (1.5-3 weeks)**

### 4.2 Risk Assessment

#### High Risks

1. **ドラッグ&ドロップの安定性**
   - **リスク**: `@dnd-kit`とPlaywrightの互換性不明、Flakyテストの可能性
   - **影響**: 要件3.2-3.6（19の受入基準）が不安定化
   - **軽減策**:
     - 初期プロトタイプで`@dnd-kit`との統合検証
     - 明示的wait戦略（`waitForSelector`, カスタム条件）
     - スクリーンショット比較での視覚的検証
   - **Research Needed**: Playwright drag APIと`@dnd-kit`の統合パターン

2. **Service Workerライフサイクル再現**
   - **リスク**: スリープ/復帰の再現が困難（要件4.5-5）
   - **影響**: Service Worker関連テストが不完全
   - **軽減策**:
     - Chrome DevTools Protocolでの強制スリープ調査
     - 代替: 長時間待機による自然スリープ（CI/CDで時間増加）
   - **Research Needed**: CDPでのService Worker制御方法

#### Medium Risks

1. **Playwright習得曲線**
   - **リスク**: チームがPlaywrightに不慣れ
   - **影響**: 開発速度低下、バグ混入
   - **軽減策**:
     - 初期フェーズで1-2シナリオを実装し、パターン確立
     - Playwrightドキュメント・ベストプラクティスの共有
     - コードレビューでの知識共有

2. **CI/CD実行時間増加**
   - **リスク**: E2Eテストは実行時間が長い（数分～十数分）
   - **影響**: 開発フィードバックループの遅延
   - **軽減策**:
     - Playwrightの並列実行設定（workers: N）
     - クリティカルパステストの優先実行
     - Sharding（複数マシンでの分散実行）

#### Low Risks

1. **既存テストとの干渉**
   - **リスク**: ほぼゼロ（完全分離アプローチのため）
   - **軽減策**: 不要

2. **依存関係の競合**
   - **リスク**: `@playwright/test`は独立パッケージ、Vitestと干渉なし
   - **軽減策**: 不要

---

## 5. Recommendations for Design Phase

### 5.1 Preferred Approach

**Option A: 新規E2Eテストインフラを並行構築**

**根拠**:
1. **責務分離**: Vitest（ユニット/統合）とPlaywright（E2E）の明確な棲み分け
2. **リスク最小化**: 既存テストへの影響ゼロ、段階的導入可能
3. **ベストプラクティス**: Playwrightの設計思想に沿った実装
4. **スケーラビリティ**: 将来的なテスト拡張が容易

### 5.2 Key Design Decisions

#### Decision 1: Test Fixtures Architecture
- **Decision**: `e2e/fixtures/extension.ts`で拡張機能ロードを抽象化
- **Rationale**: テストコードの簡潔化、セットアップの再利用性
- **Design Phase Action**: Fixtureの詳細設計（userDataDir管理、Extension ID抽出）

#### Decision 2: Page Object Pattern
- **Decision**: `e2e/utils/`配下にPage Objectsを配置
- **Rationale**: UIテストの保守性向上、変更の局所化
- **Design Phase Action**: Side Panelページオブジェクトの設計

#### Decision 3: Test Data Strategy
- **Decision**: `e2e/test-data/`にJSON形式でテストデータを管理
- **Rationale**: テストの可読性向上、データの再利用
- **Design Phase Action**: テストデータのスキーマ定義

#### Decision 4: Wait Strategy Standardization
- **Decision**: カスタム条件関数（`waitForTreeSync`, `waitForServiceWorkerReady`等）を作成
- **Rationale**: Flakyテスト回避、テストの安定性向上
- **Design Phase Action**: 共通wait関数の設計

### 5.3 Research Items to Carry Forward

#### Critical Research (実装前に必須)

1. **Playwright drag API × @dnd-kit統合**
   - **調査内容**: Playwrightの`page.dragAndDrop()`が`@dnd-kit`のイベントハンドラーを正しくトリガーするか
   - **代替案**: CDP経由での低レベルマウスイベント発火
   - **期限**: Design Phase内

2. **Service Worker CDPコントロール**
   - **調査内容**: Chrome DevTools ProtocolでService Workerのスリープ/復帰を制御可能か
   - **代替案**: 長時間待機（非効率だが確実）
   - **期限**: Design Phase内

#### Medium Priority Research

3. **Side Panel API直接操作**
   - **調査内容**: Playwrightから`chrome.sidePanel`APIを直接呼び出し可能か
   - **代替案**: Service Worker経由での間接操作
   - **期限**: Design Phase内

4. **大量タブパフォーマンステスト**
   - **調査内容**: 100個以上のタブ作成時のPlaywrightパフォーマンス
   - **代替案**: タブ作成を段階的に行う、スナップショット比較での簡易検証
   - **期限**: Implementation Phase前半

### 5.4 Dependencies and Prerequisites

#### 外部依存
- **@playwright/test**: `^1.50.0`（2025年最新版）
- **追加依存なし**: Playwrightは単体で動作

#### 内部依存
- **ビルドプロセス**: `npm run build`が正常に動作すること（既存OK）
- **dist/出力**: Chrome拡張機能として有効なmanifest.jsonと全ファイル（既存OK）

#### 前提条件
- Node.js 20+（既存OK）
- Chromium bundled with Playwright（自動インストール）

### 5.5 Success Metrics

#### Phase 1 (Setup): 成功基準
- [ ] Playwrightで拡張機能がロードされ、Side Panelが表示される
- [ ] Service Workerが起動し、extensionIdが取得できる
- [ ] 1つの基本テストが安定して成功する（リトライなしで5回連続成功）

#### Phase 2 (Core Tests): 成功基準
- [ ] 68の受入基準のうち80%以上がテスト実装される
- [ ] ドラッグ&ドロップテストが安定（Flake rate < 5%）
- [ ] CI/CDでの実行時間が15分以内

#### Phase 3 (Integration): 成功基準
- [ ] Vitestテストとの並行実行が成功
- [ ] HTMLレポートが正常に生成される
- [ ] 開発者がデバッグツール（UI mode, Inspector）を活用できる

---

## 6. Requirement-to-Asset Map

### Legend
- ✅ **Exists**: 既存資産で対応可能
- ❌ **Missing**: 新規作成が必要
- ⚠️ **Constraint**: 制約あり、設計で考慮必要
- 🔬 **Research Needed**: 実装前に調査必要

### Requirement 1: Playwrightテスト環境のセットアップ

| Acceptance Criteria | Status | Asset/Gap | Notes |
|---------------------|--------|-----------|-------|
| 1. Playwright packageインストール | ❌ Missing | devDependenciesに追加 | `@playwright/test` ^1.50.0 |
| 2. playwright.config.ts作成 | ❌ Missing | 新規設定ファイル | Chromium channel, headless/headed, timeout設定 |
| 3. npmスクリプト提供 | ❌ Missing | package.jsonに追加 | `test:e2e`, `test:e2e:ui`, `test:e2e:debug` |
| 4. Chromiumインストール | ❌ Missing | Playwrightインストール時に自動 | `npx playwright install chromium` |
| 5. 失敗時のスクリーンショット/ビデオ | ❌ Missing | playwright.config.tsで設定 | `screenshot: 'on-failure', video: 'on'` |

### Requirement 2: Chrome拡張機能のロードとテスト実行基盤

| Acceptance Criteria | Status | Asset/Gap | Notes |
|---------------------|--------|-----------|-------|
| 1. テスト前にビルド実行 | ⚠️ Constraint | npmスクリプトで連携 | `npm run build && npm run test:e2e` |
| 2. dist/をChromiumにロード | ❌ Missing | Fixture: `launchPersistentContext` | `e2e/fixtures/extension.ts` |
| 3. Service Worker起動確認 | ❌ Missing | Fixture: `waitForEvent('serviceworker')` | Extension ID抽出も同時実施 |
| 4. Side Panel利用可能確認 | ❌ Missing | Utility: `waitForSidePanel` | Side Panel URLへのナビゲーション |
| 5. ロード失敗時のエラーログ | ❌ Missing | Fixtureのエラーハンドリング | Manifest検証、ロードエラーの詳細出力 |

### Requirement 3: コアユーザーフローのE2Eテストシナリオ

| Sub-Requirement | Status | Asset/Gap | Notes |
|-----------------|--------|-----------|-------|
| 3.1 タブライフサイクル（6項目） | ❌ Missing | `e2e/specs/tab-lifecycle.spec.ts` | Chrome tabs API操作、ツリー検証 |
| 3.2 同階層D&D（4項目） | 🔬 Research | `e2e/specs/drag-drop-same-level.spec.ts` | `@dnd-kit`統合要調査 |
| 3.3 階層変更D&D（5項目） | 🔬 Research | `e2e/specs/drag-drop-hierarchy.spec.ts` | 自動展開のタイミング検証 |
| 3.4 複雑なツリー移動（5項目） | 🔬 Research | `e2e/specs/drag-drop-complex.spec.ts` | サブツリー移動、循環参照検証 |
| 3.5 ホバー自動展開（3項目） | 🔬 Research | `e2e/specs/drag-drop-hover.spec.ts` | タイムアウト制御 |
| 3.6 クロスウィンドウD&D（4項目） | ❌ Missing | `e2e/specs/cross-window-dnd.spec.ts` | 複数context管理 |
| 3.7 Side Panel表示（5項目） | ❌ Missing | `e2e/specs/side-panel-ui.spec.ts` | レンダリング検証、パフォーマンス測定 |
| 3.8 ビュー切り替え（6項目） | ❌ Missing | `e2e/specs/view-switching.spec.ts` | ビューマネージャーAPI操作 |
| 3.9 グループ機能（5項目） | ❌ Missing | `e2e/specs/groups.spec.ts` | グループノード検証 |
| 3.10 スナップショット（6項目） | ❌ Missing | `e2e/specs/snapshots.spec.ts` | IndexedDB検証、復元テスト |
| 3.11 コンテキストメニュー（7項目） | ❌ Missing | `e2e/specs/context-menu.spec.ts` | 右クリック、メニュー選択 |
| 3.12 設定UI（7項目） | ❌ Missing | `e2e/specs/settings-ui.spec.ts` | フォント、テーマ変更検証 |
| 3.13 未読インジケータ（4項目） | ❌ Missing | `e2e/specs/unread-indicator.spec.ts` | バッジ表示検証 |
| 3.14 エラーハンドリング（5項目） | ❌ Missing | `e2e/specs/error-handling.spec.ts` | エラーアイコン、メッセージ検証 |

### Requirement 4: ブラウザAPIとの統合テスト

| Sub-Requirement | Status | Asset/Gap | Notes |
|-----------------|--------|-----------|-------|
| 4.1 chrome.tabs API（8項目） | ❌ Missing | `e2e/specs/browser-api/tabs-api.spec.ts` | API呼び出し、イベント検証 |
| 4.2 chrome.windows API（5項目） | ❌ Missing | `e2e/specs/browser-api/windows-api.spec.ts` | 複数ウィンドウ管理 |
| 4.3 IndexedDB（5項目） | ✅ Exists (partial) | `e2e/specs/browser-api/indexeddb.spec.ts` | 既存fake-indexeddbの知見活用 |
| 4.4 chrome.storage API（4項目） | ❌ Missing | `e2e/specs/browser-api/storage-api.spec.ts` | storage.onChangedイベント検証 |
| 4.5 Service Worker通信（5項目） | 🔬 Research | `e2e/specs/browser-api/service-worker.spec.ts` | スリープ/復帰要調査 |

### Requirement 5-9: インフラ・品質要件

| Requirement | Status | Asset/Gap | Notes |
|-------------|--------|-----------|-------|
| 5. テスト構造・ファイル組織 | ❌ Missing | `e2e/`ディレクトリ構成 | 命名規則、ディレクトリ構造定義 |
| 6. CI/CD統合・レポート | ❌ Missing | GitHub Actions設定 | JUnit XML, HTMLレポート設定 |
| 7. 既存テスト棲み分け | ✅ Exists | npmスクリプト分離 | `test` (Vitest), `test:e2e` (Playwright) |
| 8. デバッグ支援 | ❌ Missing | playwright.config.ts設定 | UI mode, Inspector, Trace Viewer |
| 9. パフォーマンス・安定性 | ❌ Missing | wait戦略、リトライ設定 | カスタム条件関数、timeout設定 |

---

## 7. Next Steps

### Design Phase Focus Areas

1. **Test Architecture Design**
   - Fixtures詳細設計（拡張機能ロード、Extension ID管理）
   - Page Objects設計（Side Panel、Settings Panel）
   - Test Utilities設計（ドラッグ&ドロップヘルパー、wait関数）

2. **Critical Research Execution**
   - Playwright drag API × @dnd-kit統合検証
   - Service Worker CDP制御調査
   - プロトタイプ実装（1-2シナリオ）

3. **Test Data Schema**
   - テストデータのJSON構造定義
   - モックデータ生成戦略

4. **CI/CD Integration Design**
   - GitHub Actionsワークフロー設計
   - 並列実行戦略（sharding, workers）

### Implementation Phasing Proposal

**Phase 1: Foundation (Week 1)**
- Playwright環境セットアップ
- Fixtures、基本ユーティリティ実装
- 1-2の基本テストで検証

**Phase 2: Core Scenarios (Week 2-3)**
- Requirement 3の優先度高シナリオ実装
- ドラッグ&ドロップテストの安定化
- Page Objects完成

**Phase 3: API Integration (Week 3)**
- Requirement 4のブラウザAPI統合テスト
- Service Workerテストの実装

**Phase 4: Refinement (Week 4)**
- 残りシナリオ補完
- CI/CD統合
- ドキュメント整備

---

## Sources

- [Chrome extensions | Playwright](https://playwright.dev/docs/chrome-extensions)
- [GitHub - ruifigueira/playwright-crx](https://github.com/ruifigueira/playwright-crx)
- [How I Built E2E Tests for Chrome Extensions Using Playwright and CDP](https://dev.to/corrupt952/how-i-built-e2e-tests-for-chrome-extensions-using-playwright-and-cdp-11fl)
- [How to Test Chrome Extensions with Playwright | Railsware Blog](https://railsware.com/blog/test-chrome-extensions/)

