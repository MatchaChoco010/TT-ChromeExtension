/**
 * ポップアップメニューエントリポイント
 * ポップアップメニューを新規作成
 *
 * ブラウザツールバーの拡張機能アイコンをクリックした際に表示される
 * ポップアップメニューのエントリポイントです。
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { PopupMenu } from './PopupMenu';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupMenu />
  </React.StrictMode>
);
