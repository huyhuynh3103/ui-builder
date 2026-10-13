import { describe, expect, it } from 'vitest';

import type { ContractFunction, FormFieldType } from '@openzeppelin/ui-types';

import { buildArgs } from '../templates/typescript-react-vite/src/components/viewQueryArgs';

function fn(inputs: { name: string; type: string }[]): ContractFunction {
  return {
    id: 'allowance(address,address)',
    name: 'allowance',
    displayName: 'allowance',
    type: 'function',
    stateMutability: 'view',
    modifiesState: false,
    inputs,
    outputs: [],
  } as ContractFunction;
}

function field(name: string, extra: Partial<FormFieldType> = {}): FormFieldType {
  return {
    id: `field-${name}`,
    name,
    label: name,
    type: 'text',
    validation: { required: true },
    ...extra,
  } as FormFieldType;
}

describe('ViewQueryForm buildArgs', () => {
  it('follows ABI order, not the order the fields are shown in', () => {
    const args = buildArgs(
      fn([
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
      ]),
      [field('spender'), field('owner')],
      { owner: '0xowner', spender: '0xspender' }
    );

    expect(args).toEqual(['0xowner', '0xspender']);
  });

  it('takes the fixed value of a hardcoded field', () => {
    const args = buildArgs(
      fn([{ name: 'owner', type: 'address' }]),
      [field('owner', { isHardcoded: true, hardcodedValue: '0xfixed', isHidden: true })],
      { owner: '0xtyped' }
    );

    expect(args).toEqual(['0xfixed']);
  });

  it('falls back to position when an ABI input is unnamed', () => {
    const args = buildArgs(
      fn([
        { name: '', type: 'address' },
        { name: '', type: 'uint256' },
      ]),
      [field('param0'), field('param1')],
      { param0: '0xabc', param1: '42' }
    );

    expect(args).toEqual(['0xabc', '42']);
  });
});
