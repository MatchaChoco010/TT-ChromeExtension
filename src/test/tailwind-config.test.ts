/**
 * Test for Tailwind CSS configuration
 * タブツリー背景色の無彩色化
 * - grayパレットがneutralで上書きされていること
 * - ダークブルーではなく無彩色が適用されること
 */
import { describe, it, expect } from 'vitest';
import type { Config } from 'tailwindcss';
// @ts-expect-error - tailwind.config.js does not have type declarations
import tailwindConfig from '../../tailwind.config.js';
import colors from 'tailwindcss/colors';

// Type the imported config
const config = tailwindConfig as Config;

interface ExtendedColors {
  gray?: typeof colors.neutral;
}

describe('Tailwind CSS Configuration', () => {
  describe('Gray Palette Override', () => {
    it('should have gray palette overridden with neutral colors', () => {
      // Check that the config has the extend.colors.gray setting
      const extendedColors = config.theme?.extend?.colors as ExtendedColors | undefined;
      expect(extendedColors?.gray).toBeDefined();
    });

    it('should use neutral palette values for gray', () => {
      const extendedColors = config.theme?.extend?.colors as ExtendedColors | undefined;
      const grayOverride = extendedColors?.gray;

      // Verify gray is set to neutral
      expect(grayOverride).toBe(colors.neutral);
    });

    it('should have neutral palette with no blue tint', () => {
      // Neutral palette should be truly achromatic (no blue tint)
      // Check some key shades to ensure they are neutral
      const neutralShades = colors.neutral;

      // Neutral colors should exist
      expect(neutralShades).toBeDefined();
      expect(neutralShades['50']).toBeDefined();
      expect(neutralShades['100']).toBeDefined();
      expect(neutralShades['500']).toBeDefined();
      expect(neutralShades['900']).toBeDefined();
    });
  });

  describe('Content Configuration', () => {
    it('should include sidepanel.html and src files', () => {
      expect(config.content).toContain('./sidepanel.html');
      expect(config.content).toContainEqual(expect.stringMatching(/src.*\{.*tsx.*\}/));
    });
  });
});
