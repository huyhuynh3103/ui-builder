import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { Button, Card, CardContent } from '@openzeppelin/ui-components';
import { createDefaultFormValues, DynamicFormField } from '@openzeppelin/ui-renderer';
import type {
  ContractSchema,
  FormValues,
  RenderFormSchema,
  TransactionFormCapabilities,
} from '@openzeppelin/ui-types';
import { logger } from '@openzeppelin/ui-utils';

import { buildArgs } from './viewQueryArgs';

interface ViewQueryFormProps {
  schema: RenderFormSchema;
  contractSchema: ContractSchema;
  adapter: TransactionFormCapabilities;
}

/**
 * Form for a read-only contract function.
 *
 * A read call never leaves the node, so this deliberately does not go through
 * TransactionForm: no wallet, no execution config, no confirmation wait. The result
 * replaces the transaction status area.
 *
 * Shared by the builder's preview and by exported apps — the export copies this file
 * verbatim, so it must only import published packages.
 */
export function ViewQueryForm({ schema, contractSchema, adapter }: ViewQueryFormProps) {
  const functionDetails = useMemo(
    () => contractSchema.functions.find((fn) => fn.id === schema.functionId),
    [contractSchema, schema.functionId]
  );

  const methods = useForm<FormValues>({
    mode: schema.validation?.mode || 'onChange',
    defaultValues: createDefaultFormValues(schema.fields, schema.defaultValues),
  });

  const [result, setResult] = useState<string | Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  const contractAddress = schema.contractAddress ?? contractSchema.address;

  if (!functionDetails) {
    return <p className="text-destructive text-sm">Function not found in the contract schema.</p>;
  }

  if (!contractAddress) {
    return <p className="text-destructive text-sm">No contract address to query.</p>;
  }

  const runQuery = async (values: FormValues) => {
    setIsQuerying(true);
    setError(null);
    setResult(null);

    try {
      const args = buildArgs(functionDetails, schema.fields, values);
      const raw = await adapter.queryViewFunction(
        contractAddress,
        functionDetails.id,
        args,
        contractSchema
      );
      setResult(adapter.formatFunctionResult(raw, functionDetails));
    } catch (err) {
      logger.error('ViewQueryForm', 'Query failed:', err);
      setError(err instanceof Error ? err.message : 'The query failed.');
    } finally {
      setIsQuerying(false);
    }
  };

  const visibleFields = schema.fields.filter((field) => !field.isHidden);

  return (
    <FormProvider {...methods}>
      <form onSubmit={(event) => void methods.handleSubmit(runQuery)(event)} className="space-y-4">
        {(schema.title || schema.description) && (
          <div className="space-y-1">
            {schema.title && <h3 className="text-lg font-medium">{schema.title}</h3>}
            {schema.description && (
              <p className="text-muted-foreground text-sm">{schema.description}</p>
            )}
          </div>
        )}

        {visibleFields.map((field) => (
          <DynamicFormField
            key={field.id}
            field={field}
            control={methods.control}
            contractSchema={contractSchema}
          />
        ))}

        <Button type="submit" size="lg" disabled={isQuerying || !methods.formState.isValid}>
          {isQuerying ? 'Querying...' : 'Query'}
        </Button>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {result !== null && (
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground mb-1 text-xs font-medium">Result</p>
              <pre className="font-mono text-sm break-all whitespace-pre-wrap">
                {typeof result === 'string' ? result : stringify(result)}
              </pre>
            </CardContent>
          </Card>
        )}
      </form>
    </FormProvider>
  );
}

/** JSON.stringify throws on the bigints that decoded uint256 values arrive as. */
function stringify(value: Record<string, unknown>): string {
  return JSON.stringify(value, (_key, val) => (typeof val === 'bigint' ? val.toString() : val), 2);
}
