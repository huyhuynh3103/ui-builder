import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appConfigService } from '@openzeppelin/ui-utils';

import {
  getEcosystemFeatureConfig,
  getEnabledEcosystems,
  getVisibleEcosystems,
  isEcosystemEnabled,
  shouldShowEcosystemInUI,
} from '../ecosystem-feature-flags';

// Mock the appConfigService
vi.mock('@openzeppelin/ui-utils', () => ({
  appConfigService: {
    isFeatureEnabled: vi.fn().mockReturnValue(false),
  },
}));

describe('ecosystem-feature-flags', () => {
  beforeEach(() => {
    // Reset the mock to return false by default
    vi.mocked(appConfigService.isFeatureEnabled).mockReturnValue(false);
  });

  describe('getEcosystemFeatureConfig', () => {
    it('should return default config for EVM (enabled)', () => {
      const config = getEcosystemFeatureConfig('evm');
      expect(config).toEqual({
        enabled: true,
        showInUI: true,
        disabledLabel: undefined,
        disabledDescription: undefined,
      });
    });

    it('should hide an ecosystem when its hide flag is set', () => {
      vi.mocked(appConfigService.isFeatureEnabled).mockImplementation(
        (flag) => flag === 'ecosystem_evm_hide_in_ui'
      );

      expect(getEcosystemFeatureConfig('evm').showInUI).toBe(false);
    });
  });

  describe('isEcosystemEnabled', () => {
    it('should return true for EVM by default', () => {
      expect(isEcosystemEnabled('evm')).toBe(true);
    });

    it('should respect feature flag overrides', () => {
      vi.mocked(appConfigService.isFeatureEnabled).mockImplementation(
        (flag) => flag === 'ecosystem_solana_enabled'
      );

      expect(isEcosystemEnabled('solana')).toBe(true);
    });
  });

  describe('shouldShowEcosystemInUI', () => {
    it('should return true for EVM by default', () => {
      expect(shouldShowEcosystemInUI('evm')).toBe(true);
    });

    it('should respect feature flag overrides', () => {
      vi.mocked(appConfigService.isFeatureEnabled).mockImplementation(
        (flag) => flag === 'ecosystem_evm_hide_in_ui'
      );

      expect(shouldShowEcosystemInUI('evm')).toBe(false);
    });
  });

  // This fork ships EVM only. Enabling another ecosystem by feature flag must not bring it
  // back into either list, because the registry no longer offers it at all.
  describe('ecosystem lists', () => {
    it('should expose EVM alone', () => {
      expect(getVisibleEcosystems()).toEqual(['evm']);
      expect(getEnabledEcosystems()).toEqual(['evm']);
    });

    it('should not re-admit an ecosystem that a feature flag enables', () => {
      vi.mocked(appConfigService.isFeatureEnabled).mockImplementation(
        (flag) => flag === 'ecosystem_solana_enabled' || flag === 'ecosystem_stellar_enabled'
      );

      expect(getVisibleEcosystems()).toEqual(['evm']);
      expect(getEnabledEcosystems()).toEqual(['evm']);
    });

    it('should drop EVM when it is hidden', () => {
      vi.mocked(appConfigService.isFeatureEnabled).mockImplementation(
        (flag) => flag === 'ecosystem_evm_hide_in_ui'
      );

      expect(getVisibleEcosystems()).toEqual([]);
    });
  });
});
