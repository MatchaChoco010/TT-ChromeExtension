# Research & Design Decisions

---
**Purpose**: E2Eテスト環境構築における技術調査と設計判断の記録

**Usage**:
- Playwright for Chrome Extensionsの技術検証結果を記録
- アーキテクチャパターンの選定根拠を文書化
- 実装フェーズで参照すべき外部リソースを整理
---

## Summary
- **Feature**: `extension-e2e-tests`
- **Discovery Scope**: New Feature (Greenfield)
- **Key Findings**:
  - Playwright公式がChrome Extensions向けの完全なサポートを提供（Manifest v3対応済み）
  - Chromium bundledバージョンでheadlessモードをデフォルト実行可能（CI/CDおよびローカル実行で安定動作）
  - デバッグ目的でheadedモード実行とブラウザDevToolsアクセスを環境変数で制御可能
  - カスタムフィクスチャによる拡張機能ロードの自動化パターンが確立されている

## Research Log

### Playwright for Chrome Extensions - 公式サポート状況

- **Context**: Vivaldi-TTはManifest v3のChrome拡張機能であり、真のE2Eテストには実ブラウザ環境でのテストが必要
- **Sources Consulted**:
  - [Chrome extensions | Playwright](https://playwright.dev/docs/chrome-extensions)
  - [GitHub - playwright-crx](https://github.com/ruifigueira/playwright-crx)
  - [How I Built E2E Tests for Chrome Extensions Using Playwright and CDP](https://dev.to/corrupt952/how-i-built-e2e-tests-for-chrome-extensions-using-playwright-and-cdp-11fl)
- **Findings**:
  - Playwright公式ドキュメントがChrome Extensions専用セクションを提供
  - `launchPersistentContext`を使用して拡張機能をロード可能
  - Service Worker（Manifest v3）へのアクセス方法が文書化済み
  - ChromiumチャネルでheadlessモードをサポートしているためCI/CD統合が可能
  - Google Chrome/Microsoft Edgeはサイドロード用コマンドラインフラグを削除したため、Playwrightバンドル版Chromiumの使用が必須
- **Implications**:
  - 公式サポートがあるため、長期的なメンテナンス性が高い
  - `playwright-crx`パッケージは不要（公式Playwrightで十分）
  - 既存のVitest環境と分離してPlaywrightを導入可能

### Manifest v3 Service Worker Testing

- **Context**: Vivaldi-TTはManifest v3を使用しており、Service Workerベースのバックグラウンド処理を行う
- **Sources Consulted**:
  - [Chrome extensions | Playwright - Service Worker Access](https://playwright.dev/docs/chrome-extensions)
  - [Setup for Testing Chrome Extensions with Playwright](https://dev.to/christinepinto/embarking-on-a-playwright-journey-testing-chrome-extensions-9p)
- **Findings**:
  - Service WorkerはManifest v2のBackground Pageとは異なるライフサイクルを持つ
  - `browserContext.waitForEvent('serviceworker')`でService Worker起動を待機可能
  - Extension IDはService Worker URLの第3セグメントから抽出可能
  - Service Workerは非アクティブ時にスリープする可能性があるため、明示的な待機処理が必要
- **Implications**:
  - テストフィクスチャでService Workerの起動完了を確実に待機する必要がある
  - Extension IDを動的に取得することで、ビルドごとに変わるIDに対応可能
  - Service Workerのライフサイクルを考慮したテストシナリオ設計が必要（Requirement 4.5対応）

### Test Fixtures and Reusability Pattern

- **Context**: 各テストで拡張機能のロード処理を繰り返すのは非効率的
- **Sources Consulted**:
  - [Fixtures | Playwright](https://playwright.dev/docs/test-fixtures)
  - [Advanced Playwright Fixtures](https://medium.com/@qa.gary.parker/%EF%B8%8F-advanced-playwright-fixtures-supercharge-your-test-setup-and-teardown-20b8bb68e68e)
- **Findings**:
  - Playwrightの`test.extend()`でカスタムフィクスチャを作成可能
  - Worker-scopedフィクスチャとTest-scopedフィクスチャの使い分けが可能
  - Setup（`await use()`前）とTeardown（`await use()`後）フェーズを定義可能
  - Project Dependenciesを使用してグローバルセットアップを定義可能
- **Implications**:
  - `e2e/fixtures/extension.ts`でカスタムフィクスチャを定義
  - 拡張機能のロード、Service Worker待機、Extension ID取得を自動化
  - テストコードはフィクスチャを使用するだけでセットアップ不要

### CI/CD Integration - GitHub Actions

- **Context**: CI/CD環境でE2Eテストを自動実行する必要がある（Requirement 6）
- **Sources Consulted**:
  - [Continuous Integration | Playwright](https://playwright.dev/docs/ci)
  - [Implement Playwright in GitHub Actions for CI/CD](https://www.browsercat.com/post/playwright-github-actions-cicd-guide)
  - [Getting Started with Integrating Playwright and GitHub Actions](https://autify.com/blog/playwright-github-actions)
- **Findings**:
  - Playwrightはデフォルトでheadlessモードでテストを実行（CI/CDおよびローカル環境で安定動作）
  - GitHub Actionsは`CI=true`環境変数を自動設定し、Playwrightが自動検知して適切な設定を適用
  - `npx playwright install --with-deps`でブラウザとシステム依存関係を自動インストール
  - テスト失敗時のトレース、スクリーンショット、ビデオを自動生成可能
  - Microsoftは公式GitHub Actionの使用を推奨していない（Playwright CLIを直接使用すべき）
- **Implications**:
  - `.github/workflows`にPlaywright実行用ワークフロー定義を追加
  - デフォルトでheadlessモード実行、CI環境変数（`CI=true`）を検知して適切な設定を自動適用（Requirements 6.1, 6.6対応）
  - `npx playwright test`コマンドをCI/CDパイプラインに統合
  - Artifactsアップロードでテスト失敗の詳細を保存
  - 既存のVitestテストとは独立したワークフローとして実行

### Test File Organization and Naming Conventions

- **Context**: 既存プロジェクトはVitestで`*.test.ts(x)`、`*.integration.test.tsx`、`*.e2e.test.tsx`を使用
- **Sources Consulted**:
  - プロジェクトの`docs/steering/structure.md`
  - 既存テストファイルパターン分析
- **Findings**:
  - 既存の`*.e2e.test.tsx`はVitestで実行されるコンポーネントレベルテスト（真のE2Eではない）
  - Playwrightの慣例は`*.spec.ts`
  - テストディレクトリの分離により責務を明確化可能
- **Implications**:
  - 新しいE2Eテストは`e2e/`ディレクトリに配置し、`*.spec.ts`命名規則を採用
  - Requirement 7の「既存テストとの共存と棲み分け」要件を満たす
  - `npm test`（Vitest）と`npm run test:e2e`（Playwright）で明確に分離

### Debugging and Troubleshooting Tools

- **Context**: E2Eテスト失敗時の迅速な原因特定が必要（Requirement 8）
- **Sources Consulted**:
  - [Playwright Debugging Documentation](https://playwright.dev/docs/debug)
  - [Test Chrome Extensions on Playwright tests in BrowserStack](https://www.browserstack.com/docs/automate/playwright/chrome-extension-testing)
- **Findings**:
  - Playwright Inspectorでステップバイステップデバッグが可能
  - Trace Viewerで実行トレースを可視化可能
  - `--headed`フラグまたは`HEADED=true`環境変数でブラウザUIを表示してテスト実行可能
  - `--debug`フラグでPlaywright Inspectorを起動
  - headedモードでブラウザDevToolsへのアクセスが可能
  - 環境変数`DEBUG=pw:api`でAPIレベルのログ出力
- **Implications**:
  - `test:e2e:debug`スクリプトで`HEADED=true`環境変数と`--debug`オプションを提供（Requirements 8.5, 8.6対応）
  - `test:e2e:ui`スクリプトでPlaywright UI Modeを提供
  - テスト失敗時のトレースファイル生成を有効化
  - headedモードでDevToolsアクセスを許可し、デバッグ効率を向上

### Performance and Stability - Flaky Test Prevention

- **Context**: E2Eテストの安定性確保が必要（Requirement 9）
- **Sources Consulted**:
  - [Best Practices | Playwright](https://playwright.dev/docs/best-practices)
  - [Test Retry | Playwright](https://playwright.dev/docs/test-retries)
- **Findings**:
  - Playwrightの自動待機機能（auto-waiting）がflakyテストを低減
  - `waitForSelector`、`waitForLoadState`などの明示的待機戦略
  - テストごとに独立したブラウザコンテキストを作成可能
  - リトライ機能（デフォルト無効、CIで有効化推奨）
  - タイムアウト設定はglobal、test、action単位で調整可能
- **Implications**:
  - Playwright configで`retries: 2`（CI環境のみ）を設定
  - グローバルタイムアウトを30秒に設定
  - 拡張機能初期化完了を確実に待機するヘルパー関数を作成
  - 各テストで独立したコンテキストを使用してテスト間干渉を防止

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Official Playwright | 公式Playwrightの`launchPersistentContext`を使用 | 公式サポート、長期メンテナンス性、豊富なドキュメント | なし | **選択** - 安定性と将来性が最も高い |
| playwright-crx | chrome.debuggerベースのPlaywright拡張版 | Chrome拡張機能専用に最適化 | コミュニティ管理、公式サポート外 | 公式Playwrightで十分なため不採用 |
| Puppeteer | Chrome DevTools Protocolを直接使用 | 軽量、Googleメンテナンス | Playwrightより機能が少ない、マルチブラウザ非対応 | Playwright採用のため不採用 |

## Design Decisions

### Decision: 公式Playwrightの採用

- **Context**: Chrome拡張機能のE2Eテストツール選定
- **Alternatives Considered**:
  1. playwright-crx - chrome.debuggerベースのアプローチ
  2. Puppeteer - Chrome DevTools Protocol直接使用
  3. 公式Playwright - launchPersistentContext使用
- **Selected Approach**: 公式Playwright
- **Rationale**:
  - 公式ドキュメントでChrome Extensions専用セクションが提供されている
  - Manifest v3 Service Workerへの対応が明確に文書化されている
  - headlessモード対応によりCI/CD統合が容易
  - 長期的なメンテナンス性と安定性が保証される
- **Trade-offs**:
  - Benefits: 公式サポート、豊富なドキュメント、活発なコミュニティ
  - Compromises: なし（playwright-crxの特殊機能は本プロジェクトで不要）
- **Follow-up**: Extension ID動的取得とService Worker待機のヘルパー関数実装

### Decision: カスタムフィクスチャによる拡張機能ロード自動化

- **Context**: 各テストで拡張機能のロード処理を繰り返すのは非効率的でエラーの原因となる
- **Alternatives Considered**:
  1. 各テストで個別にsetup/teardownを実装
  2. グローバルセットアップでブラウザを一度だけ起動
  3. カスタムフィクスチャでテストごとにコンテキストを作成
- **Selected Approach**: カスタムフィクスチャ（Option 3）
- **Rationale**:
  - テスト間の独立性を保証（テスト間干渉を防止）
  - コードの再利用性が高い
  - Playwrightの公式推奨パターン
- **Trade-offs**:
  - Benefits: テスト安定性向上、コード簡潔化、並列実行対応
  - Compromises: 各テストで拡張機能を再ロードするため若干の実行時間増加
- **Follow-up**: `e2e/fixtures/extension.ts`でフィクスチャ実装

### Decision: テストディレクトリの分離（`e2e/`ディレクトリ）

- **Context**: 既存のVitestテストと新しいPlaywright E2Eテストの責務分離
- **Alternatives Considered**:
  1. `src/test/`に混在させる
  2. `src/`と同階層に`e2e/`を作成
  3. `tests/`ディレクトリを作成してすべてのテストを移動
- **Selected Approach**: `e2e/`ディレクトリ（Option 2）
- **Rationale**:
  - Requirement 7「既存テストとの共存と棲み分け」を満たす
  - テストランナーの分離（Vitest vs Playwright）を明確化
  - Playwrightの慣例に従う
- **Trade-offs**:
  - Benefits: 責務の明確化、混乱防止、メンテナンス性向上
  - Compromises: ディレクトリが増える（許容範囲）
- **Follow-up**: `e2e/`配下にサブディレクトリ（`fixtures/`, `utils/`, `test-data/`）を作成

### Decision: npmスクリプト戦略

- **Context**: 開発者が適切なテストを簡単に実行できる必要がある
- **Alternatives Considered**:
  1. `npm test`でVitestとPlaywrightの両方を実行
  2. `npm test`はVitest専用、`npm run test:e2e`でPlaywright
  3. Playwrightを優先にして`npm test`で実行
- **Selected Approach**: Option 2 - 分離戦略
- **Rationale**:
  - 既存の開発フローを維持（`npm test`でVitestの高速フィードバック）
  - E2Eテストは時間がかかるため、明示的な実行コマンドが適切
  - Requirement 7の要件を満たす
- **Trade-offs**:
  - Benefits: 開発者の既存ワークフロー維持、実行時間の最適化
  - Compromises: 両方を実行する場合は`npm run test:all`が必要
- **Follow-up**: `package.json`に`test:e2e`, `test:e2e:ui`, `test:e2e:debug`, `test:all`を追加

## Risks & Mitigations

- **Risk 1**: Service Workerのライフサイクル管理の複雑性 → Service Worker起動完了を確実に待機するヘルパー関数を実装
- **Risk 2**: E2Eテストの実行時間増加 → 並列実行とworker数の最適化、重要なユーザーフローに絞ったテストシナリオ設計
- **Risk 3**: CI/CD環境でのheadlessモード互換性 → Chromium bundledバージョンを使用し、公式ドキュメントのCI設定に従う
- **Risk 4**: Vivaldi特有の機能との互換性 → Chromiumベースのため基本的に互換性あり、問題発生時はheadedモードでデバッグ
- **Risk 5**: テスト間の状態干渉 → 各テストで独立したブラウザコンテキストを作成、テスト後のクリーンアップを徹底

## References

### Official Documentation
- [Chrome extensions | Playwright](https://playwright.dev/docs/chrome-extensions) - 公式拡張機能テストガイド
- [Fixtures | Playwright](https://playwright.dev/docs/test-fixtures) - カスタムフィクスチャ作成方法
- [Continuous Integration | Playwright](https://playwright.dev/docs/ci) - CI/CD統合ガイド
- [Global setup and teardown | Playwright](https://playwright.dev/docs/test-global-setup-teardown) - セットアップ/ティアダウンパターン

### Best Practices & Tutorials
- [How I Built E2E Tests for Chrome Extensions Using Playwright and CDP](https://dev.to/corrupt952/how-i-built-e2e-tests-for-chrome-extensions-using-playwright-and-cdp-11fl) - 実践的な実装例
- [Setup for Testing Chrome Extensions with Playwright](https://dev.to/christinepinto/embarking-on-a-playwright-journey-testing-chrome-extensions-9p) - セットアップガイド
- [Implement Playwright in GitHub Actions for CI/CD](https://www.browsercat.com/post/playwright-github-actions-cicd-guide) - GitHub Actions統合

### Community Resources
- [GitHub - playwright-chrome-extension-testing-template](https://github.com/kelseyaubrecht/playwright-chrome-extension-testing-template) - テンプレートプロジェクト
- [GitHub - chrome-extension-for-testing](https://github.com/capitalbr/chrome-extension-for-testing) - Manifest v3サンプル
