import type { Ecosystem, EcosystemFeatureConfig } from '@openzeppelin/ui-types';

import { getEcosystemMetadata } from '../ecosystemManager';

/**
 * Ordered list of ecosystems for consistent display across the application.
 */
export const ECOSYSTEM_ORDER: Ecosystem[] = ['evm'] as const;

/**
 * Returns the resolved feature config for an ecosystem, as declared by its
 * adapter metadata.
 */
export function getEcosystemDefaultFeatureConfig(ecosystem: Ecosystem): EcosystemFeatureConfig {
  const meta = getEcosystemMetadata(ecosystem);
  return meta?.defaultFeatureConfig ?? { enabled: false, showInUI: true };
}

export function getAvailableEcosystems(): Ecosystem[] {
  return [...ECOSYSTEM_ORDER];
}
