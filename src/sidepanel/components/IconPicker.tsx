/**
 * IconPicker コンポーネント
 * Task 8.1: カスタムアイコン選択UI
 * Requirements: 19.1, 19.2, 19.3
 *
 * カテゴリ別にアイコンを表示し、選択できるUIを提供します。
 * lucide-reactが使用できない場合はSVGアイコンを直接定義して使用します。
 */

import React, { useState, useCallback, useRef } from 'react';

/**
 * アイコンカテゴリの型定義
 */
export type IconCategory = 'work' | 'hobby' | 'social' | 'dev' | 'general';

/**
 * カテゴリ情報の型定義
 */
interface CategoryInfo {
  id: IconCategory;
  label: string;
  icons: IconDefinition[];
}

/**
 * アイコン定義の型
 */
interface IconDefinition {
  name: string;
  svg: React.ReactNode;
}

/**
 * IconPickerのProps
 */
export interface IconPickerProps {
  /** 現在選択中のアイコン（アイコン名またはURL） */
  currentIcon: string | undefined;
  /** アイコン選択時のコールバック */
  onSelect: (icon: string) => void;
  /** キャンセル時のコールバック */
  onCancel: () => void;
}

// SVGアイコン定義（lucide-react相当のアイコンをSVGで定義）
// 仕事カテゴリ
const workIcons: IconDefinition[] = [
  {
    name: 'briefcase',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    name: 'building',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
        <path d="M9 22v-4h6v4" />
        <path d="M8 6h.01" />
        <path d="M16 6h.01" />
        <path d="M12 6h.01" />
        <path d="M12 10h.01" />
        <path d="M12 14h.01" />
        <path d="M16 10h.01" />
        <path d="M16 14h.01" />
        <path d="M8 10h.01" />
        <path d="M8 14h.01" />
      </svg>
    ),
  },
  {
    name: 'calendar',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
  },
  {
    name: 'mail',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
  },
  {
    name: 'file-text',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <line x1="10" x2="8" y1="9" y2="9" />
      </svg>
    ),
  },
  {
    name: 'clipboard',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      </svg>
    ),
  },
  {
    name: 'presentation',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h20" />
        <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
        <path d="m7 21 5-5 5 5" />
      </svg>
    ),
  },
  {
    name: 'users',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

// 趣味カテゴリ
const hobbyIcons: IconDefinition[] = [
  {
    name: 'music',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
  },
  {
    name: 'film',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <line x1="7" x2="7" y1="3" y2="21" />
        <line x1="17" x2="17" y1="3" y2="21" />
        <line x1="3" x2="7" y1="9" y2="9" />
        <line x1="3" x2="7" y1="15" y2="15" />
        <line x1="17" x2="21" y1="9" y2="9" />
        <line x1="17" x2="21" y1="15" y2="15" />
      </svg>
    ),
  },
  {
    name: 'gamepad',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" x2="10" y1="12" y2="12" />
        <line x1="8" x2="8" y1="10" y2="14" />
        <circle cx="15" cy="13" r="1" />
        <circle cx="18" cy="11" r="1" />
        <rect width="20" height="12" x="2" y="6" rx="2" />
      </svg>
    ),
  },
  {
    name: 'camera',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
        <circle cx="12" cy="13" r="3" />
      </svg>
    ),
  },
  {
    name: 'book',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    name: 'palette',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r=".5" />
        <circle cx="17.5" cy="10.5" r=".5" />
        <circle cx="8.5" cy="7.5" r=".5" />
        <circle cx="6.5" cy="12.5" r=".5" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
      </svg>
    ),
  },
  {
    name: 'bike',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18.5" cy="17.5" r="3.5" />
        <circle cx="5.5" cy="17.5" r="3.5" />
        <circle cx="15" cy="5" r="1" />
        <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
      </svg>
    ),
  },
  {
    name: 'headphones',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </svg>
    ),
  },
];

