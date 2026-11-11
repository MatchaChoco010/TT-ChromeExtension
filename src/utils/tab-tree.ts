/**
 * TabNodeのツリー構造の走査
 */
import type { TabNode } from '@/types';

/**
 * ツリーのノードを、親が子より先に来る順序（表示順）で並べて返す
 */
export function flattenTabNodes(nodes: TabNode[]): TabNode[] {
  return nodes.flatMap((node) => [node, ...flattenTabNodes(node.children)]);
}

/**
 * ツリーに含まれるタブIDを表示順で返す
 */
export function collectTabIds(nodes: TabNode[]): number[] {
  return flattenTabNodes(nodes).map((node) => node.tabId);
}
