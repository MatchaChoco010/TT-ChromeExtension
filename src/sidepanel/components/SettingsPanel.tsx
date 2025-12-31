import React from 'react';
import type { UserSettings } from '@/types';

interface SettingsPanelProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}

/**
 * 設定パネルコンポーネント
 * ユーザー設定のカスタマイズUIを提供します。
 *
 * Requirements: 10.1, 10.2, 10.3 (UI/UXカスタマイズ), 8.5 (警告閾値のカスタマイズ)
 */
const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
}) => {
  const handleCloseWarningThresholdChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(e.target.value, 10);

    // 1以上の値のみ受け付ける (Requirement 8.5)
    if (value >= 1) {
      onSettingsChange({
        ...settings,
        closeWarningThreshold: value,
      });
    }
  };

  // Task 3.1 (tab-tree-bugfix-2): 「デフォルトの新しいタブの位置」設定を削除
  // Requirement 17.4: 設定画面から「デフォルトの新しいタブの位置」設定を削除
  // 代わりに「リンククリックのタブの位置」と「手動で開かれたタブの位置」を個別に設定

  // Task 12.2: タブ開き方別の位置ルール (Requirements 9.2, 9.3, 9.4)
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

  // Task 13.1: フォントサイズ調整 (Requirements 10.1, 10.2)
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

  // Task 13.1: フォントファミリー選択 (Requirement 10.3)
  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({
      ...settings,
      fontFamily: e.target.value,
    });
  };

  // Task 13.1: カスタムCSS (Requirements 10.4, 10.5)
  const handleCustomCSSChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onSettingsChange({
      ...settings,
      customCSS: e.target.value,
    });
  };

  // Task 9.1: スナップショット自動保存設定 (Requirements 6.1, 6.2, 6.3, 6.5)
  const isAutoSnapshotEnabled = settings.autoSnapshotInterval > 0;

  const handleAutoSnapshotToggle = () => {
    if (isAutoSnapshotEnabled) {
      // 無効にする
      onSettingsChange({
        ...settings,
        autoSnapshotInterval: 0,
      });
    } else {
      // 有効にする（デフォルト10分）
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
    // 1分以上の値のみ受け付ける
    if (value >= 1) {
      onSettingsChange({
        ...settings,
        autoSnapshotInterval: value,
      });
    }
  };

  const handleMaxSnapshotsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    // 1以上の値のみ受け付ける
    if (value >= 1) {
      onSettingsChange({
        ...settings,
        maxSnapshots: value,
      });
    }
  };

  return (
    <div className="settings-panel p-4 bg-gray-900 text-gray-100">
      <h1 className="text-xl font-bold mb-6 text-gray-100">設定</h1>

      {/* 外観のカスタマイズセクション (Requirements 10.1-10.6) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-100">外観のカスタマイズ</h2>

        {/* フォントサイズ設定 (Requirements 10.1, 10.2) */}
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

        {/* フォントファミリー設定 (Requirement 10.3) */}
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

        {/* カスタムCSS設定 (Requirements 10.4, 10.5, 10.6) */}
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

      {/* タブの動作セクション */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-100">タブの動作</h2>

        {/* Task 3.1 (tab-tree-bugfix-2): 「デフォルトの新しいタブの位置」設定を削除
            Requirement 17.4: 設定画面から「デフォルトの新しいタブの位置」設定を削除
            代わりに「リンククリックのタブの位置」と「手動で開かれたタブの位置」を個別に設定 */}

        {/* Task 12.2: タブ開き方別の位置ルール (Requirements 9.2, 9.3, 9.4) */}
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

        {/* 警告閾値設定 (Requirement 8.5) */}
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

      {/* Task 9.1: スナップショットの自動保存セクション (Requirements 6.1, 6.2, 6.3, 6.5) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-100">スナップショットの自動保存</h2>

        {/* 自動保存有効/無効トグル (Requirement 6.2) */}
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

        {/* 自動保存間隔設定 (Requirement 6.3) */}
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

        {/* 最大スナップショット数設定 (Requirement 6.5) */}
        <div className="mb-4">
          <label
            htmlFor="maxSnapshots"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            最大スナップショット数
          </label>
          <input
            id="maxSnapshots"
            type="number"
            min="1"
            value={settings.maxSnapshots ?? 10}
            onChange={handleMaxSnapshotsChange}
            disabled={!isAutoSnapshotEnabled}
            className="w-full px-3 py-2 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-gray-100 disabled:bg-gray-800 disabled:text-gray-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            保持するスナップショットの最大数（古いものから削除されます）
          </p>
        </div>
      </section>
    </div>
  );
};

export default SettingsPanel;
