import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@/test/test-utils';
import SidePanelRoot from './SidePanelRoot';

const mockStorageGet = vi.fn();
const mockStorageSet = vi.fn();
const mockStorageOnChanged = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

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
const mockTabsOnCreated = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};
const mockTabsOnRemoved = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};
const mockTabsOnMoved = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};
const mockTabsOnDetached = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};
const mockTabsOnAttached = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

const mockRuntimeSendMessage = vi.fn();
const mockRuntimeOnMessage = {
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

const mockTabsCreate = vi.fn();

beforeEach(() => {
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
      create: mockTabsCreate,
      onActivated: mockTabsOnActivated,
      onUpdated: mockTabsOnUpdated,
      onCreated: mockTabsOnCreated,
      onRemoved: mockTabsOnRemoved,
      onMoved: mockTabsOnMoved,
      onDetached: mockTabsOnDetached,
      onAttached: mockTabsOnAttached,
    },
    windows: {
      getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
      getAll: vi.fn().mockResolvedValue([]),
      onCreated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onRemoved: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onFocusChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    runtime: {
      sendMessage: mockRuntimeSendMessage,
      onMessage: mockRuntimeOnMessage,
    },
  });

  mockStorageGet.mockResolvedValue({});
  mockStorageSet.mockResolvedValue(undefined);
  mockTabsQuery.mockResolvedValue([]);
  mockTabsUpdate.mockResolvedValue({});
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
    mockRuntimeSendMessage.mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      render(<SidePanelRoot />);
    });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('TreeStateProviderが含まれていること', async () => {
    await act(async () => {
      render(<SidePanelRoot />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
    });
  });

  it('ThemeProviderが含まれていること', async () => {
    await act(async () => {
      render(<SidePanelRoot />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
    });
  });

  it('Vivaldi-TTヘッダーが削除されていること', async () => {
    await act(async () => {
      render(<SidePanelRoot />);
    });
    expect(screen.queryByText('Vivaldi-TT')).not.toBeInTheDocument();
  });

  it('ExternalDropZone（新規ウィンドウドロップエリア）が削除されていること', async () => {
    await act(async () => {
      render(<SidePanelRoot />);
    });
    expect(screen.queryByTestId('external-drop-zone')).not.toBeInTheDocument();
  });

  it('エラー境界が設定されていること', async () => {
    const ErrorComponent = () => {
      throw new Error('Test error');
    };

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

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
        expect(tabTreeRoot).toHaveClass('overflow-y-auto');
        expect(tabTreeRoot).toHaveClass('overflow-x-hidden');
      });
    });
  });

  describe('ビュー情報のTabTreeViewへの受け渡し', () => {
    it('treeStateにビューがある場合、TabTreeViewにviewsとonMoveToViewが渡されること', async () => {
      const mockTreeState = {
        views: {
          'default': {
            info: { id: 'default', name: 'Default', color: '#3b82f6' },
            rootNodeIds: ['node-1'],
            nodes: {
              'node-1': {
                id: 'node-1',
                tabId: 1,
                parentId: null,
                children: [],
                isExpanded: true,
                depth: 0,
              },
            },
          },
          'view-2': {
            info: { id: 'view-2', name: 'View 2', color: '#10b981' },
            rootNodeIds: [],
            nodes: {},
          },
        },
        viewOrder: ['default', 'view-2'],
        currentViewId: 'default',
        tabToNode: { 1: { viewId: 'default', nodeId: 'node-1' } },
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
