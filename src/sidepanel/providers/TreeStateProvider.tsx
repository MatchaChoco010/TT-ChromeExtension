import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { TreeState, TabNode } from '@/types';
import type { DragEndEvent } from '@dnd-kit/core';

interface TreeStateContextType {
  treeState: TreeState | null;
  isLoading: boolean;
  error: Error | null;
  updateTreeState: (state: TreeState) => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
}

const TreeStateContext = createContext<TreeStateContextType | undefined>(
  undefined
);

export const useTreeState = () => {
  const context = useContext(TreeStateContext);
  if (!context) {
    throw new Error('useTreeState must be used within TreeStateProvider');
  }
  return context;
};

interface TreeStateProviderProps {
  children: React.ReactNode;
}

export const TreeStateProvider: React.FC<TreeStateProviderProps> = ({
  children,
}) => {
  const [treeState, setTreeState] = useState<TreeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ストレージからツリー状態をロードする関数
  const loadTreeState = React.useCallback(async () => {
    try {
      // chrome.storage.local から tree_state を読み込む
      const result = await chrome.storage.local.get('tree_state');
      if (result.tree_state) {
        setTreeState(result.tree_state);
      } else {
        // 初期状態を作成
        const initialState: TreeState = {
          views: [
            {
              id: 'default',
              name: 'Default',
              color: '#3b82f6',
            },
          ],
          currentViewId: 'default',
          nodes: {},
          tabToNode: {},
        };
        setTreeState(initialState);
        await chrome.storage.local.set({ tree_state: initialState });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load tree state')
      );
    }
  }, []);

  useEffect(() => {
    // 初期化時にストレージからツリー状態をロード
    const initializeTreeState = async () => {
      setIsLoading(true);
      await loadTreeState();
      setIsLoading(false);
    };

    initializeTreeState();
  }, [loadTreeState]);

  useEffect(() => {
    // STATE_UPDATED メッセージをリッスン
    const messageListener = (message: { type: string }) => {
      if (message.type === 'STATE_UPDATED') {
        // ストレージから最新の状態を再読み込み
        loadTreeState();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [loadTreeState]);

  useEffect(() => {
    // chrome.storage.onChanged をリッスン
    const storageListener = (
      changes: { [key: string]: chrome.storage.StorageChange }
    ) => {
      if (changes.tree_state && changes.tree_state.newValue) {
        // ストレージの変更を状態に反映
        setTreeState(changes.tree_state.newValue);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  const updateTreeState = (state: TreeState) => {
    setTreeState(state);
    chrome.storage.local.set({ tree_state: state });
  };

  /**
   * ドラッグ&ドロップイベントハンドラ
   * タスク 6.3: ドラッグ&ドロップによるツリー再構成
   * Requirements: 3.2, 3.3
   */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id || !treeState) {
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      // ノードを探す
      const findNode = (
        nodes: Record<string, TabNode>,
        nodeId: string
      ): TabNode | null => {
        return nodes[nodeId] || null;
      };

      const activeNode = findNode(treeState.nodes, activeId);
      const overNode = findNode(treeState.nodes, overId);

      if (!activeNode || !overNode) {
        return;
      }

      // 循環参照のチェック
      const isDescendant = (ancestorId: string, descendantId: string): boolean => {
        const ancestor = treeState.nodes[ancestorId];
        if (!ancestor) return false;

        for (const child of ancestor.children) {
          if (child.id === descendantId) return true;
          if (isDescendant(child.id, descendantId)) return true;
        }

        return false;
      };

      if (isDescendant(activeId, overId)) {
        console.error('Circular reference detected');
        return;
      }

      // 新しいツリー構造を計算
      const updatedNodes = { ...treeState.nodes };

      // 古い親から削除
      Object.values(updatedNodes).forEach((node) => {
        node.children = node.children.filter((child) => child.id !== activeId);
      });

      // activeNodeを更新
      const updatedActiveNode = { ...activeNode };
      updatedActiveNode.parentId = overId;
      updatedActiveNode.depth = overNode.depth + 1;

      // 子ノードの深さを再帰的に更新
      const updateChildrenDepth = (node: TabNode): TabNode => {
        const updatedChildren = node.children.map((child) => {
          const updatedChild = { ...child, depth: node.depth + 1 };
          return updateChildrenDepth(updatedChild);
        });
        return { ...node, children: updatedChildren };
      };

      const finalActiveNode = updateChildrenDepth(updatedActiveNode);

      // 新しい親に追加
      const updatedOverNode = { ...overNode };
      updatedOverNode.children = [...updatedOverNode.children, finalActiveNode];

      updatedNodes[activeId] = finalActiveNode;
      updatedNodes[overId] = updatedOverNode;

      // 状態を更新
      const newTreeState = {
        ...treeState,
        nodes: updatedNodes,
      };

      updateTreeState(newTreeState);

      // Service Workerに通知（chrome.tabs.moveを実行）
      try {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_TREE',
          payload: {
            nodeId: activeId,
            newParentId: overId,
            index: updatedOverNode.children.length - 1,
          },
        });
      } catch (error) {
        console.error('Failed to send UPDATE_TREE message:', error);
      }
    },
    [treeState, updateTreeState]
  );

  return (
    <TreeStateContext.Provider
      value={{ treeState, isLoading, error, updateTreeState, handleDragEnd }}
    >
      {children}
    </TreeStateContext.Provider>
  );
};

export default TreeStateProvider;
