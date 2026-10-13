/**
 * Contract Definition Service
 *
 * A centralized service that handles contract definition loading with automatic
 * deduplication, state management, and error handling.
 *
 * TODO: Consider migrating to TanStack Query which would provide:
 * - Built-in request deduplication
 * - Automatic caching with configurable stale times
 * - Background refetching on focus/reconnect
 * - Optimistic updates
 * - Better error handling with retry strategies
 * - Integration with React Suspense and Error Boundaries
 * - DevTools for debugging query states
 */
import { FormValues } from '@openzeppelin/ui-types';
import { logger, simpleHash } from '@openzeppelin/ui-utils';

import type { BuilderRuntime } from '@/core/runtimeAdapter';

import type { StoredContractDefinition } from '../storage/contractDefinitionStore';
import { contractDefinitionStore } from '../storage/contractDefinitionStore';
import { ContractLoadResult, loadContractDefinitionWithMetadata } from './ContractLoader';

/**
 * Contract definition request configuration
 */
interface ContractDefinitionRequest {
  runtime: BuilderRuntime;
  formValues: FormValues;
  networkId: string;
  contractAddress: string;
}

/**
 * Loading state for a contract definition
 */
interface LoadingState {
  isLoading: boolean;
  error: Error | null;
  lastLoaded: string | null; // Request key of last successful load
}

/**
 * Contract definition service with automatic deduplication and state management
 */
class ContractDefinitionService {
  private loadingStates = new Map<string, LoadingState>();
  private callbacks = new Set<(state: LoadingState & { requestKey: string }) => void>();

  /**
   * Generate request key for deduplication
   */
  private getRequestKey(networkId: string, contractAddress: string, definition?: string): string {
    const defHash = definition && definition.trim().length > 0 ? simpleHash(definition) : 'no-abi';
    return `${networkId}:${contractAddress.toLowerCase()}:${defHash}`;
  }

  /**
   * Get current loading state for a request
   */
  getLoadingState(networkId: string, contractAddress: string, definition?: string): LoadingState {
    const key = this.getRequestKey(networkId, contractAddress, definition);
    return (
      this.loadingStates.get(key) || {
        isLoading: false,
        error: null,
        lastLoaded: null,
      }
    );
  }

  /**
   * Subscribe to loading state changes
   */
  subscribe(callback: (state: LoadingState & { requestKey: string }) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Notify subscribers of state changes
   */
  private notify(requestKey: string, state: LoadingState): void {
    this.loadingStates.set(requestKey, state);
    this.callbacks.forEach((callback) => callback({ ...state, requestKey }));
  }

  /**
   * Load contract definition with automatic deduplication
   * Returns true if load was initiated, false if skipped
   */
  async loadContractDefinition(
    request: ContractDefinitionRequest,
    onSuccess: (result: ContractLoadResult, formValues: FormValues) => void
  ): Promise<boolean> {
    const { runtime, formValues, networkId, contractAddress } = request;
    const definitionStr =
      typeof formValues.contractDefinition === 'string' ? formValues.contractDefinition : undefined;
    const requestKey = this.getRequestKey(networkId, contractAddress, definitionStr);
    const currentState = this.getLoadingState(networkId, contractAddress, definitionStr);

    // Skip if already loading
    if (currentState.isLoading) {
      logger.info(
        'ContractDefinitionService',
        `Already loading ${contractAddress} on ${networkId}`
      );
      return false;
    }

    // Skip if we've already loaded this exact configuration
    if (currentState.lastLoaded === requestKey) {
      logger.info('ContractDefinitionService', `Already loaded ${contractAddress} on ${networkId}`);
      return false;
    }

    // Start loading
    this.notify(requestKey, {
      isLoading: true,
      error: null,
      lastLoaded: currentState.lastLoaded,
    });

    try {
      logger.info('ContractDefinitionService', `Loading ${contractAddress} on ${networkId}`);

      // A definition remembered for this address stands in for the explorer round-trip.
      // It is only consulted when the form carries no definition of its own, so a pasted
      // ABI always wins over the stored one.
      const remembered = definitionStr ? undefined : await this.recall(networkId, contractAddress);
      const valuesToLoad = remembered
        ? { ...formValues, contractDefinition: remembered.definition }
        : formValues;

      const loaded = await loadContractDefinitionWithMetadata(runtime, valuesToLoad);
      // Loading a remembered definition makes it look manual; keep its original provenance.
      const result = remembered ? { ...loaded, source: remembered.source } : loaded;

      void this.remember(networkId, contractAddress, result, definitionStr);

      // Success
      this.notify(requestKey, {
        isLoading: false,
        error: null,
        lastLoaded: requestKey,
      });

      onSuccess(result, valuesToLoad);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Error
      this.notify(requestKey, {
        isLoading: false,
        error: err,
        lastLoaded: currentState.lastLoaded,
      });

      throw err;
    }
  }

  /**
   * Look up a remembered definition. IndexedDB can be absent or blocked (private windows,
   * cleared site data), and that must degrade to a normal explorer load, not an error.
   */
  private async recall(
    networkId: string,
    contractAddress: string
  ): Promise<StoredContractDefinition | undefined> {
    try {
      return await contractDefinitionStore.getFor(networkId, contractAddress);
    } catch (error) {
      logger.warn('ContractDefinitionService', 'Failed to read remembered definition:', error);
      return undefined;
    }
  }

  /**
   * Store the definition this load ended up using, so the next UI for the same address
   * starts from it. Failures here are not worth failing a successful load over.
   */
  private async remember(
    networkId: string,
    contractAddress: string,
    result: ContractLoadResult,
    pastedDefinition?: string
  ): Promise<void> {
    const definition = result.contractDefinitionOriginal ?? pastedDefinition;
    if (!definition) return;

    try {
      await contractDefinitionStore.remember({
        networkId,
        address: contractAddress,
        definition,
        source: result.source,
        contractName: result.metadata?.contractName ?? result.schema.name,
      });
    } catch (error) {
      logger.warn('ContractDefinitionService', 'Failed to remember contract definition:', error);
    }
  }

  /**
   * Reset loading state for a specific contract (useful when switching configurations)
   */
  reset(networkId?: string, contractAddress?: string): void {
    if (networkId && contractAddress) {
      const key = this.getRequestKey(networkId, contractAddress);
      this.loadingStates.delete(key);
      this.notify(key, {
        isLoading: false,
        error: null,
        lastLoaded: null,
      });
    } else {
      // Reset all
      this.loadingStates.clear();
    }
  }

  /**
   * Check if any contract is currently loading
   */
  get isAnyLoading(): boolean {
    return Array.from(this.loadingStates.values()).some((state) => state.isLoading);
  }
}

// Export singleton instance
export const contractDefinitionService = new ContractDefinitionService();
