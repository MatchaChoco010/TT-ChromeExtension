# Requirements Document

## Introduction

本仕様は、Vivaldi-TT拡張機能の動作確認で発見された12の問題点を包括的に修正することを目的とする。修正対象には、E2Eテストのフレーキー問題、ドラッグ&ドロップ関連のバグ、UI表示の不具合、および機能の欠落が含まれる。

**追加要件**: すべての修正項目についてE2Eテストが可能なものは可能な限りE2Eテストで検証し、将来のリグレッションを検知できるようにする。

## Requirements

### Requirement 1: E2Eテストのフレーキー問題修正

**Objective:** As a 開発者, I want E2Eテストが安定して動作すること, so that CI/CDパイプラインが信頼性を持って機能する

#### Acceptance Criteria

1. When `drag-drop-placeholder.spec.ts:268`のテスト（プレースホルダーの位置がタブ間の正確な位置にあること）を実行した場合, the E2Eテスト shall `--repeat-each=10`で10回連続成功する
2. When `drag-drop-placeholder.spec.ts:318`のテスト（マウスを別の隙間に移動するとプレースホルダーも移動すること）を実行した場合, the E2Eテスト shall `--repeat-each=10`で10回連続成功する
3. When `tab-persistence.spec.ts:201`のテスト（タブ内でのページ遷移時にタイトルの永続化データが更新されること）を実行した場合, the E2Eテスト shall `--repeat-each=10`で10回連続成功する
4. The E2Eテスト shall 固定時間待機（`waitForTimeout`）を使用せず、ポーリングで状態確定を待機する

### Requirement 2: ビューのタブカウント正確性

**Objective:** As a ユーザー, I want ビューに表示されるタブ数が常に正確であること, so that タブの状態を正しく把握できる

#### Acceptance Criteria

1. When 不整合なタブ（存在しないタブID）がツリーから削除された場合, the ViewSwitcher shall ビューのタブカウントを再計算して正確な数を表示する
2. When タブが追加・削除された場合, the ViewSwitcher shall 即座にタブカウントを更新する
3. The ViewSwitcher shall 実際に存在するタブのみをカウントに含める

#### E2E Testing Requirements

4. The E2Eテスト shall 不整合タブ削除時のタブカウント再計算を検証するテストケースを含む
5. The E2Eテスト shall タブ追加・削除時のタブカウント更新を検証するテストケースを含む

### Requirement 3: タブ間隙間へのドロップ正確性

**Objective:** As a ユーザー, I want タブをタブ間の隙間にドロップした時に正しい位置に配置されること, so that 意図した場所にタブを移動できる

#### Acceptance Criteria

1. When タブをタブAとタブBの隙間にドロップした場合, the タブツリー shall ドロップしたタブをタブAの直後（タブBの直前）に配置する
2. When プレースホルダーがタブ間の隙間に表示されている状態でドロップした場合, the タブツリー shall プレースホルダーが示す位置にタブを配置する
3. When 異なる深度（インデント）の隙間にドロップした場合, the タブツリー shall 選択された深度の位置にタブを配置する

#### E2E Testing Requirements

4. The E2Eテスト shall タブ間隙間へのドロップで正確な位置に配置されることを検証するテストケースを含む
5. The E2Eテスト shall 異なる深度の隙間へのドロップを検証するテストケースを含む
6. The E2Eテスト shall `--repeat-each=10`で10回連続成功する安定したテストであること

### Requirement 4: ドラッグ中のタブサイズ安定性

**Objective:** As a ユーザー, I want ドラッグ中にタブのサイズが変わらないこと, so that 視覚的に安定した操作ができる

#### Acceptance Criteria

1. When タブを親子関係を作る形でドロップしようとした場合, the タブノード shall サイズが変化しない
2. While ドラッグ操作中, the タブノード shall 一定のサイズを維持する
3. When ドラッグしてホバーターゲットが変化した場合, the ドラッグ中のタブ shall サイズが変化しない

#### E2E Testing Requirements

