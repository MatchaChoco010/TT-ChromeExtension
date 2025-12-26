# Requirements Document

## Project Description (Input)
Playwright for Chrome Extensions などのようなものを利用した真のE2Eテストを追加してください。

## Introduction

Vivaldi-TTは現在、Vitest + React Testing Libraryによるユニット・統合テストを備えていますが、実際のブラウザ環境でChrome拡張機能として動作するE2Eテストが不足しています。本仕様は、Playwright for Chrome Extensionsを活用し、実ブラウザ上で拡張機能の動作を検証する真のE2Eテスト環境を構築することを目的とします。

## Requirements

### Requirement 1: Playwrightテスト環境のセットアップ

**Objective:** テスト開発者として、Playwright for Chrome Extensionsを使用できる環境を構築し、拡張機能のE2Eテストを実行できるようにしたい。これにより、実ブラウザ環境での動作検証が可能になる。

#### Acceptance Criteria
1. The E2Eテストシステム shall Playwright for Chrome ExtensionsパッケージをdevDependenciesに追加する
2. The E2Eテストシステム shall Playwrightの設定ファイル（playwright.config.ts）を作成し、Chrome拡張機能テスト用の設定を含める
3. The E2Eテストシステム shall テスト実行用のnpmスクリプト（`test:e2e`, `test:e2e:ui`, `test:e2e:debug`）を提供する
4. The E2Eテストシステム shall Chromiumブラウザをインストールし、headlessモードをデフォルトとしてテストを実行する
5. The E2Eテストシステム shall デバッグ目的のためにheadedモードでの実行オプション（環境変数またはコマンドラインフラグ）を提供する
6. When テストが失敗した場合、the E2Eテストシステム shall スクリーンショットとビデオ録画を保存する

### Requirement 2: Chrome拡張機能のロードとテスト実行基盤

**Objective:** テスト開発者として、ビルドされたChrome拡張機能をPlaywrightで自動的にロードし、テストコンテキストで使用できるようにしたい。これにより、実際の拡張機能環境でのテストが可能になる。

#### Acceptance Criteria
1. The E2Eテストシステム shall テスト実行前に拡張機能をビルドする（`npm run build`）
2. The E2Eテストシステム shall ビルドされた拡張機能（`dist`ディレクトリ）をChromiumブラウザにロードする
3. The E2Eテストシステム shall 拡張機能のService Workerが正常に起動したことを確認する
4. The E2Eテストシステム shall Side Panelが利用可能な状態であることを検証する
5. When 拡張機能のロードに失敗した場合、the E2Eテストシステム shall 詳細なエラーメッセージとログを出力する

### Requirement 3: コアユーザーフローのE2Eテストシナリオ

**Objective:** QAエンジニアとして、実ブラウザ環境でVivaldi-TTの主要な機能が正常に動作することを検証したい。これにより、ユーザーが実際に使用する環境での品質を保証できる。

#### 3.1 タブライフサイクルとツリー構造の基本操作

**Acceptance Criteria**
1. When 新しいタブを作成した場合、the E2Eテストシステム shall Side Panelのツリーに新しいノードが追加されることを検証する
2. When 親タブから新しいタブを開いた場合、the E2Eテストシステム shall 親子関係が正しく確立されることを検証する
3. When タブを閉じた場合、the E2Eテストシステム shall ツリーから対応するノードが削除されることを検証する
4. When 子タブを持つ親タブを閉じた場合、the E2Eテストシステム shall 子タブの処理（孤立化または一括削除）が設定に従って実行されることを検証する
5. When タブのタイトルまたはURLが変更された場合、the E2Eテストシステム shall ツリー表示がリアルタイムで更新されることを検証する
6. When タブがアクティブ化された場合、the E2Eテストシステム shall ツリー内の対応ノードがハイライトされることを検証する

#### 3.2 ドラッグ&ドロップによるタブの並び替え（同階層）

**Acceptance Criteria**
1. When ルートレベルのタブを別のルートレベルのタブ間にドロップした場合、the E2Eテストシステム shall タブの表示順序が変更されることを検証する
2. When 子タブを同じ親の他の子タブ間にドロップした場合、the E2Eテストシステム shall 兄弟タブ間での順序が変更されることを検証する
3. When 複数の子を持つサブツリー内でタブを並び替えた場合、the E2Eテストシステム shall 他の子タブの順序が正しく調整されることを検証する
4. When ドラッグ中にドロップ位置のプレビューが表示される場合、the E2Eテストシステム shall 視覚的なフィードバック（ドロップインジケータ）が正しい位置に表示されることを検証する

