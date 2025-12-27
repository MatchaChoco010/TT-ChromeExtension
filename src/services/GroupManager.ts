import type { Group, IStorageService } from '@/types';

/**
 * GroupManager
 *
 * タブグループの作成・編集・削除を管理するサービス
 * Requirements: 5.1, 5.2
 */
export class GroupManager {
  private groups: Map<string, Group> = new Map();

  constructor(private storageService: IStorageService) {}

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
