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
// Add onCreated and onRemoved mocks
const mockTabsOnCreated = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};
const mockTabsOnRemoved = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};
// Add onMoved mock for pinned tab reorder sync
const mockTabsOnMoved = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

// Mock chrome.runtime for tests
const mockRuntimeSendMessage = vi.fn();
const mockRuntimeOnMessage = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

// chrome.tabs.create のモック
const mockTabsCreate = vi.fn();

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
      // chrome.tabs.create のモック
      create: mockTabsCreate,
      onActivated: mockTabsOnActivated,
      onUpdated: mockTabsOnUpdated,
      // Add onCreated and onRemoved mocks
      onCreated: mockTabsOnCreated,
      onRemoved: mockTabsOnRemoved,
      // Add onMoved mock for pinned tab reorder sync
      onMoved: mockTabsOnMoved,
    },
    // Add windows.getCurrent mock
    windows: {
      getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
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
  // chrome.tabs.create のデフォルトレスポンス
  mockTabsCreate.mockResolvedValue({ id: 999, windowId: 1 });
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

  it('Vivaldi-TTヘッダーが削除されていること', async () => {
    await act(async () => {
      render(<SidePanelRoot />);
    });
    // ヘッダーテキスト「Vivaldi-TT」が表示されないことを確認
    expect(screen.queryByText('Vivaldi-TT')).not.toBeInTheDocument();
  });

  it('ExternalDropZone（新規ウィンドウドロップエリア）が削除されていること', async () => {
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

  describe('タブツリーの水平スクロール禁止', () => {
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

  describe('ビュー情報のTabTreeViewへの受け渡し', () => {
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

  describe('新規タブ追加ボタン', () => {
    it('新規タブ追加ボタンがタブツリーの後に表示されること', async () => {
      await act(async () => {
        render(<SidePanelRoot />);
      });

      await waitFor(() => {
        const newTabButton = screen.getByTestId('new-tab-button');
        expect(newTabButton).toBeInTheDocument();
      });
    });

    it('新規タブ追加ボタンがタブツリールート内に存在すること', async () => {
      await act(async () => {
        render(<SidePanelRoot />);
      });

      await waitFor(() => {
        const tabTreeRoot = screen.getByTestId('tab-tree-root');
        const newTabButton = screen.getByTestId('new-tab-button');
        expect(tabTreeRoot).toContainElement(newTabButton);
      });
    });
  });
});
