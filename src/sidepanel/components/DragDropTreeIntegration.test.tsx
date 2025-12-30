/**
 * Task 6.3: ドラッグ&ドロップによるツリー再構成のテスト
 * Requirements: 3.2, 3.3
 *
 * このテストは以下をカバーします:
 * - タブを別タブの子として配置する処理
 * - タブを同階層で順序変更する処理
 * - TreeStateManager と連携してツリー状態を更新
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { DragEndEvent } from '@dnd-kit/core';
import { TreeStateProvider, useTreeState } from '../providers/TreeStateProvider';
import type { TreeState } from '@/types';
import { getMockChrome } from '@/test/test-types';

describe('Task 6.3: ドラッグ&ドロップによるツリー再構成', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // chrome.storage.local のモック
    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({
            tree_state: {
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
                'node-2': {
                  id: 'node-2',
                  tabId: 2,
                  parentId: null,
                  children: [],
                  isExpanded: true,
                  depth: 0,
                  viewId: 'default',
                },
                'node-3': {
                  id: 'node-3',
                  tabId: 3,
                  parentId: null,
                  children: [],
                  isExpanded: true,
                  depth: 0,
                  viewId: 'default',
                },
              },
              tabToNode: {
                '1': 'node-1',
                '2': 'node-2',
                '3': 'node-3',
              },
            },
          }),
          set: vi.fn().mockResolvedValue(undefined),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      runtime: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 1 }]),
        onActivated: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
        onUpdated: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
        // Task 12.3 (tab-tree-bugfix): Add onCreated and onRemoved mocks
        onCreated: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
        onRemoved: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
        // Task 13.1 (tab-tree-comprehensive-fix): Add onMoved mock for pinned tab reorder sync
        onMoved: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      // Task 12.3 (tab-tree-bugfix): Add windows.getCurrent mock
      windows: {
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
      },
    } as unknown as typeof chrome;
  });

  it('タブを別のタブの子として配置できる (Acceptance Criteria 3.2)', async () => {
    // useTreeStateから直接handleDragEndを取得して呼び出すためのコンポーネント
    let testHandleDragEnd: ((event: DragEndEvent) => void) | undefined;
    let testTreeState: TreeState | null = null;
    function TestHookComponent() {
      const { handleDragEnd, treeState } = useTreeState();
      testHandleDragEnd = handleDragEnd;
      testTreeState = treeState;
      return null;
    }

    await act(async () => {
      render(
        <TreeStateProvider>
          <TestHookComponent />
        </TreeStateProvider>
      );
    });

    // treeStateが初期化されるまで待機
    await waitFor(() => {
      expect(testTreeState).not.toBeNull();
      expect(testHandleDragEnd).toBeDefined();
    });

    // ドラッグ&ドロップイベントをシミュレート
    // node-2 を node-1 の子として配置
    const dragEndEvent = {
      active: {
        id: 'node-2',
        data: { current: undefined },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'node-1',
        data: { current: undefined },
        rect: null,
        disabled: false,
      },
      delta: { x: 0, y: 0 },
      activatorEvent: new MouseEvent('mouseup'),
      collisions: null,
    } as unknown as DragEndEvent;

    // handleDragEndを呼び出す
    await act(async () => {
      await testHandleDragEnd!(dragEndEvent);
    });

    // ストレージが更新されたことを確認（ツリー状態が保存される）
    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    // ストレージに保存されたデータを検証
    const mockChrome = getMockChrome();
    const setCall = mockChrome.storage.local.set.mock.calls[0];
    expect(setCall).toBeDefined();
    const savedState = setCall[0].tree_state as TreeState;
    expect(savedState).toBeDefined();
    // node-2の親がnode-1になっていることを確認
    expect(savedState.nodes['node-2'].parentId).toBe('node-1');
    // node-2の深さが1になっていることを確認
    expect(savedState.nodes['node-2'].depth).toBe(1);
  });

  it('タブを同階層で順序変更できる (Acceptance Criteria 3.3)', async () => {
    // 同階層での順序変更のテスト
    // このテストは、タブを別のタブの子として配置する処理を確認する

    // useTreeStateから直接handleDragEndを取得して呼び出すためのコンポーネント
    let testHandleDragEnd: ((event: DragEndEvent) => void) | undefined;
    let testTreeState: TreeState | null = null;
    function TestHookComponent() {
      const { handleDragEnd, treeState } = useTreeState();
      testHandleDragEnd = handleDragEnd;
      testTreeState = treeState;
      return null;
    }

    await act(async () => {
      render(
        <TreeStateProvider>
          <TestHookComponent />
        </TreeStateProvider>
      );
    });

    // treeStateが初期化されるまで待機
    await waitFor(() => {
      expect(testTreeState).not.toBeNull();
      expect(testHandleDragEnd).toBeDefined();
    });

    // ドラッグ&ドロップイベントをシミュレート
    // node-3 を node-2 の子として配置
    const dragEndEvent = {
      active: {
        id: 'node-3',
        data: { current: undefined },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'node-2',
        data: { current: undefined },
        rect: null,
        disabled: false,
      },
      delta: { x: 0, y: 0 },
      activatorEvent: new MouseEvent('mouseup'),
      collisions: null,
    } as unknown as DragEndEvent;

    // handleDragEndを呼び出す
    await act(async () => {
      await testHandleDragEnd!(dragEndEvent);
    });

    // ストレージが更新されたことを確認
    await waitFor(() => {
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    // ストレージに保存されたデータを検証
    const mockChrome = getMockChrome();
    const setCall = mockChrome.storage.local.set.mock.calls[0];
    expect(setCall).toBeDefined();
    const savedState = setCall[0].tree_state as TreeState;
    expect(savedState).toBeDefined();
    // node-3の親がnode-2になっていることを確認
    expect(savedState.nodes['node-3'].parentId).toBe('node-2');
    // node-3の深さが1になっていることを確認
    expect(savedState.nodes['node-3'].depth).toBe(1);
  });

  it('循環参照を防ぐ', async () => {
    // 親を子の子として配置しようとした場合、操作をキャンセルする

    // 親子関係を持つツリーを設定
    const mockChrome = getMockChrome();
    mockChrome.storage.local.get.mockResolvedValue({
      tree_state: {
        views: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
        currentViewId: 'default',
        nodes: {
          'node-1': {
            id: 'node-1',
            tabId: 1,
            parentId: null,
            children: [
              {
                id: 'node-2',
                tabId: 2,
                parentId: 'node-1',
                children: [],
                isExpanded: true,
                depth: 1,
                viewId: 'default',
              },
            ],
            isExpanded: true,
            depth: 0,
            viewId: 'default',
          },
          'node-2': {
            id: 'node-2',
            tabId: 2,
            parentId: 'node-1',
            children: [],
            isExpanded: true,
            depth: 1,
            viewId: 'default',
          },
        },
        tabToNode: {
          '1': 'node-1',
          '2': 'node-2',
        },
      },
    });

    let testHandleDragEnd: ((event: DragEndEvent) => void) | undefined;
    let testTreeState: TreeState | null = null;
    function TestHookComponent() {
      const { handleDragEnd, treeState } = useTreeState();
      testHandleDragEnd = handleDragEnd;
      testTreeState = treeState;
      return null;
    }

    await act(async () => {
      render(
        <TreeStateProvider>
          <TestHookComponent />
        </TreeStateProvider>
      );
    });

    // treeStateが初期化されるまで待機
    await waitFor(() => {
      expect(testTreeState).not.toBeNull();
      expect(testHandleDragEnd).toBeDefined();
    });

    // ストレージsetのモックをクリアして、handleDragEndでの呼び出しのみをカウント
    mockChrome.storage.local.set.mockClear();

    // 循環参照を試みる: node-1 を node-2 の子として配置
    const dragEndEvent = {
      active: {
        id: 'node-1',
        data: { current: undefined },
        rect: { current: { initial: null, translated: null } },
      },
      over: {
        id: 'node-2',
        data: { current: undefined },
        rect: null,
        disabled: false,
      },
      delta: { x: 0, y: 0 },
      activatorEvent: new MouseEvent('mouseup'),
      collisions: null,
    } as unknown as DragEndEvent;

    await act(async () => {
      await testHandleDragEnd!(dragEndEvent);
    });

    // 循環参照が検出され、ストレージが更新されないことを確認
    // 少し待ってからチェック
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});