4. The E2Eテスト shall ドラッグ中のタブサイズが一定であることを検証するテストケースを含む
5. The E2Eテスト shall 親子関係形成時のタブサイズ安定性を検証するテストケースを含む

### Requirement 5: ドラッグ時スクロール制限

**Objective:** As a ユーザー, I want タブドラッグ時のスクロールが適切な範囲に制限されること, so that 不自然なスクロール動作を防げる

#### Acceptance Criteria

1. While タブをドラッグ中, the タブツリービュー shall 本来のスクロール可能量を超えてスクロールしない
2. When タブツリーのコンテンツがビューポートより小さい場合, the タブツリービュー shall ドラッグ中にスクロールしない
3. When タブツリーのコンテンツがビューポートより大きい場合, the タブツリービュー shall コンテンツ末尾までのみスクロール可能とする

#### E2E Testing Requirements

4. The E2Eテスト shall ドラッグ時のスクロール量が制限されていることを検証するテストケースを含む
5. The E2Eテスト shall コンテンツが小さい場合にスクロールしないことを検証するテストケースを含む

### Requirement 6: タブグループ化機能

**Objective:** As a ユーザー, I want 右クリックメニューからタブをグループ化できること, so that 関連するタブを整理できる

#### Acceptance Criteria

1. When コンテキストメニューから「タブをグループ化」を選択した場合, the タブツリー shall 新しい親タブ（グループノード）を生成する
2. When タブをグループ化した場合, the 選択されていたタブ shall 新しく生成された親タブの子タブとして配置される
3. When 複数タブを選択してグループ化した場合, the 全ての選択タブ shall 同じ親タブの下に子タブとして配置される
4. When グループ化が完了した場合, the 親タブ shall 適切なデフォルト名（例：「グループ」）を持つ

#### E2E Testing Requirements

5. The E2Eテスト shall コンテキストメニューからのグループ化操作を検証するテストケースを含む
6. The E2Eテスト shall 単一タブのグループ化を検証するテストケースを含む
7. The E2Eテスト shall 複数タブ選択時のグループ化を検証するテストケースを含む
8. The E2Eテスト shall グループ化後の親子関係を検証するテストケースを含む

### Requirement 7: クロスウィンドウタブドラッグ

**Objective:** As a ユーザー, I want 別ウィンドウからタブをドラッグして移動できること, so that ウィンドウ間でタブを整理できる

#### Acceptance Criteria

1. When ウィンドウAでタブをドラッグしてウィンドウBのツリービューにマウスを重ねた場合, the タブツリー shall ウィンドウBのツリービューにドロップインジケーターを表示する
2. When 別ウィンドウのツリービュー上でタブをドロップした場合, the タブ shall ドロップ先のウィンドウに移動する
3. When クロスウィンドウドラッグ中, the ドラッグ元のウィンドウ shall ドラッグ中のタブを視覚的に示す

#### E2E Testing Requirements

4. The E2Eテスト shall クロスウィンドウドラッグでのタブ移動を検証するテストケースを含む
5. The E2Eテスト shall ドロップ先ウィンドウでのインジケーター表示を検証するテストケースを含む
6. The E2Eテスト shall 移動後のタブがドロップ先ウィンドウに属することを検証するテストケースを含む

### Requirement 8: 新規タブ追加ボタン

**Objective:** As a ユーザー, I want タブツリーの末尾に新規タブ追加ボタンがあること, so that 簡単に新しいタブを開ける

#### Acceptance Criteria

1. The タブツリービュー shall 全てのタブの最後に新規タブ追加ボタンを表示する
2. The 新規タブ追加ボタン shall ツリービューの横幅いっぱいの幅を持つ
3. When 新規タブ追加ボタンをクリックした場合, the 拡張機能 shall 新しいタブをツリーの末尾に追加する
4. When 新規タブ追加ボタンをクリックした場合, the 新しいタブ shall ブラウザでアクティブになる

#### E2E Testing Requirements

