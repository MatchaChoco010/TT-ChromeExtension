import type { TabNode, ViewState } from '@/types';

export const testPathAlias = (): void => {
  const testNode: TabNode = {
    tabId: 1,
    children: [],
    isExpanded: true,
  };

  const testView: ViewState = {
    name: 'Default View',
    color: '#000000',
    rootNodes: [],
    pinnedTabIds: [],
  };

  void testNode;
  void testView;
};
