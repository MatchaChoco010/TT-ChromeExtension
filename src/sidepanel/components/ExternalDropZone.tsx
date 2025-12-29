import React, { useState, useCallback } from 'react';

/**
 * Task 5.1: ExternalDropZoneコンポーネントのProps
 * Requirements: 15.1
 */
export interface ExternalDropZoneProps {
  /**
   * ドラッグ中かどうかを示すフラグ
   * trueの場合、ドロップエリアがアクティブ化される
   */
  isDragging: boolean;
  /**
   * ドロップ時に呼び出されるコールバック
   * 新規ウィンドウ作成処理をトリガーする
   */
  onDrop: () => void;
}

/**
 * Task 5.1: 外部ドロップゾーンコンポーネント
 *
 * ツリービュー下部にドロップ可能エリアを配置し、
 * タブをドロップすると新しいウィンドウを作成する機能を提供する。
 *
 * Requirements:
 * - 15.1: ツリービュー外へのドロップ時に視覚的にドロップ可能領域であることを示す
 *
 * @param props - ExternalDropZoneProps
 */
const ExternalDropZone: React.FC<ExternalDropZoneProps> = ({
  isDragging,
  onDrop,
}) => {
  // ホバー状態の管理
  const [isHovering, setIsHovering] = useState(false);

  /**
   * ドラッグエンターイベントハンドラ
   * ドロップエリアに入った時にホバー状態を有効化
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovering(true);
  }, []);

  /**
   * ドラッグリーブイベントハンドラ
   * ドロップエリアから出た時にホバー状態を解除
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovering(false);
  }, []);

  /**
   * ドラッグオーバーイベントハンドラ
   * ドロップを許可するためにdefaultを防止
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * ドロップイベントハンドラ
   * タブがドロップされた時にコールバックを呼び出す
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsHovering(false);
      onDrop();
    },
    [onDrop]
  );

  // ベースのクラス
  const baseClasses = [
    'w-full',
    'min-h-[60px]',
    'flex',
    'items-center',
    'justify-center',
    'transition-all',
    'duration-200',
    'rounded-md',
    'mt-2',
  ];

  // ドラッグ中とそうでない場合のスタイル
  const visibilityClasses = isDragging
    ? ['opacity-100', 'border-dashed', 'border-2', 'border-gray-600']
    : ['opacity-0', 'pointer-events-none'];

  // ホバー中のスタイル
  const hoverClasses = isHovering && isDragging
    ? ['bg-gray-700', 'border-gray-500']
    : ['bg-gray-800'];

  const className = [...baseClasses, ...visibilityClasses, ...hoverClasses].join(' ');

  return (
    <div
      data-testid="external-drop-zone"
      className={className}
      aria-dropeffect="move"
      aria-hidden={!isDragging}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <span className="text-sm text-gray-300 pointer-events-none">
          ここにドロップして新しいウィンドウで開く
        </span>
      )}
    </div>
  );
};

export default ExternalDropZone;