// ソーシャルカテゴリ
const socialIcons: IconDefinition[] = [
  {
    name: 'message-circle',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" />
      </svg>
    ),
  },
  {
    name: 'heart',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
  },
  {
    name: 'share',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
        <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
      </svg>
    ),
  },
  {
    name: 'bell',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    name: 'at-sign',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
      </svg>
    ),
  },
  {
    name: 'rss',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 11a9 9 0 0 1 9 9" />
        <path d="M4 4a16 16 0 0 1 16 16" />
        <circle cx="5" cy="19" r="1" />
      </svg>
    ),
  },
  {
    name: 'globe',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" x2="22" y1="12" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    name: 'user',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

// 開発カテゴリ
const devIcons: IconDefinition[] = [
  {
    name: 'code',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    name: 'terminal',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" x2="20" y1="19" y2="19" />
      </svg>
    ),
  },
  {
    name: 'git-branch',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" x2="6" y1="3" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
      </svg>
    ),
  },
  {
    name: 'database',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5V19A9 3 0 0 0 21 19V5" />
        <path d="M3 12A9 3 0 0 0 21 12" />
      </svg>
    ),
  },
  {
    name: 'cpu',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="16" height="16" x="4" y="4" rx="2" />
        <rect width="6" height="6" x="9" y="9" rx="1" />
        <path d="M15 2v2" />
        <path d="M15 20v2" />
        <path d="M2 15h2" />
        <path d="M2 9h2" />
        <path d="M20 15h2" />
        <path d="M20 9h2" />
        <path d="M9 2v2" />
        <path d="M9 20v2" />
      </svg>
    ),
  },
  {
    name: 'server',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
        <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
        <line x1="6" x2="6.01" y1="6" y2="6" />
        <line x1="6" x2="6.01" y1="18" y2="18" />
      </svg>
    ),
  },
  {
    name: 'bug',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m8 2 1.88 1.88" />
        <path d="M14.12 3.88 16 2" />
        <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
        <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
        <path d="M12 20v-9" />
        <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
        <path d="M6 13H2" />
        <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
        <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
        <path d="M22 13h-4" />
        <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
      </svg>
    ),
  },
  {
    name: 'package',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16.5 9.4 7.55 4.24" />
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.29 7 12 12 20.71 7" />
        <line x1="12" x2="12" y1="22" y2="12" />
      </svg>
    ),
  },
];

// 一般カテゴリ
const generalIcons: IconDefinition[] = [
  {
    name: 'home',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    name: 'star',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    name: 'bookmark',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      </svg>
    ),
  },
  {
    name: 'folder',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    name: 'search',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" x2="16.65" y1="21" y2="16.65" />
      </svg>
    ),
  },
  {
    name: 'settings',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    name: 'link',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    name: 'layers',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
];

// カテゴリ一覧
const CATEGORIES: CategoryInfo[] = [
  { id: 'work', label: 'Work', icons: workIcons },
  { id: 'hobby', label: 'Hobby', icons: hobbyIcons },
  { id: 'social', label: 'Social', icons: socialIcons },
  { id: 'dev', label: 'Dev', icons: devIcons },
  { id: 'general', label: 'General', icons: generalIcons },
];

// 全アイコン名からアイコン定義を取得するマップを作成
const ALL_ICONS_MAP = new Map<string, IconDefinition>();
CATEGORIES.forEach((category) => {
  category.icons.forEach((icon) => {
    ALL_ICONS_MAP.set(icon.name, icon);
  });
});

/**
 * アイコン名からSVGを取得するヘルパー関数
 * @param iconName アイコン名
 * @returns アイコン定義またはundefined
 */
export const getIconByName = (iconName: string): IconDefinition | undefined => {
  return ALL_ICONS_MAP.get(iconName);
};

/**
 * アイコン名がカスタムアイコンかどうかを判定する
 * @param iconName アイコン名またはURL
 * @returns カスタムアイコンの場合true
 */
export const isCustomIcon = (iconName: string | undefined): boolean => {
  if (!iconName) return false;
  if (iconName.startsWith('http://') || iconName.startsWith('https://')) return false;
  return ALL_ICONS_MAP.has(iconName);
};

/**
 * 初期カテゴリを決定するヘルパー関数
 */
const getInitialCategory = (iconName: string | undefined): IconCategory => {
  if (!iconName || iconName.startsWith('http://') || iconName.startsWith('https://')) {
    return 'work';
  }
  for (const category of CATEGORIES) {
    if (category.icons.some((icon) => icon.name === iconName)) {
      return category.id;
    }
  }
  return 'work';
};

/**
 * 初期URL値を決定するヘルパー関数
 */
const getInitialUrlInput = (iconName: string | undefined): string => {
  if (iconName && (iconName.startsWith('http://') || iconName.startsWith('https://'))) {
    return iconName;
  }
  return '';
};

/**
 * IconPicker コンポーネント
 */
