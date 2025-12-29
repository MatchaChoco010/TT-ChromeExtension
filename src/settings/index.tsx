/**
 * 設定ページエントリポイント
 * Task 8.1: 設定画面用の新規エントリポイントを作成する
 * Requirements: 5.1, 5.2, 5.3
 *
 * 設定画面を新規ブラウザタブとして表示するためのエントリポイントです。
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { SettingsPage } from './SettingsPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsPage />
  </React.StrictMode>
);
