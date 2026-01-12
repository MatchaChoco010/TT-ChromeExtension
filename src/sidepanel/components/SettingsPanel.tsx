import React, { useState, useRef } from 'react';
import type { UserSettings } from '@/types';
import { SnapshotManager } from '@/services/SnapshotManager';
import { downloadService } from '@/storage/DownloadService';
import { storageService } from '@/storage/StorageService';

interface SettingsPanelProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRestoreOptions, setShowRestoreOptions] = useState(false);
  const [pendingJsonData, setPendingJsonData] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const snapshotManager = new SnapshotManager(downloadService, storageService);

  const handleCreateSnapshot = async () => {
    try {
      setIsProcessing(true);
      setStatusMessage(null);
      const timestamp = new Date().toLocaleString();
      const name = `Manual Snapshot - ${timestamp}`;
      await snapshotManager.createSnapshot(name, false);
      setStatusMessage('スナップショットを保存しました');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      setStatusMessage('スナップショットの作成に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      JSON.parse(text);
      setPendingJsonData(text);
      setShowRestoreOptions(true);
      setStatusMessage(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to read file:', error);
      setStatusMessage('ファイルの読み込みに失敗しました');
    }
  };

  const handleRestore = async (closeCurrentTabs: boolean) => {
    if (!pendingJsonData) return;

    try {
      setIsProcessing(true);
      setShowRestoreOptions(false);

      // バックグラウンドスクリプトに復元を依頼
      // これにより、handleTabCreatedとの競合を回避し、親子関係とビュー配置を正しく復元
      const response = await chrome.runtime.sendMessage({
        type: 'RESTORE_SNAPSHOT',
        payload: { jsonData: pendingJsonData, closeCurrentTabs },
      });

      if (response && !response.success) {
        throw new Error(response.error || 'Unknown error');
      }

      setPendingJsonData(null);
      setStatusMessage('スナップショットを復元しました');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      setStatusMessage('スナップショットの復元に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelRestore = () => {
    setShowRestoreOptions(false);
    setPendingJsonData(null);
  };
  const handleCloseWarningThresholdChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(e.target.value, 10);

    if (value >= 1) {
      onSettingsChange({
        ...settings,
        closeWarningThreshold: value,
      });
    }
  };

  const handleNewTabPositionFromLinkChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value as 'child' | 'sibling' | 'end';
    onSettingsChange({
      ...settings,
      newTabPositionFromLink: value,
    });
  };

  const handleNewTabPositionManualChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value as 'child' | 'sibling' | 'end';
    onSettingsChange({
      ...settings,
      newTabPositionManual: value,
    });
  };

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 8 && value <= 72) {
      onSettingsChange({
        ...settings,
        fontSize: value,
      });
    }
  };

  const handlePresetFontSize = (size: number) => {
    onSettingsChange({
      ...settings,
      fontSize: size,
    });
  };

  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({
      ...settings,
      fontFamily: e.target.value,
    });
  };

  const handleCustomCSSChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onSettingsChange({
      ...settings,
      customCSS: e.target.value,
    });
  };

  const isAutoSnapshotEnabled = settings.autoSnapshotInterval > 0;

  const handleAutoSnapshotToggle = () => {
    if (isAutoSnapshotEnabled) {
      onSettingsChange({
        ...settings,
        autoSnapshotInterval: 0,
      });
    } else {
      onSettingsChange({
        ...settings,
        autoSnapshotInterval: 10,
      });
    }
  };

  const handleAutoSnapshotIntervalChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 1) {
      onSettingsChange({
        ...settings,
        autoSnapshotInterval: value,
      });
    }
  };

  const handleSnapshotSubfolderChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onSettingsChange({
      ...settings,
      snapshotSubfolder: e.target.value,
    });
  };

  const handleDuplicateTabPositionChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value as 'sibling' | 'end';
    onSettingsChange({
      ...settings,
      duplicateTabPosition: value,
    });
  };

  return (
    <div className="settings-panel p-4 bg-gray-900 text-gray-100">
      <h1 className="text-xl font-bold mb-6 text-gray-100">設定</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-100">外観のカスタマイズ</h2>

        <div className="mb-4">
          <label
            htmlFor="fontSize"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            フォントサイズ
          </label>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => handlePresetFontSize(12)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200"
            >
              小
            </button>
            <button
              onClick={() => handlePresetFontSize(14)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200"
            >
              中
            </button>
            <button
              onClick={() => handlePresetFontSize(16)}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200"
            >
              大
            </button>
          </div>
          <input
            id="fontSize"
            type="number"
            min="8"
            max="72"
            value={settings.fontSize}
            onChange={handleFontSizeChange}
            className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-gray-100"
          />
          <p className="text-xs text-gray-400 mt-1">
            タブアイテムのフォントサイズ (8-72px)
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="fontFamily"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            フォントファミリー
          </label>
          <input
            id="fontFamily"
            type="text"
            value={settings.fontFamily}
            onChange={handleFontFamilyChange}
            className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-gray-100"
            placeholder="system-ui, -apple-system, sans-serif"
          />
          <p className="text-xs text-gray-400 mt-1">
            フォントファミリーを指定します (例: Arial, sans-serif)
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="customCSS"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            カスタムCSS
          </label>
          <textarea
            id="customCSS"
            value={settings.customCSS}
            onChange={handleCustomCSSChange}
            className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm bg-gray-700 text-gray-100"
            rows={6}
            placeholder=".tree-node { margin: 4px 0; }"
          />
          <p className="text-xs text-gray-400 mt-1">
            カスタムCSSでスタイルをオーバーライドできます
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-100">タブの動作</h2>

        <div className="mb-4">
          <label
            htmlFor="newTabPositionFromLink"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            リンククリックから開かれたタブの位置
          </label>
          <select
            id="newTabPositionFromLink"
            value={settings.newTabPositionFromLink ?? 'child'}
            onChange={handleNewTabPositionFromLinkChange}
            className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-gray-100"
          >
            <option value="child">元のタブの子</option>
            <option value="sibling">元のタブの隣</option>
            <option value="end">リストの最後</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            リンククリックから開かれたタブの挿入位置
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="newTabPositionManual"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            手動で開かれたタブの位置
          </label>
          <select
            id="newTabPositionManual"
            value={settings.newTabPositionManual ?? 'end'}
            onChange={handleNewTabPositionManualChange}
            className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-gray-100"
          >
            <option value="child">現在のタブの子</option>
            <option value="sibling">現在のタブの隣</option>
            <option value="end">リストの最後</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            手動で開かれたタブ(アドレスバー、新規タブボタン、設定画面など)の挿入位置
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="duplicateTabPosition"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            複製されたタブの位置
          </label>
          <select
            id="duplicateTabPosition"
            value={settings.duplicateTabPosition ?? 'sibling'}
            onChange={handleDuplicateTabPositionChange}
            className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-gray-100"
          >
            <option value="sibling">元のタブの直後</option>
            <option value="end">リストの最後</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            タブを複製したときの挿入位置
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="closeWarningThreshold"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            警告閾値
          </label>
          <input
            id="closeWarningThreshold"
            type="number"
            min="1"
            value={settings.closeWarningThreshold}
            onChange={handleCloseWarningThresholdChange}
            className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-gray-100"
          />
          <p className="text-xs text-gray-400 mt-1">
            タブを閉じる際の警告を表示する閾値
          </p>
          <p className="text-xs text-gray-500 mt-1">
            この数以上のタブを閉じる際に確認ダイアログを表示します
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-100">スナップショット設定</h2>

        <div className="mb-4">
          <div className="flex gap-3 mb-3">
            <button
              data-testid="settings-create-snapshot-button"
              onClick={handleCreateSnapshot}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? '処理中...' : 'スナップショットを作成'}
            </button>
            <button
              data-testid="settings-import-snapshot-button"
              onClick={handleImportClick}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              インポート
            </button>
          </div>

          {statusMessage && (
            <div className={`mb-3 p-2 rounded text-sm ${
              statusMessage.includes('失敗') ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'
            }`}>
              {statusMessage}
            </div>
          )}

          {showRestoreOptions && (
            <div className="mb-3 p-3 bg-gray-800 rounded-md border border-gray-700">
              <p className="text-sm text-gray-300 mb-3">スナップショットを復元します。現在のタブをどうしますか？</p>
              <div className="flex gap-2">
                <button
                  data-testid="settings-restore-close-tabs"
                  onClick={() => handleRestore(true)}
                  disabled={isProcessing}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded disabled:opacity-50 transition-colors"
                >
                  現在のタブを閉じる
                </button>
                <button
                  data-testid="settings-restore-keep-tabs"
                  onClick={() => handleRestore(false)}
                  disabled={isProcessing}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded disabled:opacity-50 transition-colors"
                >
                  タブを保持
                </button>
                <button
                  data-testid="settings-restore-cancel"
                  onClick={handleCancelRestore}
                  disabled={isProcessing}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded disabled:opacity-50 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            data-testid="settings-snapshot-import-input"
          />

          <p className="text-xs text-gray-400 mb-4">
            スナップショットはダウンロードフォルダに保存されます。インポートでファイルから復元できます。
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="snapshotSubfolder"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            保存先フォルダ
          </label>
          <input
            id="snapshotSubfolder"
            type="text"
            value={settings.snapshotSubfolder ?? 'TT-Snapshots'}
            onChange={handleSnapshotSubfolderChange}
            className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-gray-100"
            placeholder="TT-Snapshots"
          />
          <p className="text-xs text-gray-400 mt-1">
            ダウンロードフォルダ内のサブフォルダ名
          </p>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between">
            <label
              htmlFor="autoSnapshotEnabled"
              className="text-sm font-medium text-gray-300"
            >
              自動保存を有効にする
            </label>
            <button
              id="autoSnapshotEnabled"
              role="switch"
              aria-checked={isAutoSnapshotEnabled}
              onClick={handleAutoSnapshotToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isAutoSnapshotEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAutoSnapshotEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            設定された間隔でスナップショットを自動的に保存します
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="autoSnapshotInterval"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            自動保存の間隔（分）
          </label>
          <input
            id="autoSnapshotInterval"
            type="number"
            min="1"
            value={isAutoSnapshotEnabled ? settings.autoSnapshotInterval : 10}
            onChange={handleAutoSnapshotIntervalChange}
            disabled={!isAutoSnapshotEnabled}
            className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-gray-100 disabled:bg-gray-800 disabled:text-gray-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            スナップショットを自動的に保存する間隔（分単位）
          </p>
        </div>
      </section>
    </div>
  );
};

export default SettingsPanel;