export const IconPicker: React.FC<IconPickerProps> = ({
  currentIcon,
  onSelect,
  onCancel,
}) => {
  // 現在選択中のカテゴリ（初期値を計算）
  const [selectedCategory, setSelectedCategory] = useState<IconCategory>(() =>
    getInitialCategory(currentIcon)
  );

  // 現在選択中のアイコン名またはURL
  const [selectedIcon, setSelectedIcon] = useState<string | undefined>(currentIcon);

  // URL入力フィールドの値
  const [urlInput, setUrlInput] = useState<string>(() =>
    getInitialUrlInput(currentIcon)
  );

  // タブリストへの参照
  const tabListRef = useRef<HTMLDivElement | null>(null);

  // カテゴリ切り替え
  const handleCategoryChange = useCallback((categoryId: IconCategory) => {
    setSelectedCategory(categoryId);
  }, []);

  // アイコン選択 - 即座にonSelectを呼び出す (Requirement 9.3: Select button不要)
  const handleIconSelect = useCallback((iconName: string) => {
    setSelectedIcon(iconName);
    setUrlInput(''); // アイコン選択時はURL入力をクリア
    onSelect(iconName); // 即座に選択を確定
  }, [onSelect]);

  // URL入力変更
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setUrlInput(url);
    if (url.trim()) {
      setSelectedIcon(url.trim());
    }
  }, []);

  // 選択確定
  const handleSelect = useCallback(() => {
    if (selectedIcon) {
      onSelect(selectedIcon);
    }
  }, [selectedIcon, onSelect]);

  // キーボードナビゲーション
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const tabs = CATEGORIES;
      let newIndex = index;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          newIndex = (index + 1) % tabs.length;
          break;
        case 'ArrowLeft':
          e.preventDefault();
          newIndex = (index - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      setSelectedCategory(tabs[newIndex].id);
      // 新しいタブにフォーカスを移動
      const tabButtons = tabListRef.current?.querySelectorAll('[role="tab"]');
      if (tabButtons && tabButtons[newIndex]) {
        (tabButtons[newIndex] as HTMLElement).focus();
      }
    },
    []
  );

  // 現在のカテゴリのアイコン一覧
  const currentCategoryIcons =
    CATEGORIES.find((c) => c.id === selectedCategory)?.icons ?? [];

  // プレビュー用のアイコン
  const previewIcon = selectedIcon
    ? urlInput.trim()
      ? null // URLの場合は画像として表示
      : ALL_ICONS_MAP.get(selectedIcon)
    : null;

  return (
    <div
      data-testid="icon-picker"
      className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"
    >
      {/* カテゴリタブ */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Icon categories"
        className="flex border-b border-gray-700 bg-gray-900"
      >
        {CATEGORIES.map((category, index) => (
          <button
            key={category.id}
            role="tab"
            aria-selected={selectedCategory === category.id}
            aria-controls={`panel-${category.id}`}
            tabIndex={selectedCategory === category.id ? 0 : -1}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              selectedCategory === category.id
                ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-800'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
            onClick={() => handleCategoryChange(category.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* アイコングリッド */}
      <div
        id={`panel-${selectedCategory}`}
        role="tabpanel"
        aria-labelledby={`tab-${selectedCategory}`}
        className="p-3"
      >
        <div
          data-testid="icon-grid"
          role="grid"
          className="grid grid-cols-8 gap-2"
        >
          {currentCategoryIcons.map((icon) => (
            <button
              key={icon.name}
              data-testid={`icon-button-${icon.name}`}
              role="gridcell"
              aria-selected={selectedIcon === icon.name}
              className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                selectedIcon === icon.name
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
              onClick={() => handleIconSelect(icon.name)}
              title={icon.name}
            >
              <span className="w-5 h-5">{icon.svg}</span>
            </button>
          ))}
        </div>
      </div>

      {/* URL入力 */}
      <div className="px-3 pb-3">
        <label className="block text-sm text-gray-400 mb-1">
          Or enter icon URL:
        </label>
        <input
          type="text"
          value={urlInput}
          onChange={handleUrlChange}
          placeholder="Enter icon URL (e.g., https://...)"
          className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* プレビュー */}
      <div className="px-3 pb-3">
        <div
          data-testid="icon-preview"
          className="flex items-center gap-2 p-2 bg-gray-900 rounded border border-gray-700"
        >
          <div className="w-10 h-10 flex items-center justify-center bg-gray-700 rounded">
            {urlInput.trim() ? (
              <img
                data-testid="icon-preview-image"
                src={urlInput.trim()}
                alt="Icon preview"
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : previewIcon ? (
              <span className="w-6 h-6 text-gray-200">{previewIcon.svg}</span>
            ) : null}
          </div>
          <span className="text-sm text-gray-400">
            {selectedIcon
              ? urlInput.trim()
                ? 'Custom URL icon'
                : selectedIcon
              : 'Select an icon'}
          </span>
        </div>
      </div>

      {/* ボタン */}
      <div className="flex justify-end gap-2 px-3 pb-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded hover:bg-gray-600"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSelect}
          disabled={!selectedIcon}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Select
        </button>
      </div>
    </div>
  );
};

export default IconPicker;
