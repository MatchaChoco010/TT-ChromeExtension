import React from 'react';

/**
 * NewTabButton コンポーネントのプロパティ
 */
interface NewTabButtonProps {
  /**
   * 新規タブ追加後に呼び出されるコールバック
   * 新規タブが作成された後に追加の処理が必要な場合に使用
   */
  onNewTab?: () => void;
}

/**
 * 新規タブ追加ボタンコンポーネント
 * タブツリーの末尾に表示され、クリックで新しいタブを作成する
 */
const NewTabButton: React.FC<NewTabButtonProps> = ({ onNewTab }) => {
  /**
   * ボタンクリック時のハンドラ
   * chrome.tabs.create を呼び出して新規タブを作成し、アクティブにする
   */
  const handleClick = async (e: React.MouseEvent) => {
    // イベントの伝播を停止
    e.stopPropagation();

    try {
      // 新しいタブをアクティブにする
      // Vivaldiスタートページを開く
      await chrome.tabs.create({
        active: true,
        url: 'chrome://vivaldi-webui/startpage',
      });

      // コールバックが提供されている場合は呼び出す
      if (onNewTab) {
        onNewTab();
      }
    } catch (error) {
      // エラーをログに出力するが、ユーザーに影響を与えないようにする
      console.error('Failed to create new tab:', error);
    }
  };

  return (
    <button
      data-testid="new-tab-button"
      onClick={handleClick}
      className="w-full p-2 flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-100 hover:bg-gray-700 border-t border-gray-700 transition-colors"
      aria-label="新規タブを追加"
    >
      <span className="text-lg">+</span>
    </button>
  );
};

export default NewTabButton;
