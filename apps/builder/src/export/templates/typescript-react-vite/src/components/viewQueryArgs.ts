import type { ContractFunction, FormFieldType, FormValues } from '@openzeppelin/ui-types';

/**
 * Positional arguments for the call, in ABI order. The form's field order is the user's
 * to rearrange, and a hardcoded field contributes its fixed value without being shown,
 * so neither can be read off the field list directly.
 */
export function buildArgs(
  functionDetails: ContractFunction,
  fields: FormFieldType[],
  values: FormValues
): unknown[] {
  return functionDetails.inputs.map((input, index) => {
    const field =
      fields.find((candidate) => candidate.name === input.name) ??
      (input.name ? undefined : fields[index]);
    if (!field) return values[input.name];
    if (field.isHardcoded) return field.hardcodedValue;
    return values[field.name];
  });
}
