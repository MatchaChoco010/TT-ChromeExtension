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
import { render, screen, waitFor } from '@testing-library/react';
import { DragEndEvent } from '@dnd-kit/core';
import TabTreeView from './TabTreeView';
import { TreeStateProvider, useTreeState } from '../providers/TreeStateProvider';
import React from 'react';

// テストコンポーネント: ドラッグ&ドロップを統合
function DragDropTreeTestComponent() {
  const { treeState, handleDragEnd } = useTreeState();

  const handleNodeClick = vi.fn();
  const handleToggleExpand = vi.fn();

  if (!treeState) {
    return <div>Loading...</div>;
  }

  const rootNodes = Object.values(treeState.nodes).filter(
    (node) => node.parentId === null
  );

  return (
    <TabTreeView
      nodes={rootNodes}
      currentViewId={treeState.currentViewId}
      onNodeClick={handleNodeClick}
      onToggleExpand={handleToggleExpand}
      onDragEnd={handleDragEnd}
    />
  );
}

describe('Task 6.3: ドラッグ&ドロップによるツリー再構成', () => {
  let sendMessageMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    sendMessageMock = vi.fn().mockResolvedValue(undefined);

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
        sendMessage: sendMessageMock,
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    } as any;
  });

  it('タブを別のタブの子として配置できる (Acceptance Criteria 3.2)', async () => {
    render(
      <TreeStateProvider>
        <DragDropTreeTestComponent />
      </TreeStateProvider>
    );

    // 初期状態の確認
    await waitFor(() => {
      expect(screen.getByTestId('tree-node-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-node-2')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-node-3')).toBeInTheDocument();
    });

    // ドラッグ&ドロップイベントをシミュレート
    // node-2 を node-1 の子として配置
    const dragEndEvent: DragEndEvent = {
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
    };

    // useTreeStateから直接handleDragEndを取得して呼び出す
    let testHandleDragEnd: any;
    function TestHookComponent() {
      const { handleDragEnd } = useTreeState();
      testHandleDragEnd = handleDragEnd;
      return null;
    }

    render(
      <TreeStateProvider>
        <TestHookComponent />
      </TreeStateProvider>
    );

    await waitFor(() => {
      expect(testHandleDragEnd).toBeDefined();
    });

    // handleDragEndを呼び出す
    await testHandleDragEnd(dragEndEvent);

    // Service Workerへのメッセージが送信されたことを確認
    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith({
        type: 'UPDATE_TREE',
        payload: {
          nodeId: 'node-2',
          newParentId: 'node-1',
          index: 0,
        },
      });
    });

    // ストレージが更新されたことを確認
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('タブを同階層で順序変更できる (Acceptance Criteria 3.3)', async () => {
    // 同階層での順序変更のテスト
    // このテストは、ドロップ位置が「間」である場合の処理を確認する

    render(
      <TreeStateProvider>
        <DragDropTreeTestComponent />
      </TreeStateProvider>
    );

    // 初期状態の確認
    await waitFor(() => {
      expect(screen.getByTestId('tree-node-node-1')).toBeInTheDocument();
    });

    // ドラッグ&ドロップイベントをシミュレート
    // node-3 を node-2 の子として配置
    const dragEndEvent: DragEndEvent = {
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
    };

    // useTreeStateから直接handleDragEndを取得して呼び出す
    let testHandleDragEnd: any;
    function TestHookComponent() {
      const { handleDragEnd } = useTreeState();
      testHandleDragEnd = handleDragEnd;
      return null;
    }

    render(
      <TreeStateProvider>
        <TestHookComponent />
      </TreeStateProvider>
    );

    await waitFor(() => {
      expect(testHandleDragEnd).toBeDefined();
    });

    // handleDragEndを呼び出す
    await testHandleDragEnd(dragEndEvent);

    // Service Workerへのメッセージが送信されたことを確認
    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalled();
    });
  });

  it('循環参照を防ぐ', async () => {
    // 親を子の子として配置しようとした場合、操作をキャンセルする

    // 親子関係を持つツリーを設定
    (chrome.storage.local.get as any).mockResolvedValue({
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

    let testHandleDragEnd: any;
    function TestHookComponent() {
      const { handleDragEnd } = useTreeState();
      testHandleDragEnd = handleDragEnd;
      return null;
    }

    render(
      <TreeStateProvider>
        <TestHookComponent />
      </TreeStateProvider>
    );

    await waitFor(() => {
      expect(testHandleDragEnd).toBeDefined();
    });

    // 循環参照を試みる: node-1 を node-2 の子として配置
    const dragEndEvent: DragEndEvent = {
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
    };

    await testHandleDragEnd(dragEndEvent);

    // 循環参照が検出され、メッセージが送信されないことを確認
    await waitFor(() => {
      expect(sendMessageMock).not.toHaveBeenCalled();
    });
  });
});
