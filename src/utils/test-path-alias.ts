// Test file to verify path alias works
import type { TabNode, View } from '@/types';

export const testPathAlias = (): void => {
  const testNode: TabNode = {
    id: 'test',
    tabId: 1,
    parentId: null,
    children: [],
    isExpanded: true,
    depth: 0,
    viewId: 'default',
  };

  const testView: View = {
    id: 'default',
    name: 'Default View',
    color: '#000000',
  };

  // パスエイリアスの動作確認用（testNodeとtestViewを使用）
  void testNode;
  void testView;
};
