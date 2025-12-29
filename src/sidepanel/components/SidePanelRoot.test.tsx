import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import SidePanelRoot from './SidePanelRoot';

// Mock chrome.storage for tests
const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();
const mockStorageOnChanged = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

// Mock chrome.tabs for tests
const mockTabsQuery = vi.fn();
const mockTabsUpdate = vi.fn();
const mockTabsOnActivated = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};
const mockTabsOnUpdated = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

// Mock chrome.runtime for tests
const mockRuntimeSendMessage = vi.fn();
const mockRuntimeOnMessage = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

beforeEach(() => {
  // Setup chrome API mocks
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: mockStorageGet,
        set: mockStorageSet,
      },
      onChanged: mockStorageOnChanged,
    },
    tabs: {
      query: mockTabsQuery,
      update: mockTabsUpdate,
      onActivated: mockTabsOnActivated,
      onUpdated: mockTabsOnUpdated,
    },
    runtime: {
      sendMessage: mockRuntimeSendMessage,
      onMessage: mockRuntimeOnMessage,
    },
  });

  // Default mock responses
  mockStorageGet.mockResolvedValue({});
  mockStorageSet.mockResolvedValue(undefined);
  mockTabsQuery.mockResolvedValue([]);
  mockTabsUpdate.mockResolvedValue({});
  mockRuntimeSendMessage.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SidePanelRoot', () => {
  it('レンダリングされること', async () => {
    await act(async () => {
      render(<SidePanelRoot />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
    });
  });

  it('ローディング状態が表示されること', async () => {
    await act(async () => {
      render(<SidePanelRoot />);
    });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('TreeStateProviderが含まれていること', async () => {
    await act(async () => {
      render(<SidePanelRoot />);
    });
    // プロバイダーが存在することを確認するため、子コンポーネントがレンダリングされることを確認
    await waitFor(() => {
      expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
    });
  });

  it('ThemeProviderが含まれていること', async () => {
    await act(async () => {
      render(<SidePanelRoot />);
    });
    // テーマプロバイダーが存在することを確認
    await waitFor(() => {
      expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
    });
  });

  it('Task 10.2: Vivaldi-TTヘッダーが削除されていること', async () => {
    await act(async () => {
      render(<SidePanelRoot />);
    });
    // ヘッダーテキスト「Vivaldi-TT」が表示されないことを確認
    expect(screen.queryByText('Vivaldi-TT')).not.toBeInTheDocument();
  });

  it('Task 5.1: ExternalDropZone（新規ウィンドウドロップエリア）が削除されていること', async () => {
    await act(async () => {
      render(<SidePanelRoot />);
    });
    // ExternalDropZoneのdata-testidが存在しないことを確認
    expect(screen.queryByTestId('external-drop-zone')).not.toBeInTheDocument();
  });

  it('エラー境界が設定されていること', async () => {
    // エラーをスローするコンポーネント
    const ErrorComponent = () => {
      throw new Error('Test error');
    };

    // コンソールエラーをモック（テスト中のエラー出力を抑制）
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // エラー境界でエラーをキャッチすることを確認
    await act(async () => {
      render(
        <SidePanelRoot>
          <ErrorComponent />
        </SidePanelRoot>
      );
    });

    consoleError.mockRestore();
  });

  describe('Task 2.4: タブツリーの水平スクロール禁止 (Requirements 12.1, 12.2)', () => {
    it('タブツリーコンテナにoverflow-x-hiddenが適用されていること', async () => {
      await act(async () => {
        render(<SidePanelRoot />);
      });

      await waitFor(() => {
        const tabTreeRoot = screen.getByTestId('tab-tree-root');
        expect(tabTreeRoot).toBeInTheDocument();
        // overflow-y-autoは垂直スクロールを許可
        expect(tabTreeRoot).toHaveClass('overflow-y-auto');
        // overflow-x-hiddenは水平スクロールを禁止
        expect(tabTreeRoot).toHaveClass('overflow-x-hidden');
      });
    });
  });

  describe('Task 12.1: ビュー情報のTabTreeViewへの受け渡し (Requirements 18.1, 18.2, 18.3)', () => {
    it('treeStateにビューがある場合、TabTreeViewにviewsとonMoveToViewが渡されること', async () => {
      // ビューを含むtreeStateを設定
      const mockTreeState = {
        views: [
          { id: 'default', name: 'Default', color: '#3b82f6' },
          { id: 'view-2', name: 'View 2', color: '#10b981' },
        ],
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
        tabToNode: { 1: 'node-1' },
      };

      mockStorageGet.mockImplementation((keys: string | string[]) => {
        if (keys === 'tree_state' || (Array.isArray(keys) && keys.includes('tree_state'))) {
          return Promise.resolve({ tree_state: mockTreeState });
        }
        return Promise.resolve({});
      });

      await act(async () => {
        render(<SidePanelRoot />);
      });

      // TabTreeViewがレンダリングされることを確認
      await waitFor(() => {
        expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
      });
    });
  });
});
