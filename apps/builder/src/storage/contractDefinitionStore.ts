import { createLiveQueryHook, KeyValueStorage } from '@openzeppelin/ui-storage';
import type { KeyValueRecord } from '@openzeppelin/ui-storage';

import { db } from './database';

/**
 * A contract definition (ABI) remembered for one address on one network, so the next
 * UI built against that address does not have to fetch or paste it again.
 */
export interface StoredContractDefinition {
  networkId: string;
  address: string;
  /** The definition exactly as the loader consumed it (ABI JSON for EVM). */
  definition: string;
  source: 'fetched' | 'manual';
  contractName?: string;
}

/** Addresses are case-insensitive on EVM, so the key holds the lowercased form. */
export function contractDefinitionKey(networkId: string, address: string): string {
  return `${networkId}:${address.toLowerCase()}`;
}

class ContractDefinitionStore extends KeyValueStorage<StoredContractDefinition> {
  constructor() {
    super(db, 'contractDefinitions');
  }

  getFor(networkId: string, address: string): Promise<StoredContractDefinition | undefined> {
    return this.get(contractDefinitionKey(networkId, address));
  }

  remember(entry: StoredContractDefinition): Promise<void> {
    return this.set(contractDefinitionKey(entry.networkId, entry.address), entry);
  }

  forget(networkId: string, address: string): Promise<void> {
    return this.delete(contractDefinitionKey(networkId, address));
  }
}

export const contractDefinitionStore = new ContractDefinitionStore();

export type StoredContractDefinitionRecord = KeyValueRecord<StoredContractDefinition>;

/** Live list of every remembered definition, newest first. */
export const useStoredContractDefinitions = createLiveQueryHook<StoredContractDefinitionRecord>(
  db,
  'contractDefinitions',
  (table) => table.orderBy('updatedAt').reverse().toArray()
);
