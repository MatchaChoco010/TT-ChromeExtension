import { useCallback } from 'react';
import type { MessageResponse } from '@/types';

interface UseCrossWindowDragProps {
  currentWindowId: number;
}

interface DragState {
  tabId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  treeData: any;
  sourceWindowId: number;
}

/**
 * Hook for handling cross-window drag and drop operations
 * Requirement 4.1, 4.2: クロスウィンドウドラッグ&ドロップ
 */
export function useCrossWindowDrag({ currentWindowId }: UseCrossWindowDragProps) {
  /**
   * Handle drag start event
   * Sets the drag state in the service worker for cross-window communication
   */
  const handleDragStart = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (tabId: number, treeData: any): Promise<void> => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'SET_DRAG_STATE',
            payload: {
              tabId,
              treeData,
              sourceWindowId: currentWindowId,
            },
          },
          (response: MessageResponse<unknown>) => {
            if (!response.success) {
              console.error('Failed to set drag state:', response.error);
            }
            resolve();
          }
        );
      });
    },
    [currentWindowId]
  );

  /**
   * Handle drag end event
   * Clears drag state or creates new window if dragged outside panel
   * @param isDraggedOutside - Whether the drag ended outside the panel
   * @param hasChildren - Whether the dragged tab has children (Task 7.3)
   */
  const handleDragEnd = useCallback(
    async (isDraggedOutside: boolean, hasChildren = false): Promise<void> => {
      if (!isDraggedOutside) {
        // Drag ended inside panel, just clear the state
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'CLEAR_DRAG_STATE' },
            (response: MessageResponse<unknown>) => {
              if (!response.success) {
                console.error('Failed to clear drag state:', response.error);
              }
              resolve();
            }
          );
        });
      }

      // Drag ended outside panel, get drag state and create new window
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'GET_DRAG_STATE' },
          (response: MessageResponse<DragState | null>) => {
            if (!response.success) {
              console.error('Failed to get drag state:', response.error);
              resolve();
              return;
            }

            const dragState = response.data;
            if (!dragState) {
              resolve();
              return;
            }

            // Task 7.3: If tab has children, move entire subtree
            const messageType = hasChildren
              ? 'CREATE_WINDOW_WITH_SUBTREE'
              : 'CREATE_WINDOW_WITH_TAB';

            // Create new window with the dragged tab (or subtree)
            chrome.runtime.sendMessage(
              {
                type: messageType,
                payload: { tabId: dragState.tabId },
              },
              (createResponse: MessageResponse<unknown>) => {
                if (!createResponse.success) {
                  console.error(
                    'Failed to create window:',
                    createResponse.error
                  );
                }

                // Clear drag state after creating window
                chrome.runtime.sendMessage(
                  { type: 'CLEAR_DRAG_STATE' },
                  (clearResponse: MessageResponse<unknown>) => {
                    if (!clearResponse.success) {
                      console.error(
                        'Failed to clear drag state:',
                        clearResponse.error
                      );
                    }
                    resolve();
                  }
                );
              }
            );
          }
        );
      });
    },
    []
  );

  /**
   * Handle drop from another window
   * Moves the dragged tab (or subtree) to the current window
   * @param hasChildren - Whether the dragged tab has children (Task 7.3)
   */
  const handleDropFromOtherWindow = useCallback(
    async (hasChildren = false): Promise<void> => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'GET_DRAG_STATE' },
          (response: MessageResponse<DragState | null>) => {
            if (!response.success) {
              console.error('Failed to get drag state:', response.error);
              resolve();
              return;
            }

            const dragState = response.data;
            if (!dragState) {
              resolve();
              return;
            }

            // Only move if tab is from a different window
            if (dragState.sourceWindowId === currentWindowId) {
              resolve();
              return;
            }

            // Task 7.3: If tab has children, move entire subtree
            const messageType = hasChildren
              ? 'MOVE_SUBTREE_TO_WINDOW'
              : 'MOVE_TAB_TO_WINDOW';

            // Move tab (or subtree) to current window
            chrome.runtime.sendMessage(
              {
                type: messageType,
                payload: { tabId: dragState.tabId, windowId: currentWindowId },
              },
              (moveResponse: MessageResponse<unknown>) => {
                if (!moveResponse.success) {
                  console.error('Failed to move tab:', moveResponse.error);
                }

                // Clear drag state after moving
                chrome.runtime.sendMessage(
                  { type: 'CLEAR_DRAG_STATE' },
                  (clearResponse: MessageResponse<unknown>) => {
                    if (!clearResponse.success) {
                      console.error(
                        'Failed to clear drag state:',
                        clearResponse.error
                      );
                    }
                    resolve();
                  }
                );
              }
            );
          }
        );
      });
    },
    [currentWindowId]
  );

  return {
    handleDragStart,
    handleDragEnd,
    handleDropFromOtherWindow,
  };
}
