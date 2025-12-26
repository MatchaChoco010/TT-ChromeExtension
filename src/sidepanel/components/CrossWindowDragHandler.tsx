import React, { useEffect, useState } from 'react';
import { useCrossWindowDrag } from '../hooks/useCrossWindowDrag';

interface CrossWindowDragHandlerProps {
  children: React.ReactNode;
}

/**
 * Component for handling cross-window drag and drop operations
 * Requirement 4.1, 4.2: クロスウィンドウドラッグ&ドロップ
 *
 * This component:
 * - Gets the current window ID
 * - Provides cross-window drag handlers via context (future enhancement)
 * - Detects drag outside panel and creates new window
 */
export const CrossWindowDragHandler: React.FC<CrossWindowDragHandlerProps> = ({
  children,
}) => {
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);

  // Get current window ID on mount
  useEffect(() => {
    try {
      chrome.windows.getCurrent((window) => {
        if (window.id !== undefined) {
          setCurrentWindowId(window.id);
        }
      });
    } catch (error) {
      console.error('Error getting current window:', error);
    }
  }, []);

  // Initialize cross-window drag handlers
  // Currently unused but will be integrated with DragDropProvider
  useCrossWindowDrag({
    currentWindowId: currentWindowId ?? 0,
  });

  return <>{children}</>;
};

export default CrossWindowDragHandler;