#### 3.3 ドラッグ&ドロップによる階層変更（親子関係の作成）

**Acceptance Criteria**
1. When タブを別のタブに重ねてドロップした場合、the E2Eテストシステム shall ドロップ先タブの子として配置されることを検証する
2. When 子タブを持たないタブに初めて子タブを追加した場合、the E2Eテストシステム shall 親タブに展開/折りたたみアイコンが表示されることを検証する
3. When 折りたたまれた親タブに子タブをドロップした場合、the E2Eテストシステム shall 親タブが自動的に展開されることを検証する
4. When 既に子を持つ親タブに新しい子をドロップした場合、the E2Eテストシステム shall 子タブリストの末尾に追加されることを検証する
5. When 深い階層のタブを別の親にドロップした場合、the E2Eテストシステム shall depthが正しく再計算されることを検証する

#### 3.4 ドラッグ&ドロップによる複雑なツリー移動

**Acceptance Criteria**
1. When 子タブを持つ親タブを移動した場合、the E2Eテストシステム shall サブツリー全体が一緒に移動することを検証する
2. When サブツリーをルートレベルにドロップした場合、the E2Eテストシステム shall 元の親子関係から切り離され、ルートノードとして配置されることを検証する
3. When あるサブツリーを別のサブツリー内に移動した場合、the E2Eテストシステム shall 全ての子孫ノードのdepthが正しく更新されることを検証する
4. When 親タブを自分の子孫タブにドロップしようとした場合、the E2Eテストシステム shall 循環参照を防ぐため操作が拒否されることを検証する
5. When 折りたたまれた状態のサブツリーを移動した場合、the E2Eテストシステム shall 展開状態を保持したまま移動することを検証する

#### 3.5 ドラッグ&ドロップのホバー自動展開

**Acceptance Criteria**
1. When 折りたたまれた親タブの上にタブをホバーした場合、the E2Eテストシステム shall 一定時間後に自動的に展開されることを検証する
2. When 自動展開のタイムアウト前にホバーを離れた場合、the E2Eテストシステム shall 展開がキャンセルされることを検証する
3. When 深いツリー構造で複数のノードを経由してドラッグした場合、the E2Eテストシステム shall 各階層で順次自動展開が機能することを検証する

#### 3.6 クロスウィンドウドラッグ&ドロップ

**Acceptance Criteria**
1. When タブをパネル外にドラッグアウトした場合、the E2Eテストシステム shall 新しいウィンドウが作成されることを検証する
2. When タブを別ウィンドウに移動した場合、the E2Eテストシステム shall 元のウィンドウのツリーから削除され、移動先ウィンドウのツリーに追加されることを検証する
3. When 子タブを持つ親タブを別ウィンドウに移動した場合、the E2Eテストシステム shall サブツリー全体が一緒に移動することを検証する
4. When 複数ウィンドウ間でタブを移動した後、the E2Eテストシステム shall 各ウィンドウのツリー状態が正しく同期されることを検証する

#### 3.7 Side Panelの表示とリアルタイム更新

**Acceptance Criteria**
1. When Side Panelを開いた場合、the E2Eテストシステム shall 現在のタブツリーが正しく表示されることを検証する
2. When 別のタブで新しいタブを開いた場合、the E2Eテストシステム shall Side Panelがリアルタイムで更新されることを検証する
3. When タブの favIconが変更された場合、the E2Eテストシステム shall ツリー表示のアイコンが更新されることを検証する
4. When 大量のタブ（100個以上）が存在する場合、the E2Eテストシステム shall スクロールとレンダリングが滑らかに動作することを検証する
5. When ツリーノードの展開/折りたたみを切り替えた場合、the E2Eテストシステム shall アニメーションが滑らかに実行されることを検証する

#### 3.8 ビュー切り替え機能（All Tabs / Current Window / Groups）

**Acceptance Criteria**
1. When "All Tabs"ビューに切り替えた場合、the E2Eテストシステム shall 全ウィンドウの全タブが表示されることを検証する
2. When "Current Window"ビューに切り替えた場合、the E2Eテストシステム shall アクティブウィンドウのタブのみが表示されることを検証する
3. When カスタムビューを作成した場合、the E2Eテストシステム shall 新しいビューがビューリストに追加されることを検証する
4. When ビュー間を切り替えた場合、the E2Eテストシステム shall ツリー表示が即座に更新されることを検証する
5. When ビューを削除した場合、the E2Eテストシステム shall デフォルトビューに自動的に切り替わることを検証する
6. When ビュー名や色を変更した場合、the E2Eテストシステム shall UI上の表示が即座に反映されることを検証する

