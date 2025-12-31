# Requirements Document

## Introduction

Vivaldi-TTのツリー型タブマネージャーにおいて、現在の実装で発見されたバグと動作不良を包括的に修正する。本要件書では、E2Eテストの安定性、ドラッグ＆ドロップ操作、タブのグループ化、永続化、表示の問題など、17項目のバグ修正を定義する。

各バグ修正についてE2Eテストで検証可能なものは必ずE2Eテストを追加し、リグレッション検知を可能にする。すべてのE2Eテストはフレーキーでなく安定して動作し、実行時間が最適化されていることを要件とする。

## Requirements

### Requirement 1: E2Eテストの安定化と品質基準

**Objective:** As a 開発者, I want E2Eテストがフレーキーでなく安定して通過する, so that CI/CDパイプラインの信頼性を確保できる

#### Acceptance Criteria
1. When `npm run test:e2e`を実行した場合, the E2Eテスト shall 全てのテストケースがパスすること
2. When `tab-persistence.spec.ts:201:5`のタイトル永続化更新テストを実行した場合, the テスト shall `--repeat-each=10`で10回連続成功すること
3. The E2Eテスト shall 固定時間待機（`waitForTimeout`）を使用せず、ポーリングで状態確定を待機すること
4. The 新規E2Eテスト shall `--repeat-each=10`で10回連続成功することを検証してから追加すること
5. The E2Eテスト shall 必要十分な短い実行時間で完了すること
6. The E2Eテスト shall 不必要に長いタイムアウト設定を使用しないこと

### Requirement 2: サブツリーのドラッグ＆ドロップ移動

**Objective:** As a ユーザー, I want 子タブを持つ親タブをドラッグして正しい位置に移動できる, so that タブツリーの構造を自由に再編成できる

#### Acceptance Criteria
1. When 子タブを持つ親タブを下方向にドラッグした場合, the タブツリー shall サブツリー全体を正しい移動数で移動すること
2. When 折りたたまれた親タブをドラッグした場合, the タブツリー shall 非表示の子タブも含めてサブツリー全体を移動すること
3. When 展開された親タブをドラッグした場合, the タブツリー shall 可視の子タブも含めてサブツリー全体を移動すること

#### E2Eテスト要件
4. The サブツリー移動機能 shall E2Eテストで検証されること（折りたたみ/展開状態両方）
5. The サブツリー移動E2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 3: タブのグループ化機能

**Objective:** As a ユーザー, I want 選択したタブをグループ化できる, so that 関連するタブをまとめて管理できる

#### Acceptance Criteria

##### グループタブの生成
1. When 複数のタブを選択してコンテキストメニューから「グループ化」を選択した場合, the タブツリー shall 新しい親タブ（グループタブ）を生成すること
2. When グループタブを生成する場合, the グループタブ shall 選択されたタブの中で最も上にあるタブの位置に挿入されること
3. When グループタブを生成する場合, the グループタブ shall グループ用ページ（`chrome-extension://[拡張機能ID]/group.html`）を表示すること
4. When グループタブを生成する場合, the グループタブ shall デフォルトで「新しいグループ」という名前を持つこと

##### 子タブの配置
5. When グループ化を実行した場合, the タブツリー shall 選択していたすべてのタブを新しいグループタブの子タブとして配置すること
6. When 子タブを配置する場合, the 子タブ shall 元の選択順序（ツリー上での上から下の順）を維持すること
7. When グループ化が完了した場合, the グループタブ shall 展開状態（子タブが表示される状態）であること

##### 単一タブの取り扱い
8. When 単一のタブのみが選択されている場合, the コンテキストメニュー shall 「グループ化」オプションを無効化（グレーアウト）すること

##### グループタブの階層
9. When 選択されたタブが異なる親を持つ場合, the グループタブ shall ルートレベル（親なし）に配置されること
10. When 選択されたタブがすべて同じ親を持つ場合, the グループタブ shall その親の子として配置されること

#### E2Eテスト要件
11. The グループ化機能 shall E2Eテストで検証されること
12. The グループ化E2Eテスト shall 以下を検証すること:
    - グループタブの生成と正しい位置への挿入
    - 子タブの順序維持
    - グループタブの展開状態
    - 単一タブ選択時のメニュー無効化
13. The グループ化E2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 4: クロスウィンドウドラッグ

**Objective:** As a ユーザー, I want 別のウィンドウからタブをドラッグして現在のウィンドウに移動できる, so that ウィンドウ間でタブを自由に整理できる

#### Acceptance Criteria

##### 基本動作
1. When 別ウィンドウでタブをドラッグ中に、新しいウィンドウのツリービューにマウスを重ねた場合, the ドラッグセッション shall そのウィンドウのツリービューへのドロップを受け入れること
2. When クロスウィンドウドラッグでタブをドロップした場合, the タブ shall ドロップ先のウィンドウに移動すること
3. If クロスウィンドウドラッグ中にツリービュー外にドロップした場合, the タブ shall 新規ウィンドウとして分離されること

