# Requirements Document

## Introduction

このドキュメントは、Vivaldi-TT拡張機能のユーザーエクスペリエンス改善に関する要件を定義します。現在の拡張機能を実際に使用して発見された問題点を解決し、より直感的で使いやすいタブツリー管理体験を提供することを目的としています。

## Requirements

### Requirement 1: タブ表示の改善

**Objective:** ユーザーとして、タブの識別を容易にするため、タブにはページタイトルとファビコンが正しく表示されてほしい。

#### Acceptance Criteria

1. The Tab Tree View shall タブのタイトルとしてブラウザタブの実際のページタイトルを表示する
2. The Tab Tree View shall 内部IDではなくページタイトルをタブ名として表示する
3. The Tab Tree View shall 各タブの左側にそのタブのファビコンを表示する
4. If ファビコンが取得できない場合, the Tab Tree View shall デフォルトのファビコンアイコンを表示する

---

### Requirement 2: タブグループの統合表示

**Objective:** ユーザーとして、タブグループを通常のタブと同じように扱えるようにしたい。

#### Acceptance Criteria

1. The Tab Tree View shall タブグループを通常のタブと同じツリービュー内に表示する
2. The Tab Tree View shall タブグループを通常のタブと同様にドラッグ&ドロップで操作できるようにする
3. The Tab Tree View shall タブグループを折りたたみ・展開できるようにする

---

### Requirement 3: ビュー切り替えUIの改善

**Objective:** ユーザーとして、ビューの切り替えをファビコンサイズのコンパクトなボタンで行いたい。

#### Acceptance Criteria

1. The View Switcher shall ファビコンサイズのボタンでビュー切り替えができるようにする
2. The View Switcher shall ビューごとにファビコンサイズのアイコンを設定可能にする
3. When ビューのボタンを右クリックした場合, the View Switcher shall コンテキストメニューを表示する
4. When コンテキストメニューで「ビューの編集」を選択した場合, the View Switcher shall ビュー編集用のモーダルダイアログを表示する
5. The View Switcher shall 現在の鉛筆ボタンによる編集UIを削除する

---

### Requirement 4: スナップショット機能のUI改善

**Objective:** ユーザーとして、スナップショットボタンがビューを邪魔しないようにしたい。

#### Acceptance Criteria

1. The Tab Tree View shall タブビューのトップからスナップショットボタンを削除する
2. When ツリービュー内で右クリックした場合, the Context Menu shall スナップショット取得オプションをメニュー内に表示する
3. When コンテキストメニューで「スナップショットを取得」を選択した場合, the Snapshot Manager shall 現在のタブツリー状態のスナップショットを保存する

---

### Requirement 5: 設定画面の表示方法改善

**Objective:** ユーザーとして、設定画面を十分な横幅で操作したいので、新しいタブで開いてほしい。

#### Acceptance Criteria

1. When 設定を開く操作を行った場合, the Extension shall 設定画面を新しいブラウザタブとして開く
2. The Extension shall 設定画面をサイドパネル内部で開かないようにする
3. The Settings Page shall ブラウザタブの全幅を利用できるレイアウトを提供する
4. When ブラウザのツールバーにある拡張機能アイコンをクリックした場合, the Extension shall 設定画面を開くオプションを含むメニューを表示する

---

### Requirement 6: スナップショット自動保存設定

**Objective:** ユーザーとして、スナップショットを自動的に保存する設定を行いたい。

#### Acceptance Criteria

1. The Settings Page shall スナップショットの自動保存設定セクションを表示する
2. The Settings Page shall 自動保存の有効/無効を切り替えるトグルを提供する
3. The Settings Page shall 自動保存の間隔（分単位）を設定するオプションを提供する
4. While 自動保存が有効な場合, the Snapshot Manager shall 設定された間隔でスナップショットを自動的に保存する
5. The Settings Page shall 保持するスナップショットの最大数を設定するオプションを提供する

---

### Requirement 7: ドラッグ&ドロップのビジュアルフィードバック改善

**Objective:** ユーザーとして、ドラッグ&ドロップ時にドロップ先が明確に分かるようにしたい。

#### Acceptance Criteria

1. While タブをドラッグ中, when ドラッグしたタブを他のタブに重ねた場合, the Tab Tree View shall そのタブをハイライト表示してドロップ先であることを示す
2. While タブをドラッグ中, when ドラッグしたタブをタブとタブの隙間に重ねた場合, the Tab Tree View shall その隙間をインジケーターでハイライト表示する
3. The Tab Tree View shall タブへのドロップと隙間へのドロップの当たり判定を使いやすい形で実装する

---

### Requirement 8: 親子関係のあるタブのドラッグ操作改善

**Objective:** ユーザーとして、子タブを親タブから独立してドラッグ&ドロップで移動したい。

#### Acceptance Criteria

1. When 子タブをドラッグした場合, the Tab Tree View shall 親タブを追従させずに子タブのみを移動可能にする
2. The Tab Tree View shall 親子関係にある子タブを親から切り離してドロップできるようにする
3. When タブを隙間にドロップする場合, the Tab Tree View shall ドロップ先の階層（depth）を選択できるようにする
4. The Drop Indicator shall ドロップ先のdepthを視覚的に示す
5. While 隙間へのドラッグ中にホバーしている場合, when マウスカーソルを左右に動かした場合, the Tab Tree View shall ドロップ先のdepthを変更する