#### 3.9 グループ機能

**Acceptance Criteria**
1. When タブをグループに追加した場合、the E2Eテストシステム shall グループノード配下に配置されることを検証する
2. When 新しいグループを作成した場合、the E2Eテストシステム shall グループ名と色が設定されることを検証する
3. When グループを展開/折りたたんだ場合、the E2Eテストシステム shall グループ内のタブの表示/非表示が切り替わることを検証する
4. When グループを削除した場合、the E2Eテストシステム shall グループ内のタブの処理（解除または削除）が設定に従って実行されることを検証する
5. When タブをグループ間で移動した場合、the E2Eテストシステム shall グループの所属が正しく変更されることを検証する

#### 3.10 スナップショット機能

**Acceptance Criteria**
1. When スナップショットを保存した場合、the E2Eテストシステム shall 現在のタブツリー状態が保存されることを検証する
2. When スナップショットを復元した場合、the E2Eテストシステム shall 保存時のタブとツリー構造が再現されることを検証する
3. When スナップショットを削除した場合、the E2Eテストシステム shall スナップショットリストから削除されることを検証する
4. When 複数のスナップショットが存在する場合、the E2Eテストシステム shall リストから選択して復元できることを検証する
5. When スナップショットを復元する際、the E2Eテストシステム shall 現在のタブを閉じるか保持するかのオプションが提供されることを検証する
6. When 自動スナップショット機能が有効な場合、the E2Eテストシステム shall 定期的にスナップショットが自動保存されることを検証する

#### 3.11 コンテキストメニュー操作

**Acceptance Criteria**
1. When タブノードを右クリックした場合、the E2Eテストシステム shall コンテキストメニューが表示されることを検証する
2. When コンテキストメニューから"タブを閉じる"を選択した場合、the E2Eテストシステム shall 対象タブが閉じられることを検証する
3. When コンテキストメニューから"サブツリーを閉じる"を選択した場合、the E2Eテストシステム shall 対象タブとその全ての子孫タブが閉じられることを検証する
4. When コンテキストメニューから"グループに追加"を選択した場合、the E2Eテストシステム shall グループ選択ダイアログが表示されることを検証する
5. When コンテキストメニューから"新しいウィンドウで開く"を選択した場合、the E2Eテストシステム shall タブが新しいウィンドウに移動することを検証する
6. When コンテキストメニューから"URLをコピー"を選択した場合、the E2Eテストシステム shall クリップボードにURLがコピーされることを検証する
7. When コンテキストメニューの外側をクリックした場合、the E2Eテストシステム shall メニューが閉じられることを検証する

#### 3.12 設定変更とUI/UXカスタマイゼーション

**Acceptance Criteria**
1. When 設定パネルを開いた場合、the E2Eテストシステム shall 現在の設定値が表示されることを検証する
2. When フォントサイズを変更した場合、the E2Eテストシステム shall ツリー表示のフォントサイズが即座に反映されることを検証する
3. When フォントファミリーを変更した場合、the E2Eテストシステム shall 指定されたフォントが適用されることを検証する
4. When テーマ（ライト/ダーク）を切り替えた場合、the E2Eテストシステム shall 配色が即座に変更されることを検証する
5. When カスタムカラーを設定した場合、the E2Eテストシステム shall アクセントカラーが反映されることを検証する
6. When インデント幅を変更した場合、the E2Eテストシステム shall ツリーの階層表示の幅が調整されることを検証する
7. When 設定を保存した場合、the E2Eテストシステム shall ブラウザを再起動しても設定が保持されることを検証する

#### 3.13 未読インジケータ機能

**Acceptance Criteria**
1. When タブがバックグラウンドで読み込まれた場合、the E2Eテストシステム shall 未読バッジが表示されることを検証する
2. When 未読タブをアクティブにした場合、the E2Eテストシステム shall 未読バッジが消えることを検証する
3. When 親タブの子に未読タブがある場合、the E2Eテストシステム shall 親タブにも未読インジケータが表示されることを検証する
4. When 複数の未読タブがある場合、the E2Eテストシステム shall 未読数がカウントされて表示されることを検証する

#### 3.14 エラーハンドリングとエッジケース

**Acceptance Criteria**
1. When ネットワークエラーでタブが読み込めない場合、the E2Eテストシステム shall エラーアイコンが表示されることを検証する
2. When IndexedDBへの書き込みが失敗した場合、the E2Eテストシステム shall エラーメッセージが表示されることを検証する
3. When 拡張機能の権限が不足している場合、the E2Eテストシステム shall 適切な警告が表示されることを検証する
4. When 非常に長いタブタイトルがある場合、the E2Eテストシステム shall テキストが適切に省略されることを検証する
5. When 無効なURLのタブがある場合、the E2Eテストシステム shall デフォルトアイコンが表示されることを検証する

