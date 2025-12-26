/**
 * Task 5.4: TreeStateProvider のリアルタイム更新テスト
 * Requirements: 1.4, 2.1
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TreeStateProvider, useTreeState } from './TreeStateProvider';
import type { TreeState } from '@/types';

// テストコンポーネント
function TestComponent() {
  const { treeState, isLoading, error } = useTreeState();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!treeState) return <div>No state</div>;

  return (
    <div>
      <div data-testid="current-view">{treeState.currentViewId}</div>
      <div data-testid="node-count">{Object.keys(treeState.nodes).length}</div>
    </div>
  );
}

describe('TreeStateProvider リアルタイム更新', () => {
  let mockMessageListeners: Array<(message: any) => void> = [];
  let mockStorageListeners: Array<(changes: any) => void> = [];

  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];

    // chrome.storage.local のモック
    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            tree_state: {
              views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
              currentViewId: 'default',
              nodes: {},
              tabToNode: {},
            },
          }),
          set: vi.fn().mockResolvedValue(undefined),
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            mockStorageListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockStorageListeners = mockStorageListeners.filter(
              (l) => l !== listener
            );
          }),
        },
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            mockMessageListeners.push(listener);
          }),
          removeListener: vi.fn((listener) => {
            mockMessageListeners = mockMessageListeners.filter(
              (l) => l !== listener
            );
          }),
        },
      },
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('初期ロード時にストレージからツリー状態を読み込む', async () => {
    render(
      <TreeStateProvider>
        <TestComponent />
      </TreeStateProvider>
    );

    // ローディング表示を確認
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // ストレージから読み込まれた状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('current-view')).toHaveTextContent('default');
    });

    expect(chrome.storage.local.get).toHaveBeenCalledWith('tree_state');
  });

  it('STATE_UPDATED メッセージを受信したときにストレージから状態を再読み込みする', async () => {
    const initialState: TreeState = {
      views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
      currentViewId: 'default',
      nodes: {},
      tabToNode: {},
    };

    const updatedState: TreeState = {
      views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
      currentViewId: 'default',
      nodes: {
        'node-1': {
          id: 'node-1',
          tabId: 1,
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
      },
      tabToNode: { '1': 'node-1' },
    };

    // 最初の読み込みは初期状態
    (chrome.storage.local.get as any).mockResolvedValueOnce({
      tree_state: initialState,
    });

    render(
      <TreeStateProvider>
        <TestComponent />
      </TreeStateProvider>
    );

    // 初期状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('0');
    });

    // STATE_UPDATED メッセージを受信するように設定
    (chrome.storage.local.get as any).mockResolvedValueOnce({
      tree_state: updatedState,
    });

    // STATE_UPDATED メッセージを送信
    mockMessageListeners.forEach((listener) => {
      listener({ type: 'STATE_UPDATED' });
    });

    // 更新された状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('1');
    });
  });

  it('storage.onChanged イベントを受信したときに状態を更新する', async () => {
    const initialState: TreeState = {
      views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
      currentViewId: 'default',
      nodes: {},
      tabToNode: {},
    };

    (chrome.storage.local.get as any).mockResolvedValue({
      tree_state: initialState,
    });

    render(
      <TreeStateProvider>
        <TestComponent />
      </TreeStateProvider>
    );

    // 初期状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('0');
    });

    // ストレージ変更イベントを発火
    const updatedState: TreeState = {
      ...initialState,
      nodes: {
        'node-1': {
          id: 'node-1',
          tabId: 1,
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
      },
      tabToNode: { '1': 'node-1' },
    };

    mockStorageListeners.forEach((listener) => {
      listener({
        tree_state: {
          oldValue: initialState,
          newValue: updatedState,
        },
      });
    });

    // 更新された状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('1');
    });
  });
});
