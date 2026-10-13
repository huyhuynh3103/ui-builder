import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContractSchema, FormValues } from '@openzeppelin/ui-types';

import type { BuilderRuntime } from '@/core/runtimeAdapter';

import type { ContractLoadResult } from '../ContractLoader';

const loadWithMetadata = vi.fn();
const getFor = vi.fn();
const remember = vi.fn();

vi.mock('../ContractLoader', () => ({
  loadContractDefinitionWithMetadata: (...args: unknown[]) => loadWithMetadata(...args),
}));

vi.mock('../../storage/contractDefinitionStore', () => ({
  contractDefinitionStore: {
    getFor: (...args: unknown[]) => getFor(...args),
    remember: (...args: unknown[]) => remember(...args),
  },
}));

const { contractDefinitionService } = await import('../ContractDefinitionService');

const ADDRESS = '0x1111111111111111111111111111111111111111';
const STORED_ABI = '[{"type":"function","name":"stored"}]';
const PASTED_ABI = '[{"type":"function","name":"pasted"}]';

function loadResult(overrides: Partial<ContractLoadResult> = {}): ContractLoadResult {
  return {
    schema: { ecosystem: 'evm', name: 'Token', address: ADDRESS, functions: [] } as ContractSchema,
    source: 'fetched',
    contractDefinitionOriginal: STORED_ABI,
    ...overrides,
  };
}

function request(formValues: FormValues, networkId: string) {
  return {
    runtime: {} as BuilderRuntime,
    formValues,
    networkId,
    contractAddress: ADDRESS,
  };
}

describe('ContractDefinitionService definition memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contractDefinitionService.reset();
    loadWithMetadata.mockResolvedValue(loadResult());
    getFor.mockResolvedValue(undefined);
    remember.mockResolvedValue(undefined);
  });

  it('loads a remembered definition instead of hitting the explorer', async () => {
    getFor.mockResolvedValue({
      networkId: 'net-a',
      address: ADDRESS,
      definition: STORED_ABI,
      source: 'fetched',
    });

    const onSuccess = vi.fn();
    await contractDefinitionService.loadContractDefinition(
      request({ contractAddress: ADDRESS }, 'net-a'),
      onSuccess
    );

    expect(loadWithMetadata).toHaveBeenCalledWith(
      {},
      {
        contractAddress: ADDRESS,
        contractDefinition: STORED_ABI,
      }
    );
    // The provenance of the stored definition survives the round-trip.
    expect(onSuccess.mock.calls[0][0].source).toBe('fetched');
  });

  it('prefers a definition pasted into the form over the stored one', async () => {
    const onSuccess = vi.fn();
    await contractDefinitionService.loadContractDefinition(
      request({ contractAddress: ADDRESS, contractDefinition: PASTED_ABI }, 'net-b'),
      onSuccess
    );

    expect(getFor).not.toHaveBeenCalled();
    expect(loadWithMetadata).toHaveBeenCalledWith(
      {},
      {
        contractAddress: ADDRESS,
        contractDefinition: PASTED_ABI,
      }
    );
  });

  it('remembers the definition a successful load used', async () => {
    await contractDefinitionService.loadContractDefinition(
      request({ contractAddress: ADDRESS }, 'net-c'),
      vi.fn()
    );

    expect(remember).toHaveBeenCalledWith({
      networkId: 'net-c',
      address: ADDRESS,
      definition: STORED_ABI,
      source: 'fetched',
      contractName: 'Token',
    });
  });

  it('keeps a load successful when remembering fails', async () => {
    remember.mockRejectedValue(new Error('quota exceeded'));

    const onSuccess = vi.fn();
    await expect(
      contractDefinitionService.loadContractDefinition(
        request({ contractAddress: ADDRESS }, 'net-d'),
        onSuccess
      )
    ).resolves.toBe(true);
    expect(onSuccess).toHaveBeenCalled();
  });
});
