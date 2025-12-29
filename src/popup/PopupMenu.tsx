/**
 * PopupMenuコンポーネント
 * Task 9.2: ポップアップメニューを新規作成
 * Task 9.3: スナップショット取得ボタンを追加
 * Requirements: 20.2, 20.3, 20.4, 21.1, 21.2, 21.3
 *
 * ブラウザツールバーの拡張機能アイコンをクリックした際に表示されるポップアップメニュー。
 * 「設定を開く」ボタンと「スナップショットを取得」ボタンを提供する。
 */
import React, { useState } from 'react';

/**
 * 設定アイコンのSVGコンポーネント
 * lucide-reactの代わりにSVGを直接定義
 */
const SettingsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * カメラアイコンのSVGコンポーネント（スナップショット用）
 */
const CameraIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

/**
 * スナップショット取得の状態
 */
type SnapshotStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * ポップアップメニューコンポーネント
 * 拡張機能アイコンクリック時に表示されるメニューUI
 */
export const PopupMenu: React.FC = () => {
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatus>('idle');

  /**
   * 設定ページを開く
   * chrome.runtime.openOptionsPage()を使用してOptions Pageを新規タブで開く
   */
  const handleOpenSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  /**
   * スナップショットを取得
   * Service Workerにメッセージを送信してスナップショットを作成
   * Requirement 21.1, 21.2, 21.3
   */
  const handleCreateSnapshot = async () => {
    setSnapshotStatus('loading');
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CREATE_SNAPSHOT' });
      if (response?.success) {
        setSnapshotStatus('success');
      } else {
        setSnapshotStatus('error');
      }
    } catch {
      setSnapshotStatus('error');
    }
  };

  /**
   * スナップショットボタンのテキストを取得
   */
  const getSnapshotButtonText = (): string => {
    switch (snapshotStatus) {
      case 'loading':
        return '取得中...';
      case 'success':
        return '完了しました';
      case 'error':
        return '失敗しました';
      default:
        return 'スナップショットを取得';
    }
  };

  return (
    <div
      data-testid="popup-menu"
      className="bg-gray-900 text-gray-200 p-4 min-w-[200px]"
    >
      <div className="flex flex-col gap-2">
        <button
          onClick={handleOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded bg-gray-800 hover:bg-gray-700 transition-colors text-left"
          aria-label="設定を開く"
        >
          <SettingsIcon className="w-[18px] h-[18px] text-gray-400" />
          <span>設定を開く</span>
        </button>
        <button
          onClick={handleCreateSnapshot}
          disabled={snapshotStatus === 'loading'}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded transition-colors text-left ${
            snapshotStatus === 'loading'
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : snapshotStatus === 'success'
                ? 'bg-green-800 hover:bg-green-700'
                : snapshotStatus === 'error'
                  ? 'bg-red-800 hover:bg-red-700'
                  : 'bg-gray-800 hover:bg-gray-700'
          }`}
          aria-label="スナップショットを取得"
        >
          <CameraIcon className="w-[18px] h-[18px] text-gray-400" />
          <span>{getSnapshotButtonText()}</span>
        </button>
      </div>
    </div>
  );
};

export default PopupMenu;
