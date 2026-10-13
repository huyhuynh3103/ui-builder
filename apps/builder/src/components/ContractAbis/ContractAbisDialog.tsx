import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@openzeppelin/ui-components';

import { useAllNetworks } from '../../hooks/useAllNetworks';
import {
  contractDefinitionStore,
  useStoredContractDefinitions,
} from '../../storage/contractDefinitionStore';

interface ContractAbisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lists the contract definitions remembered per address, and lets the user drop one
 * when a contract has been redeployed or its ABI changed.
 */
export function ContractAbisDialog({ open, onOpenChange }: ContractAbisDialogProps) {
  const records = useStoredContractDefinitions();
  const { networks } = useAllNetworks();

  const networkName = (networkId: string) =>
    networks.find((n) => n.id === networkId)?.name ?? networkId;

  const forget = async (networkId: string, address: string) => {
    try {
      await contractDefinitionStore.forget(networkId, address);
    } catch (error) {
      toast.error(`Failed to remove ABI: ${error instanceof Error ? error.message : error}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Contract ABIs</DialogTitle>
          <DialogDescription>
            Definitions kept per contract address. A known address loads without going back to the
            explorer. Remove one to force a fresh fetch.
          </DialogDescription>
        </DialogHeader>

        {!records?.length ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No contract ABIs stored yet.
          </p>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {records.map(({ key, value, updatedAt }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">{value.contractName || 'Unnamed contract'}</span>
                    <span className="text-muted-foreground text-xs">
                      {networkName(value.networkId)} · {value.source}
                    </span>
                  </div>
                  {/* Addresses are shown in full: a truncated one cannot be checked against a block explorer. */}
                  <p className="font-mono text-xs break-all">{value.address}</p>
                  <p className="text-muted-foreground text-xs">
                    Updated {updatedAt.toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ABI for ${value.address}`}
                  onClick={() => void forget(value.networkId, value.address)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