##### バックグラウンドスロットリング対策
4. When ドラッグ中にマウスカーソルが別ウィンドウのツリービュー領域に進入した場合, the ドラッグ元ウィンドウ shall 進入先ウィンドウにフォーカスを移すこと（Chromeのバックグラウンドスロットリングを回避するため）
5. The クロスウィンドウドラッグ shall フォーカスのないウィンドウでもmouseenterイベントを検知できること、または検知できない場合はフォーカス移動で対応すること

#### E2Eテスト要件
6. The クロスウィンドウドラッグ機能 shall E2Eテストで検証されること
7. The クロスウィンドウドラッグE2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 5: 空ウィンドウの自動クローズ

**Objective:** As a ユーザー, I want タブが全て移動したウィンドウが自動的に閉じる, so that 不要な空ウィンドウが残らない

#### Acceptance Criteria

##### 基本動作
1. When ドラッグアウトによりウィンドウの全てのタブが別ウィンドウに移動した場合, the 元ウィンドウ shall 自動的に閉じること
2. While ウィンドウにタブが1つ以上存在する場合, the ウィンドウ shall 開いたまま維持されること
3. When ブラウザに1つのウィンドウしか存在しない場合, the 空ウィンドウ shall 閉じないこと（ブラウザ終了防止）

##### ドラッグ操作との連携
4. While ドラッグ操作中の場合, the ドラッグ元ウィンドウ shall 自動クローズを抑止すること
5. When ドラッグ操作が完了した場合, the ドラッグ元ウィンドウ shall 空であれば自動的に閉じること

##### 競合状態の取り扱い（設計方針）
6. If 競合状態（複数タブの高速削除、同時操作等）が発生した場合, the 実装 shall シンプルさを優先し、エッジケースでのタブ消失を許容すること
7. The 実装 shall 複雑な競合対策ロジックを持たず、保守性を優先すること

#### E2Eテスト要件
8. The 空ウィンドウ自動クローズ機能 shall E2Eテストで検証されること
9. The 空ウィンドウE2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 6: ビューへの新規タブ追加

**Objective:** As a ユーザー, I want 新しく追加したビューに新規タブを追加できる, so that プロジェクト別にタブを整理できる

#### Acceptance Criteria
1. When ビューを追加して開いた状態で新しいタブを開いた場合, the タブ shall 現在開いているビューに追加されること
2. When 新しいタブを開いた場合, the 現在開いているビュー shall 閉じずに開いたまま維持されること
3. If ビューが切り替わった場合, the 新規タブ shall 切り替わり後のビューに追加されること

#### E2Eテスト要件
4. The ビューへの新規タブ追加機能 shall E2Eテストで検証されること
5. The ビューE2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 7: 設定タブのタイトル表示

**Objective:** As a ユーザー, I want 設定タブに適切な名前が表示される, so that タブの内容を識別できる

#### Acceptance Criteria
1. When chrome-extension://[拡張機能ID]/settings.htmlを開いた場合, the タブツリー shall 「Settings」というタイトルを表示すること
2. The 設定ページ（settings.html） shall HTMLの`<title>`タグで「Settings」というタイトルを提供すること（フォールバックマッピングではなく、ブラウザ標準のタイトル取得を使用）
3. The タブツリー shall chrome.tabs.Tab.titleの値をそのまま表示すること
4. Note: i18n対応は不要とし、英語表記で統一する

#### E2Eテスト要件
4. The 設定タブタイトル表示 shall E2Eテストで検証されること
5. The タイトル表示E2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 8: 内部ページのタイトル表示

**Objective:** As a ユーザー, I want Vivaldiの内部ページに適切なタイトルが表示される, so that タブの内容を正確に把握できる

#### Acceptance Criteria
1. When vivaldi:calendarなどの内部ページを開いた場合, the タブツリー shall ブラウザが表示するタイトル（chrome.tabs.Tab.title）と同じタイトルを表示すること
2. The タブツリー shall chrome.tabs.Tab.titleの値をそのまま使用すること（フォールバック処理は行わない）
3. Note: 内部URLがそのままタブ名として表示されるケース（titleがURLと同一）は、i18n対応を含めた将来の改善で対応する

#### E2Eテスト要件
4. The 内部ページタイトル表示 shall E2Eテストで検証されること
5. The 内部ページタイトルE2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 9: 未読インジケーターの位置調整

**Objective:** As a ユーザー, I want 未読インジケーターがタブのdepthに応じた位置に表示される, so that ツリー構造と整合した視覚表示を得られる

#### Acceptance Criteria
1. When タブに未読インジケーターを表示する場合, the インジケーター shall タブのdepthを考慮した位置に表示すること
2. While タブがルートレベル（depth=0）の場合, the インジケーター shall 左端に表示すること
3. While タブがネストされている（depth>0）場合, the インジケーター shall depthに応じてインデントされた位置に表示すること

#### E2Eテスト要件
4. The 未読インジケーター位置 shall E2Eテストで視覚的に検証されること
5. The インジケーター位置E2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 10: 新規タブ作成時のツリー展開

