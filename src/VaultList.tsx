import { useSuiClientQuery, useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { Container, Flex, Text, Card, Button } from "@radix-ui/themes";
import { TESTNET_VAULT_REGISTRY_ID } from "./constants";
import { SuiObjectResponse } from "@mysten/sui/client";
import ClipLoader from "react-spinners/ClipLoader";
import { Transaction } from "@mysten/sui/transactions";
import { useNetworkVariable } from "./networkConfig";
import toast from 'react-hot-toast';

function formatBalance(balance: string | number, decimals: number = 9): string {
  const value = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  const paddedFractional = fractionalPart.toString().padStart(decimals, '0');
  return `${integerPart}.${paddedFractional}`;
}

export function VaultList() {
  const currentAccount = useCurrentAccount();
  const depegSwapPackageId = useNetworkVariable("depegSwapPackageId");
  const {
    mutate: signAndExecute,
    isPending: isTransactionPending,
  } = useSignAndExecuteTransaction();

  // Query for UnderwriterCap objects owned by the current user
  const { data: underwriterCaps } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: currentAccount?.address || '',
      filter: {
        MatchAll: [
          {
            StructType: `${depegSwapPackageId}::vault::UnderwriterCap`
          }
        ]
      },
      options: {
        showType: true,
        showContent: true,
        showOwner: true
      }
    },
    {
      enabled: !!currentAccount?.address
    }
  );

  // First, query the registry object to get its content
  const { data: registryData, isPending: isRegistryPending, error: registryError } = useSuiClientQuery(
    'getObject',
    {
      id: TESTNET_VAULT_REGISTRY_ID,
      options: {
        showContent: true,
        showType: true,
        showOwner: true
      }
    }
  );

  // Get vault IDs directly from the registry's vaults vector
  const registryContent = registryData?.data?.content as any;
  const vaultIds = registryContent?.fields?.vaults || [];
  const shouldFetchVaults = vaultIds.length > 0;

  // Query the actual vault objects
  const { data: vaultObjectsData, isPending: isVaultsPending, error: vaultsError } = useSuiClientQuery(
    'multiGetObjects',
    {
      ids: vaultIds,
      options: {
        showContent: true,
        showType: true,
        showOwner: true
      }
    },
    {
      enabled: shouldFetchVaults
    }
  );

  const isLoading = isRegistryPending || (shouldFetchVaults && isVaultsPending);
  const error = registryError || vaultsError;

  const handleRedeemUnderlying = async (vault: SuiObjectResponse) => {
    if (!underwriterCaps?.data?.[0]?.data?.objectId) {
      alert("You don't have the UnderwriterCap required to redeem underlying coins!");
      return;
    }

    if (!currentAccount?.address) {
      alert("You don't have an account!");
      return;
    }

    if (!vault.data?.type || !vault.data?.objectId) {
      alert("Invalid vault data!");
      return;
    }

    const vaultContent = vault.data?.content as unknown as {
      dataType: "moveObject",
      fields: {
        pegged_vault: {
          type: string;
        };
        underlying_vault: {
          type: string;
        };
      };
    };
    
    if (!vaultContent?.fields) {
      alert("Invalid vault data!");
      return;
    }

    // Extract pegged and underlying coin types from the vault fields
    const peggedType = vaultContent.fields.pegged_vault.type.match(/Coin<(.+)>/)?.[1];
    const underlyingType = vaultContent.fields.underlying_vault.type.match(/Coin<(.+)>/)?.[1];

    if (!peggedType || !underlyingType) {
      alert("Could not extract coin types from vault!");
      return;
    }

    console.log('Transaction input', {
      vaultId: vault.data.objectId,
      underwriterCapId: underwriterCaps.data[0].data.objectId,
      clockId: "0x6"
    })

    const tx = new Transaction();
    
    try {
      const [underlyingCoin, peggedCoin] = tx.moveCall({
        target: `${depegSwapPackageId}::vault::redeem_underlying`,
        typeArguments: [peggedType, underlyingType],
        arguments: [
          tx.object(vault.data.objectId),
          tx.object(underwriterCaps.data[0].data.objectId),
          tx.object("0x6"),
        ],
      });

      tx.transferObjects(
        [underlyingCoin, peggedCoin],
        currentAccount.address
      );

      signAndExecute({
        transaction: tx,
      }, {
        onSuccess: (result) => {
          console.log("Successfully redeemed underlying coins:", result);
          toast.success(
            <div>
              <div>Successfully redeemed underlying coins!</div>
              <a 
                href={`https://suivision.xyz/txblock/${result.digest}?network=testnet`} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#0066cc', textDecoration: 'underline' }}
              >
                View transaction
              </a>
            </div>,
            {
              duration: 5000,
              style: {
                borderRadius: '10px',
                background: '#333',
                color: '#fff',
              },
            }
          );
        },
        onError: (error) => {
          console.error("Failed to redeem underlying coins:", error);
          toast.error(`Failed to redeem underlying coins: ${error instanceof Error ? error.message : 'Unknown error'}`, {
            duration: 5000,
            style: {
              borderRadius: '10px',
              background: '#333',
              color: '#fff',
            },
          });
        }
      });
    } catch (error) {
      console.error("Error executing transaction:", error);
      toast.error(`Error executing transaction: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        duration: 5000,
        style: {
          borderRadius: '10px',
          background: '#333',
          color: '#fff',
        },
      });
    }
  };

  if (error) {
    return (
      <Container>
        <Card style={{ backgroundColor: 'var(--red-2)' }}>
          <Text color="red">Error loading vaults: {error.message}</Text>
        </Card>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container>
        <Flex align="center" gap="2">
          <ClipLoader size={20} />
          <Text>Loading vaults...</Text>
        </Flex>
      </Container>
    );
  }

  if (!vaultIds.length) {
    return (
      <Container>
        <Text>No vaults found. Create one to get started!</Text>
      </Container>
    );
  }

  return (
    <Container>
      <Flex direction="column" gap="3">
        <Text size="5">Created Vaults</Text>

        {registryData && (
          <Card>
            <Flex direction="column" gap="2">
              <Text size="2">Registry ID: {TESTNET_VAULT_REGISTRY_ID}</Text>
              <Text size="2">Type: {registryData.data?.type}</Text>
            </Flex>
          </Card>
        )}
        
        {vaultObjectsData && vaultObjectsData.length > 0 && (
          <Flex direction="column" gap="3">
            <Text size="3" weight="bold">Vaults</Text>
            {vaultObjectsData.map((vault: SuiObjectResponse) => {
              const content = vault.data?.content as any;
              const fields = content?.fields || {};
              const status = Number(fields.expiry) > Date.now() ? 'Active' : 'Expired';
              const statusColor = status === 'Active' ? 'green' : 'red';

              // Extract coin balances
              const peggedVault = fields.pegged_vault?.fields;
              const underlyingVault = fields.underlying_vault?.fields;
              
              // Get coin types from the vault fields
              const peggedType = peggedVault?.type?.match(/Coin<(.+)>/)?.[1]?.split('::').pop() || 'Unknown';
              const underlyingType = underlyingVault?.type?.match(/Coin<(.+)>/)?.[1]?.split('::').pop() || 'Unknown';

              return (
                <Card key={vault.data?.objectId}>
                  <Flex direction="column" gap="2">
                    <Flex justify="between" align="center">
                      <Text weight="bold">Vault ID: {vault.data?.objectId}</Text>
                      <Text size="2" color={statusColor}>{status}</Text>
                    </Flex>
                    <Text size="2">Type: {vault.data?.type}</Text>
                    {fields && (
                      <>
                        <Text size="2">Total DS: {formatBalance(fields.total_ds)}</Text>
                        <Text size="2">Expiry: {new Date(Number(fields.expiry)).toLocaleString()}</Text>
                        
                        <Flex direction="column" gap="1" mt="2">
                          <Text size="2" weight="bold">Vault Contents:</Text>
                          <Flex direction="column" style={{ backgroundColor: 'var(--gray-3)', padding: '8px', borderRadius: '4px' }}>
                            <Text size="2">
                              Pegged Coin ({peggedType}): {formatBalance(peggedVault?.balance || '0')}
                            </Text>
                            <Text size="2">
                              Underlying Coin ({underlyingType}): {formatBalance(underlyingVault?.balance || '0')}
                            </Text>
                          </Flex>
                        </Flex>

                        {underwriterCaps?.data && underwriterCaps.data.length > 0 && (
                          <Button 
                            onClick={() => handleRedeemUnderlying(vault)}
                            disabled={isTransactionPending}
                            color="red"
                            mt="2"
                            style={{ 
                              cursor: isTransactionPending ? 'default' : 'pointer'
                            }}
                          >
                            {isTransactionPending ? <ClipLoader size={16} /> : 'Redeem as Underwriter'}
                          </Button>
                        )}
                      </>
                    )}
                  </Flex>
                </Card>
              );
            })}
          </Flex>
        )}
      </Flex>
    </Container>
  );
} 