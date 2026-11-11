import { describe, it, expect } from 'vitest';
import type { TabNode } from '@/types';
import { collectTabIds, flattenTabNodes } from './tab-tree';

const node = (tabId: number, children: TabNode[] = []): TabNode => ({ tabId, isExpanded: true, children });

describe('flattenTabNodes / collectTabIds', () => {
  const tree = [node(1, [node(2, [node(3)]), node(4)]), node(5)];

  it('親を子より先にした表示順で並べる', () => {
    expect(collectTabIds(tree)).toEqual([1, 2, 3, 4, 5]);
    expect(flattenTabNodes(tree).map((n) => n.tabId)).toEqual([1, 2, 3, 4, 5]);
  });

  it('空のツリーは空配列を返す', () => {
    expect(collectTabIds([])).toEqual([]);
  });
});
