/**
 * グループページエントリポイント
 * Task 15.1: グループタブ専用ページの作成
 * Requirements: 5.4, 5.5
 *
 * グループタブのURL（chrome-extension://...）で表示されるページのエントリポイントです。
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { GroupPage } from './GroupPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GroupPage />
  </React.StrictMode>
);