### Requirement 4: ブラウザAPIとの統合テスト

**Objective:** テスト開発者として、Chrome APIs（tabs, windows, storage等）との統合が正常に機能することを検証したい。これにより、ブラウザ環境依存の不具合を早期に発見できる。

#### 4.1 chrome.tabs API統合

**Acceptance Criteria**
1. When chrome.tabs.create()を呼び出した場合、the E2Eテストシステム shall 新しいタブが作成され、ツリーに反映されることを検証する
2. When chrome.tabs.remove()を呼び出した場合、the E2Eテストシステム shall タブが削除され、ツリーから削除されることを検証する
3. When chrome.tabs.update()でタブのプロパティを変更した場合、the E2Eテストシステム shall 変更がツリーに反映されることを検証する
4. When chrome.tabs.query()で複数タブを検索した場合、the E2Eテストシステム shall 正しいタブリストが取得されることを検証する
5. When chrome.tabs.onCreated イベントが発火した場合、the E2Eテストシステム shall ツリーがリアルタイムで更新されることを検証する
6. When chrome.tabs.onRemoved イベントが発火した場合、the E2Eテストシステム shall ツリーから対応ノードが削除されることを検証する
7. When chrome.tabs.onUpdated イベントが発火した場合、the E2Eテストシステム shall タブ情報が更新されることを検証する
8. When chrome.tabs.onActivated イベントが発火した場合、the E2Eテストシステム shall アクティブタブのハイライトが更新されることを検証する

#### 4.2 chrome.windows API統合

**Acceptance Criteria**
1. When chrome.windows.create()で新しいウィンドウを作成した場合、the E2Eテストシステム shall 新しいウィンドウコンテキストが確立されることを検証する
2. When chrome.windows.remove()でウィンドウを閉じた場合、the E2Eテストシステム shall ウィンドウ内の全タブがツリーから削除されることを検証する
3. When chrome.windows.update()でウィンドウをフォーカスした場合、the E2Eテストシステム shall "Current Window"ビューが正しく更新されることを検証する
4. When chrome.windows.getAll()で全ウィンドウを取得した場合、the E2Eテストシステム shall 全ウィンドウのタブが正しく列挙されることを検証する
5. When 複数ウィンドウが存在する場合、the E2Eテストシステム shall 各ウィンドウのタブツリーが独立して管理されることを検証する

#### 4.3 IndexedDB統合

**Acceptance Criteria**
1. When ツリー状態をIndexedDBに保存した場合、the E2Eテストシステム shall データが正しく永続化されることを検証する
2. When IndexedDBからツリー状態を読み込んだ場合、the E2Eテストシステム shall 保存時の状態が正しく復元されることを検証する
3. When 大量のタブデータ（1000個以上）を保存した場合、the E2Eテストシステム shall パフォーマンス劣化なく処理されることを検証する
4. When IndexedDBのクォータを超えた場合、the E2Eテストシステム shall 適切なエラーハンドリングが行われることを検証する
5. When ブラウザを再起動した後、the E2Eテストシステム shall IndexedDBから状態が復元されることを検証する

#### 4.4 chrome.storage API統合

**Acceptance Criteria**
1. When chrome.storage.local.set()で設定を保存した場合、the E2Eテストシステム shall 設定が永続化されることを検証する
2. When chrome.storage.local.get()で設定を読み込んだ場合、the E2Eテストシステム shall 保存された設定値が取得されることを検証する
3. When chrome.storage.onChanged イベントが発火した場合、the E2Eテストシステム shall UIが最新の設定で更新されることを検証する
4. When 複数の設定項目を一括で保存した場合、the E2Eテストシステム shall トランザクション的に処理されることを検証する

#### 4.5 Service Workerとの通信

**Acceptance Criteria**
1. When Side PanelからService Workerにメッセージを送信した場合、the E2Eテストシステム shall chrome.runtime.sendMessage()が正常に動作することを検証する
2. When Service WorkerからSide Panelにメッセージを送信した場合、the E2Eテストシステム shall chrome.runtime.onMessage リスナーが正しく受信することを検証する
3. When Service Workerがタブイベントを処理した場合、the E2Eテストシステム shall ツリー状態がバックグラウンドで同期されることを検証する
4. When Service Workerが再起動した場合、the E2Eテストシステム shall 状態が正しく復元されることを検証する
5. When 長時間の非アクティブ後にService Workerがスリープから復帰した場合、the E2Eテストシステム shall 通信が再確立されることを検証する