---

### Requirement 9: タブの複数選択機能

**Objective:** ユーザーとして、複数のタブを一度に選択して操作したい。

#### Acceptance Criteria

1. When Shiftキーを押しながらタブをクリックした場合, the Tab Tree View shall 前回選択したタブから現在のタブまでの範囲を複数選択する
2. When Ctrlキー（MacではCommand）を押しながらタブをクリックした場合, the Tab Tree View shall クリックしたタブを選択状態に追加/解除する
3. While 複数のタブが選択されている場合, when 右クリックした場合, the Context Menu shall 選択されたすべてのタブに対する操作オプションを表示する
4. The Context Menu shall 選択されたタブを一括で閉じるオプションを提供する
5. The Context Menu shall 選択されたタブをグループにまとめるオプションを提供する

---

### Requirement 10: タブの閉じるボタン表示

**Objective:** ユーザーとして、タブにホバーしたときに閉じるボタンを表示してほしい。

#### Acceptance Criteria

1. When タブにマウスカーソルをホバーした場合, the Tab Tree View shall タブの右側に閉じるボタンを表示する
2. When 閉じるボタンをクリックした場合, the Tab Tree View shall そのタブを閉じる
3. While タブにホバーしていない場合, the Tab Tree View shall 閉じるボタンを非表示にする

---

### Requirement 11: ダークテーマの統一

**Objective:** ユーザーとして、UIの色使いが統一されたダークテーマで表示してほしい。

#### Acceptance Criteria

1. The Tab Tree View shall 現在アクティブなタブを黒系の色で少し明るくハイライト表示する
2. The Tab Tree View shall 白や青などの不統一な色を使用せず、ダークテーマで統一する
3. The Tab Tree View shall アクティブタブと非アクティブタブのコントラストを適切に保つ
4. The UI shall すべての要素（タブ、ビュー、ボタン等）をダークテーマ配色で統一する

---

### Requirement 12: ピン留めタブの特別表示

**Objective:** ユーザーとして、ピン留めされたタブを他のタブと区別して表示してほしい。

#### Acceptance Criteria

1. The Tab Tree View shall ピン留めされたタブをすべての通常タブよりも上部に表示する
2. The Tab Tree View shall ピン留めされたタブをファビコンサイズで横に並べて表示する
3. The Tab Tree View shall ピン留めされたタブと通常タブの間に区切り線を表示する
4. The Tab Tree View shall ピン留めタブ領域と通常タブ領域を視覚的に明確に分離する

---

### Requirement 13: サイドパネルUIの簡素化

**Objective:** ユーザーとして、サイドパネルには不要なUIを表示せず、タブツリーに集中したい。

#### Acceptance Criteria

1. The Side Panel shall パネル上部の「Vivaldi-TT」ヘッダーを削除する
2. The Side Panel shall ブラウザ組み込みのナビゲーションボタン（履歴、ホームボタン等）を非表示にする
3. The Side Panel shall タブツリーの表示領域を最大化する

---

### Requirement 14: ドラッグ時の横スクロール防止

**Objective:** ユーザーとして、タブをドラッグ中にツリービューが意図せず左右にスクロールしないようにしたい。

#### Acceptance Criteria

1. While タブをドラッグ中, the Tab Tree View shall 水平方向のスクロールを無効化する
2. The Tab Tree View shall ドラッグ中に左右にマウスを移動してもビューが横スクロールしないようにする
3. When ドラッグ操作が終了した場合, the Tab Tree View shall 通常のスクロール動作を復元する

---

### Requirement 15: ツリービュー外へのドロップによる新規ウィンドウ作成

**Objective:** ユーザーとして、タブをツリービューの外にドロップして新しいウィンドウに分離したい。

#### Acceptance Criteria

1. While タブをドラッグ中, when マウスカーソルがツリービュー領域の外に出た場合, the Tab Tree View shall ドロップ可能領域であることを視覚的に示す
2. When タブをツリービュー外にドロップした場合, the Extension shall 新しいブラウザウィンドウを作成する
3. When タブをツリービュー外にドロップした場合, the Extension shall ドラッグしたタブとその子タブ（サブツリー全体）を新しいウィンドウに移動する
4. When タブグループをツリービュー外にドロップした場合, the Extension shall タブグループとその配下のすべてのタブを新しいウィンドウに移動する
5. The Extension shall 新しいウィンドウでもツリー構造（親子関係）を維持する

---

### Requirement 16: ドラッグ中のタブ位置固定

**Objective:** ユーザーとして、タブをドラッグしている間は他のタブが移動せず、ドロップ時にのみ位置が確定されるようにしたい。

#### Acceptance Criteria

1. While タブをドラッグ中, the Tab Tree View shall 既存のタブの表示位置を変更しない
2. While タブをドラッグ中, the Tab Tree View shall リアルタイムでのタブ並べ替えを行わない
3. When タブをドロップした場合, the Tab Tree View shall ドロップ先に基づいてツリー構造を再構築する
4. The Tab Tree View shall ドロップ先のみをインジケーターで視覚的に示し、他のタブはドラッグ開始時の位置を維持する