5. The E2Eテスト shall 新規タブ追加ボタンの存在を検証するテストケースを含む
6. The E2Eテスト shall ボタンクリックで新規タブが追加されることを検証するテストケースを含む
7. The E2Eテスト shall 新規タブがツリー末尾に配置されることを検証するテストケースを含む

### Requirement 9: 新規タブのタイトル正確性

**Objective:** As a ユーザー, I want 新規タブのタイトルが「スタートページ」と表示されること, so that タブの内容を正しく識別できる

#### Acceptance Criteria

1. When Vivaldiで新しいタブを開いた場合, the タブツリー shall タイトルとして「スタートページ」を表示する
2. When タブがスタートページを表示している場合, the タブノード shall タイトル「スタートページ」を維持する
3. When タブが別のページに遷移した場合, the タブノード shall 新しいページのタイトルに更新する

#### E2E Testing Requirements

4. The E2Eテスト shall 新規タブのタイトルが「スタートページ」であることを検証するテストケースを含む
5. The E2Eテスト shall ページ遷移後のタイトル更新を検証するテストケースを含む

### Requirement 10: ビューへの新規タブ追加

**Objective:** As a ユーザー, I want 現在開いているビューに新規タブが追加されること, so that ビューを切り替えずにタブを追加できる

#### Acceptance Criteria

1. When ビューAを開いている状態で新しいタブを開いた場合, the 新しいタブ shall ビューAに追加される
2. When 新しいタブを開いた場合, the ViewSwitcher shall 現在のビューを維持する（閉じない）
3. When デフォルトビュー以外のビューを開いている状態で新しいタブを開いた場合, the 新しいタブ shall 現在開いているビューに属する

#### E2E Testing Requirements

4. The E2Eテスト shall カスタムビューを開いた状態での新規タブ追加を検証するテストケースを含む
5. The E2Eテスト shall 新規タブ追加後もビューが維持されることを検証するテストケースを含む
6. The E2Eテスト shall 新規タブが正しいビューに属することを検証するテストケースを含む

### Requirement 11: 未読インジケーター位置

**Objective:** As a ユーザー, I want 未読インジケーターがタブの右端に表示されること, so that 一貫したUIで未読状態を確認できる

#### Acceptance Criteria

1. The 未読インジケーター shall タブノードの右端に固定表示される
2. When タブタイトルが短い場合, the 未読インジケーター shall タイトル末尾ではなくタブの右端に表示される
3. When タブタイトルが長い場合, the 未読インジケーター shall タブの右端に表示される
4. The 未読インジケーター shall タイトルの長さに関わらず一定の位置に表示される

#### E2E Testing Requirements

5. The E2Eテスト shall 未読インジケーターがタブ右端に表示されることを検証するテストケースを含む
6. The E2Eテスト shall 短いタイトルと長いタイトルの両方で位置が一定であることを検証するテストケースを含む

### Requirement 12: ピン留めタブの並び替え同期

**Objective:** As a ユーザー, I want ピン留めタブの並び替えがツリービューに正しく反映されること, so that ブラウザとツリービューの順序が一致する

#### Acceptance Criteria

1. When ピン留めタブの順序をブラウザで並び替えた場合, the タブツリー shall 同じ順序でピン留めタブを表示する
2. When 複数のピン留めタブがある状態で1つ目のタブを移動した場合, the タブツリー shall 正しい順序で更新される
3. When 複数のピン留めタブがある状態で2つ目以降のタブを移動した場合, the タブツリー shall 正しい順序で更新される
4. When ピン留めタブを任意の位置に移動した場合, the タブツリー shall ブラウザのピン留めタブ順序と一致する

#### E2E Testing Requirements

5. The E2Eテスト shall ピン留めタブの並び替え同期を検証する包括的なテストケースを含む
6. The E2Eテスト shall 3つ以上のピン留めタブで各位置への移動を検証するテストケースを含む
7. The E2Eテスト shall 1つ目、2つ目、3つ目のタブそれぞれの移動を個別に検証するテストケースを含む
8. The E2Eテスト shall `--repeat-each=10`で10回連続成功する安定したテストであること