**Objective:** As a ユーザー, I want ページ内リンクから新しいタブを開いた際にツリーが展開される, so that 新しいタブを確認できる

#### Acceptance Criteria
1. When ページ内リンクを中ボタンクリックして新しいタブを開いた場合, the 親タブ shall 折りたたまれている場合は展開すること
2. When 新しい子タブが作成された場合, the タブツリー shall その子タブが見える状態になること

#### E2Eテスト要件
3. The 新規タブ作成時のツリー展開 shall E2Eテストで検証されること
4. The ツリー展開E2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 11: ドラッグによる親子関係解消の永続化

**Objective:** As a ユーザー, I want ドラッグで親子関係を解消した状態が維持される, so that 意図した通りのツリー構造を保てる

#### Acceptance Criteria
1. When 子タブをドラッグして親タブから取り出し兄弟関係にした場合, the 親子関係 shall 解消された状態が維持されること
2. When 元子タブから新しいリンクを開いた場合, the 新しいタブ shall 元子タブの子タブとして作成されること（元親タブの子タブにならないこと）
3. The ドラッグで解消した親子関係 shall 後続の操作で復活しないこと

#### E2Eテスト要件
4. The 親子関係解消の永続化 shall E2Eテストで検証されること
5. The 親子関係E2Eテスト shall 元子タブからの新規タブ作成を含めて検証すること
6. The 親子関係E2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 12: ファビコンの永続化復元

**Objective:** As a ユーザー, I want ブラウザ再起動後もファビコンが表示される, so that タブを視覚的に識別できる

#### Acceptance Criteria
1. When ブラウザを再起動した場合, the タブツリー shall 永続化されていたファビコンを表示すること
2. While タブがまだロードされていない場合, the タブツリー shall 永続化されたファビコンを表示すること

#### E2Eテスト要件
3. The ファビコン永続化復元 shall E2Eテストで検証されること
4. The ファビコンE2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 13: ツリー状態の永続化

**Objective:** As a ユーザー, I want ブラウザ再起動後もタブのツリー構造が維持される, so that 作業状態を復元できる

#### Acceptance Criteria
1. When ブラウザを閉じた場合, the 拡張機能 shall タブの親子関係を永続化すること
2. When ブラウザを再起動した場合, the タブツリー shall 永続化された親子関係を復元すること
3. The ツリーの折りたたみ状態 shall ブラウザ再起動後も維持されること

#### E2Eテスト要件
4. The ツリー状態永続化 shall E2Eテストで検証されること
5. The ツリー永続化E2Eテスト shall 親子関係と折りたたみ状態を検証すること
6. The ツリー永続化E2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 14: タブ複製時の配置

**Objective:** As a ユーザー, I want 複製したタブが兄弟タブとして配置される, so that 複製元タブと並列に作業できる

#### Acceptance Criteria
1. When タブを複製した場合, the 複製されたタブ shall 複製元タブの子タブではなく兄弟タブとして配置されること
2. When タブを複製した場合, the 複製されたタブ shall 複製元タブの1個下の位置に表示されること

#### E2Eテスト要件
3. The タブ複製時の配置 shall E2Eテストで検証されること
4. The タブ複製E2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 15: リンクから開いたタブの配置設定

**Objective:** As a ユーザー, I want リンクから開いたタブの配置設定が正しく動作する, so that 設定通りにタブが配置される

#### Acceptance Criteria
1. When 設定で「リンククリックから開かれたタブの位置」を「リストの最後」に設定した場合, the 新規タブ shall リストの最後に追加されること
2. When リンクから新しいタブを開いた場合, the タブ shall 設定に従った位置に配置されること

#### E2Eテスト要件
3. The リンクタブ配置設定 shall E2Eテストで検証されること
4. The 配置設定E2Eテスト shall 複数の設定パターンを検証すること
5. The 配置設定E2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 16: 不要なバッジ表示の削除

**Objective:** As a ユーザー, I want 要件に含まれていないバッジが表示されない, so that UIがシンプルに保たれる

#### Acceptance Criteria
1. When 未読の子タブがある場合, the 親タブ shall 未読子タブのバッジを表示しないこと
2. The 親タブ shall 要件に定義されていないバッジを表示しないこと

#### E2Eテスト要件
3. The バッジ非表示 shall E2Eテストで検証されること
4. The バッジE2Eテスト shall 未読子タブがある状態でバッジが表示されないことを確認すること
5. The バッジE2Eテスト shall `--repeat-each=10`で安定して通過すること

### Requirement 17: ビューのタブ数表示の視認性向上

**Objective:** As a ユーザー, I want ビューのタブ数が見やすく表示される, so that 各ビューのタブ数を正確に把握できる

#### Acceptance Criteria
1. The ビューのタブ数表示 shall 数字が見切れず完全に表示されること
2. The タブ数表示 shall より内側に配置されて視認性が向上すること

#### E2Eテスト要件
3. The タブ数表示の視認性 shall E2Eテストで視覚的に検証されること
4. The タブ数表示E2Eテスト shall `--repeat-each=10`で安定して通過すること
