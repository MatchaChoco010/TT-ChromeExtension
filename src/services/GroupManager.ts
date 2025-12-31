import type { Group, IStorageService, TabNode } from '@/types';

/**
 * グループタブの挿入位置情報
 */
export interface GroupPositionInfo {
  /** 挿入位置のインデックス */
  insertIndex: number;
  /** 親ノードID（nullの場合はルートレベル） */
  parentNodeId: string | null;
}

/**
 * GroupManager
 *
 * タブグループの作成・編集・削除を管理するサービス
 * Requirements: 3.1, 3.2, 3.8, 5.1, 5.2
 */
export class GroupManager {
  private groups: Map<string, Group> = new Map();

  constructor(private storageService: IStorageService) {}

  /**
   * グループ化が可能かどうかを判定
   * Requirement 3.8: 単一のタブのみが選択されている場合、「グループ化」オプションを無効化
   *
   * @param selectedCount - 選択されているタブ数
   * @returns グループ化が可能ならtrue（2タブ以上）
   */
  canCreateGroup(selectedCount: number): boolean {
    return selectedCount >= 2;
  }

  /**
   * グループタブの挿入位置を決定
   * Requirements: 3.2, 3.9, 3.10
   * - グループタブは選択されたタブの中で最も上にあるタブの位置に挿入
   * - 選択タブがすべて同じ親を持つ場合はその親の子として配置
   * - 選択タブが異なる親を持つ場合はルートレベルに配置
   *
   * @param nodes - グループ化するタブノードの配列（ツリー上の順序順）
   * @returns 挿入位置のインデックスと親ノードID
   */
  determineGroupPosition(nodes: TabNode[]): GroupPositionInfo {
    if (nodes.length === 0) {
      return { insertIndex: 0, parentNodeId: null };
    }

    // 最初のノード（ツリー上で最も上のノード）を基準にする
    const firstNode = nodes[0];

    // すべてのノードが同じ親を持つかチェック
    const parentIds = new Set(nodes.map(n => n.parentId));
    const allSameParent = parentIds.size === 1;

    if (allSameParent) {
      // すべて同じ親を持つ場合、その親の子として配置
      return {
        insertIndex: 0, // 親の子リストの先頭に配置（実際のインデックスは呼び出し側で調整）
        parentNodeId: firstNode.parentId,
      };
    } else {
      // 異なる親を持つ場合、ルートレベルに配置
      return {
        insertIndex: 0,
        parentNodeId: null,
      };
    }
  }

  /**
   * 新しいグループを作成
   * @param tabIds - グループに含めるタブIDの配列
   * @param name - グループ名
   * @param color - グループの色
   * @returns 作成されたグループ
   */
  async createGroup(
    _tabIds: number[],
    name: string,
    color: string,
  ): Promise<Group> {
    // ユニークなIDを生成
    const id = `group-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // 新しいグループオブジェクトを作成
    const group: Group = {
      id,
      name,
      color,
      isExpanded: true, // デフォルトで展開状態
    };

    // メモリに保存
    this.groups.set(id, group);

    // ストレージに永続化
    await this.persistGroups();

    return group;
  }

  /**
   * グループ情報を更新
   * @param groupId - グループID
   * @param updates - 更新する属性
   */
  async updateGroup(
    groupId: string,
    updates: Partial<Group>,
  ): Promise<void> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // グループ情報を更新
    const updatedGroup: Group = {
      ...group,
      ...updates,
      id: group.id, // IDは変更不可
    };

    this.groups.set(groupId, updatedGroup);

    // ストレージに永続化
    await this.persistGroups();
  }

  /**
   * グループを解除（削除）
   * @param groupId - グループID
   */
  async dissolveGroup(groupId: string): Promise<void> {
    if (!this.groups.has(groupId)) {
      throw new Error('Group not found');
    }

    // グループを削除
    this.groups.delete(groupId);

    // ストレージに永続化
    await this.persistGroups();
  }

  /**
   * すべてのグループを取得
   * @returns グループの配列
   */
  async getGroups(): Promise<Group[]> {
    // ストレージから最新のグループ情報を読み込む
    const storedGroups = await this.storageService.get('groups');

    if (storedGroups) {
      // ストレージからグループを復元
      this.groups.clear();
      for (const [id, group] of Object.entries(storedGroups)) {
        this.groups.set(id, group);
      }
    }

    return Array.from(this.groups.values());
  }

  /**
   * グループ情報をストレージに永続化
   */
  private async persistGroups(): Promise<void> {
    const groupsRecord: Record<string, Group> = {};
    for (const [id, group] of this.groups.entries()) {
      groupsRecord[id] = group;
    }

    await this.storageService.set('groups', groupsRecord);
  }
}
