/**
 * Task 5.4: TreeStateProvider のリアルタイム更新テスト
 * Requirements: 1.4, 2.1
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { TreeStateProvider, useTreeState } from './TreeStateProvider';
import type { TreeState, StorageChanges } from '@/types';
import type { MockChrome, MessageListener } from '@/test/test-types';

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
  let mockMessageListeners: MessageListener[] = [];
  let mockStorageListeners: Array<(changes: StorageChanges, areaName: string) => void> = [];
  let mockChrome: MockChrome;

  beforeEach(() => {
    mockMessageListeners = [];
    mockStorageListeners = [];

    // chrome.storage.local のモック
    mockChrome = {
      storage: {
        local: {
          get: vi.fn<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>().mockResolvedValue({
            tree_state: {
              views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
              currentViewId: 'default',
              nodes: {},
              tabToNode: {},
            },
          }),
          set: vi.fn<(items: Record<string, unknown>) => Promise<void>>().mockResolvedValue(undefined),
          remove: vi.fn<(keys: string | string[]) => Promise<void>>(),
          clear: vi.fn<() => Promise<void>>(),
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
            mockMessageListeners.push(listener as MessageListener);
          }),
          removeListener: vi.fn((listener) => {
            mockMessageListeners = mockMessageListeners.filter(
              (l) => l !== listener
            );
          }),
        },
        sendMessage: vi.fn().mockResolvedValue(undefined),
        getURL: vi.fn(),
      },
      tabs: {
        get: vi.fn(),
        query: vi.fn().mockResolvedValue([{ id: 1, active: true }]),
        update: vi.fn(),
        move: vi.fn(),
        remove: vi.fn(),
        create: vi.fn(),
        duplicate: vi.fn(),
        reload: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
        onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
        onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      windows: {
        get: vi.fn(),
        create: vi.fn(),
        onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
        onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
      },
      sidePanel: {
        open: vi.fn(),
        getOptions: vi.fn(),
        setOptions: vi.fn(),
      },
    };
    global.chrome = mockChrome as unknown as typeof chrome;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('初期ロード時にストレージからツリー状態を読み込む', async () => {
    await act(async () => {
      render(
        <TreeStateProvider>
          <TestComponent />
        </TreeStateProvider>
      );
    });

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
    mockChrome.storage.local.get.mockResolvedValueOnce({
      tree_state: initialState,
    });

    await act(async () => {
      render(
        <TreeStateProvider>
          <TestComponent />
        </TreeStateProvider>
      );
    });

    // 初期状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('0');
    });

    // STATE_UPDATED メッセージを受信するように設定
    mockChrome.storage.local.get.mockResolvedValueOnce({
      tree_state: updatedState,
    });

    // STATE_UPDATED メッセージを送信
    await act(async () => {
      mockMessageListeners.forEach((listener) => {
        listener({ type: 'STATE_UPDATED' }, {} as chrome.runtime.MessageSender, () => {});
      });
    });

    // 更新された状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('1');
    });
  });

  // Task 10.2.1: storage.onChanged handling re-enabled with race condition fix
  it('storage.onChanged イベントを受信したときに状態を更新する', async () => {
    const initialState: TreeState = {
      views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
      currentViewId: 'default',
      nodes: {},
      tabToNode: {},
    };

    mockChrome.storage.local.get.mockResolvedValue({
      tree_state: initialState,
    });

    await act(async () => {
      render(
        <TreeStateProvider>
          <TestComponent />
        </TreeStateProvider>
      );
    });

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

    await act(async () => {
      mockStorageListeners.forEach((listener) => {
        listener({
          tree_state: {
            oldValue: initialState,
            newValue: updatedState,
          },
        }, 'local');
      });
    });

    // 更新された状態が表示されるのを待つ
    await waitFor(() => {
      expect(screen.getByTestId('node-count')).toHaveTextContent('1');
    });
  });
});
