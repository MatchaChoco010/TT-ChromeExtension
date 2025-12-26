import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupManager } from './GroupManager';
import type { IStorageService, Group } from '@/types';

/**
 * GroupManager ユニットテスト
 * Requirements: 5.1, 5.2
 */
describe('GroupManager', () => {
  let groupManager: GroupManager;
  let mockStorageService: IStorageService;
  let mockGroups: Record<string, Group>;

  beforeEach(() => {
    // モックストレージの初期化
    mockGroups = {};

    mockStorageService = {
      get: vi.fn(async (key) => {
        if (key === 'groups') {
          return mockGroups;
        }
        return null;
      }),
      set: vi.fn(async (key, value) => {
        if (key === 'groups') {
          mockGroups = value as Record<string, Group>;
        }
      }),
      remove: vi.fn(),
      onChange: vi.fn(() => () => {}),
    };

    groupManager = new GroupManager(mockStorageService);
  });

  describe('createGroup', () => {
    it('新しいグループを作成できること', async () => {
      // Acceptance Criteria 5.1: 新しいグループページを作成し、選択されたタブをその配下に配置する
      const tabIds = [1, 2, 3];
      const name = 'テストグループ';
      const color = '#ff0000';

      const group = await groupManager.createGroup(tabIds, name, color);

      // グループが正しく作成されていることを確認
      expect(group.id).toBeDefined();
      expect(group.name).toBe(name);
      expect(group.color).toBe(color);
      expect(group.isExpanded).toBe(true);
    });

    it('グループがストレージに保存されること', async () => {
      const tabIds = [1, 2, 3];
      const name = 'テストグループ';
      const color = '#ff0000';

      await groupManager.createGroup(tabIds, name, color);

      // ストレージのsetメソッドが呼ばれたことを確認
      expect(mockStorageService.set).toHaveBeenCalledWith(
        'groups',
        expect.any(Object),
      );
    });

    it('各グループがユニークなIDを持つこと', async () => {
      const group1 = await groupManager.createGroup([1], 'グループ1', '#ff0000');
      const group2 = await groupManager.createGroup([2], 'グループ2', '#00ff00');

      expect(group1.id).not.toBe(group2.id);
    });
  });

  describe('updateGroup', () => {
    it('グループの名前を更新できること', async () => {
      // Acceptance Criteria 5.2: グループページはカスタマイズ可能なタイトルと色を持つ
      const group = await groupManager.createGroup([1], '元の名前', '#ff0000');
      const newName = '新しい名前';

      await groupManager.updateGroup(group.id, { name: newName });

      const groups = await groupManager.getGroups();
      const updatedGroup = groups.find((g) => g.id === group.id);
      expect(updatedGroup?.name).toBe(newName);
    });

    it('グループの色を更新できること', async () => {
      const group = await groupManager.createGroup([1], 'グループ', '#ff0000');
      const newColor = '#00ff00';

      await groupManager.updateGroup(group.id, { color: newColor });

      const groups = await groupManager.getGroups();
      const updatedGroup = groups.find((g) => g.id === group.id);
      expect(updatedGroup?.color).toBe(newColor);
    });

    it('グループの展開状態を更新できること', async () => {
      const group = await groupManager.createGroup([1], 'グループ', '#ff0000');

      await groupManager.updateGroup(group.id, { isExpanded: false });

      const groups = await groupManager.getGroups();
      const updatedGroup = groups.find((g) => g.id === group.id);
      expect(updatedGroup?.isExpanded).toBe(false);
    });

    it('存在しないグループの更新でエラーをスローすること', async () => {
      await expect(
        groupManager.updateGroup('non-existent-id', { name: '新しい名前' }),
      ).rejects.toThrow('Group not found');
    });
  });

  describe('dissolveGroup', () => {
    it('グループを削除できること', async () => {
      const group = await groupManager.createGroup([1, 2], 'グループ', '#ff0000');

      await groupManager.dissolveGroup(group.id);

      const groups = await groupManager.getGroups();
      expect(groups.find((g) => g.id === group.id)).toBeUndefined();
    });

    it('グループ削除がストレージに反映されること', async () => {
      const group = await groupManager.createGroup([1, 2], 'グループ', '#ff0000');

      await groupManager.dissolveGroup(group.id);

      expect(mockStorageService.set).toHaveBeenCalledWith('groups', {});
    });

    it('存在しないグループの削除でエラーをスローすること', async () => {
      await expect(
        groupManager.dissolveGroup('non-existent-id'),
      ).rejects.toThrow('Group not found');
    });
  });

  describe('getGroups', () => {
    it('空の配列を返せること', async () => {
      const groups = await groupManager.getGroups();
      expect(groups).toEqual([]);
    });

    it('すべてのグループを取得できること', async () => {
      await groupManager.createGroup([1], 'グループ1', '#ff0000');
      await groupManager.createGroup([2], 'グループ2', '#00ff00');

      const groups = await groupManager.getGroups();
      expect(groups).toHaveLength(2);
      expect(groups[0].name).toBe('グループ1');
      expect(groups[1].name).toBe('グループ2');
    });

    it('ストレージからグループを読み込むこと', async () => {
      // 既存のグループをストレージに設定
      const existingGroup: Group = {
        id: 'existing-group',
        name: '既存グループ',
        color: '#ff0000',
        isExpanded: true,
      };
      mockGroups['existing-group'] = existingGroup;

      // 新しいGroupManagerインスタンスを作成
      const newGroupManager = new GroupManager(mockStorageService);
      const groups = await newGroupManager.getGroups();

      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('existing-group');
      expect(groups[0].name).toBe('既存グループ');
    });
  });
});
