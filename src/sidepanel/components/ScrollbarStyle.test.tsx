import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SidePanelRoot from './SidePanelRoot';

const mockChrome = {
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
    onMoved: { addListener: vi.fn(), removeListener: vi.fn() },
    onDetached: { addListener: vi.fn(), removeListener: vi.fn() },
    onAttached: { addListener: vi.fn(), removeListener: vi.fn() },
    update: vi.fn(),
    remove: vi.fn(),
    sendMessage: vi.fn(),
    create: vi.fn(),
    get: vi.fn().mockResolvedValue({ id: 1, title: 'Test Tab', url: 'https://example.com' }),
    group: vi.fn(),
    ungroup: vi.fn(),
  },
  tabGroups: {
    query: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    onCreated: { addListener: vi.fn(), removeListener: vi.fn() },
    onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  runtime: {
    sendMessage: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        state: {
          nodes: {},
          views: [{ id: 'default', name: 'Default View', iconUrl: null }],
          currentViewId: 'default',
          windowId: 1,
        },
      });
    }),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    openOptionsPage: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  windows: {
    getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
    create: vi.fn(),
    onFocusChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
  i18n: {
    getMessage: vi.fn().mockReturnValue(''),
  },
  scripting: {
    executeScript: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>).chrome = mockChrome;
});

describe('スクロールバースタイル改善', () => {
  describe('スクロールバーのスタイルが適用されること', () => {
    it('SidePanelRootコンテナにカスタムスクロールバークラスが適用されること', async () => {
      render(<SidePanelRoot />);

      await waitFor(() => {
        const sidePanelRoot = screen.getByTestId('side-panel-root');
        expect(sidePanelRoot.classList.contains('custom-scrollbar')).toBe(true);
      });
    });

    it('タブツリーコンテナにカスタムスクロールバークラスが適用されること', async () => {
      render(<SidePanelRoot />);

      await waitFor(() => {
        const tabTreeRoot = screen.getByTestId('tab-tree-root');
        expect(tabTreeRoot.classList.contains('custom-scrollbar')).toBe(true);
      }, { timeout: 3000 });
    });
  });
});
