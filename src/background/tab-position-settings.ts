/**
 * 新しいタブ・複製したタブの配置に関するユーザー設定
 */
import type { UserSettings } from '@/types';

type NewTabPosition = NonNullable<UserSettings['newTabPositionManual']>;
type DuplicateTabPosition = NonNullable<UserSettings['duplicateTabPosition']>;

export interface TabPlacementSettings {
  newTabPositionFromLink: NewTabPosition;
  newTabPositionManual: NewTabPosition;
  duplicateTabPosition: DuplicateTabPosition;
  childTabBehavior: UserSettings['childTabBehavior'];
}

const DEFAULT_TAB_PLACEMENT_SETTINGS: TabPlacementSettings = {
  newTabPositionFromLink: 'child',
  newTabPositionManual: 'end',
  duplicateTabPosition: 'nextSibling',
  childTabBehavior: 'promote',
};

/**
 * 旧バージョンが保存した'sibling'は'nextSibling'として扱う
 */
function migrateLegacyPosition<T extends string>(position: T | 'sibling' | undefined): T | 'nextSibling' | undefined {
  return position === 'sibling' ? 'nextSibling' : position;
}

/**
 * 保存されたユーザー設定から、未設定の項目を既定値で補ったタブ配置設定を返す
 */
export function getSettingsWithDefaults(settings: UserSettings | null): TabPlacementSettings {
  return {
    newTabPositionFromLink:
      migrateLegacyPosition(settings?.newTabPositionFromLink) ?? DEFAULT_TAB_PLACEMENT_SETTINGS.newTabPositionFromLink,
    newTabPositionManual:
      migrateLegacyPosition(settings?.newTabPositionManual) ?? DEFAULT_TAB_PLACEMENT_SETTINGS.newTabPositionManual,
    duplicateTabPosition:
      migrateLegacyPosition(settings?.duplicateTabPosition) ?? DEFAULT_TAB_PLACEMENT_SETTINGS.duplicateTabPosition,
    childTabBehavior: settings?.childTabBehavior ?? DEFAULT_TAB_PLACEMENT_SETTINGS.childTabBehavior,
  };
}