### Requirement 5: テスト構造とファイル組織

**Objective:** テスト開発者として、E2Eテストを既存のテスト構造と整合性のある形で組織化したい。これにより、保守性と可読性を向上させる。

#### Acceptance Criteria
1. The E2Eテストシステム shall E2Eテストファイルを`e2e/`ディレクトリ配下に配置する
2. The E2Eテストシステム shall テストファイルの命名規則を`*.spec.ts`とする
3. The E2Eテストシステム shall 共通テストユーティリティを`e2e/utils/`ディレクトリに配置する
4. The E2Eテストシステム shall Playwrightフィクスチャ（拡張機能ロード等）を`e2e/fixtures/`ディレクトリに配置する
5. The E2Eテストシステム shall テストデータとモックを`e2e/test-data/`ディレクトリに配置する

### Requirement 6: CI/CD統合とレポート生成

**Objective:** 開発チームとして、CI/CD環境でE2Eテストを自動実行し、結果を可視化したい。これにより、継続的な品質保証を実現する。

#### Acceptance Criteria
1. The E2Eテストシステム shall CI/CD環境およびローカル実行時にデフォルトでheadlessモードでテストを実行する
2. The E2Eテストシステム shall テスト結果をJUnit XML形式で出力する
3. The E2Eテストシステム shall テスト失敗時のスクリーンショットとトレースを保存する
4. The E2Eテストシステム shall HTMLレポートを生成し、詳細なテスト結果を提供する
5. The E2Eテストシステム shall 並列テスト実行による実行時間の最適化をサポートする
6. The E2Eテストシステム shall headlessモードでもCI環境変数（`CI=true`）を検知し、適切な設定を自動適用する

### Requirement 7: 既存テストとの共存と棲み分け

**Objective:** テスト開発者として、既存のVitest + React Testing Libraryテストとの明確な責務分離を維持したい。これにより、各テストレベルの目的を明確化し、重複を避ける。

#### Acceptance Criteria
1. The E2Eテストシステム shall ユニットテスト（`*.test.ts(x)`）はVitestで実行し続ける
2. The E2Eテストシステム shall 統合テスト（`*.integration.test.tsx`）はVitestで実行し続ける
3. The E2Eテストシステム shall E2Eテスト（`e2e/*.spec.ts`）のみPlaywrightで実行する
4. The E2Eテストシステム shall `npm test`コマンドでVitestテストのみを実行する
5. The E2Eテストシステム shall `npm run test:e2e`コマンドでPlaywrightテストのみを実行する
6. The E2Eテストシステム shall `npm run test:all`コマンドでVitestとPlaywrightの両方を順次実行する

### Requirement 8: デバッグとトラブルシューティング支援

**Objective:** テスト開発者として、E2Eテストの失敗原因を迅速に特定し、修正できるようにしたい。これにより、テスト開発の効率を向上させる。

#### Acceptance Criteria
1. The E2Eテストシステム shall Playwright Inspectorを使用したステップバイステップデバッグをサポートする
2. The E2Eテストシステム shall Trace Viewerによるテスト実行の詳細な可視化をサポートする
3. When テストが失敗した場合、the E2Eテストシステム shall DOM状態のスナップショットを保存する
4. The E2Eテストシステム shall Playwrightのログレベルを環境変数で制御可能にする
5. The E2Eテストシステム shall デバッグ目的でheadedモードでのテスト実行を環境変数（`HEADED=true`）またはコマンド（`test:e2e:debug`）でサポートする
6. When headedモードで実行する場合、the E2Eテストシステム shall ブラウザDevToolsへのアクセスを許可する

### Requirement 9: パフォーマンスと安定性の確保

**Objective:** テスト開発者として、E2Eテストが安定的かつ高速に実行されることを保証したい。これにより、CI/CDパイプラインの効率を維持する。

#### Acceptance Criteria
1. The E2Eテストシステム shall 適切なwait戦略（waitForSelector, waitForLoadState等）を使用してflakyテストを回避する
2. The E2Eテストシステム shall テストごとにブラウザコンテキストを独立させ、テスト間の干渉を防ぐ
3. The E2Eテストシステム shall テスト実行時のタイムアウト設定を適切に構成する（デフォルト30秒）
4. The E2Eテストシステム shall 拡張機能の初期化完了を確実に待機してからテストを開始する
5. The E2Eテストシステム shall リトライ機能を活用し、一時的な失敗に対応する（最大2回リトライ）

