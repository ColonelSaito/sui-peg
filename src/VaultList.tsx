import { useSuiClientQuery } from "@mysten/dapp-kit";
import { Container, Flex, Text, Card } from "@radix-ui/themes";
import { TESTNET_VAULT_REGISTRY_ID } from "./constants";
import { DynamicFieldInfo } from "@mysten/sui/client";

export function VaultList() {
  // First, query the registry object itself
  const { data: registryData, isPending: isRegistryPending, error: registryError } = useSuiClientQuery(
    'getObject',
    {
      id: TESTNET_VAULT_REGISTRY_ID,
      options: {
        showContent: true,
        showType: true
      }
    }
  );

  // Then query for vault collections
  const { data: vaultCollectionsData, isPending: isVaultsPending, error: vaultsError } = useSuiClientQuery(
    'getDynamicFields',
    {
      parentId: TESTNET_VAULT_REGISTRY_ID,
    }
  );

  // Finally, get the actual vault objects
  const vaultIds = vaultCollectionsData?.data?.map((field: DynamicFieldInfo) => field.objectId) || [];
  const shouldFetchVaultObjects = vaultIds.length > 0;

  const { 
    data: vaultObjectsData, 
    isPending: isVaultObjectsPending,
    error: vaultObjectsError 
  } = useSuiClientQuery(
    'multiGetObjects',
    {
      ids: vaultIds,
      options: {
        showContent: true,
        showType: true
      }
    },
    {
      enabled: shouldFetchVaultObjects
    }
  );

  // Only consider vault objects loading if we actually need to fetch them
  const isLoading = isRegistryPending || isVaultsPending || (shouldFetchVaultObjects && isVaultObjectsPending);
  const error = registryError || vaultsError || vaultObjectsError;

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
        <Text>Loading vaults...</Text>
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
        
        <Flex direction="column" gap="3">
          {vaultObjectsData?.map((vault) => {
            const content = vault.data?.content as any;
            const status = content?.expiry_ms > Date.now() ? 'Active' : 'Expired';
            const statusColor = status === 'Active' ? 'green' : 'red';

            return (
              <Card key={vault.data?.objectId}>
                <Flex direction="column" gap="2">
                  <Flex justify="between" align="center">
                    <Text weight="bold">Vault Collection ID: {vault.data?.objectId}</Text>
                    <Text size="2" color={statusColor}>{status}</Text>
                  </Flex>
                  <Text size="2">Type: {vault.data?.type}</Text>
                  {content && (
                    <>
                      <Text size="2">Pegged Coin Type: {content.pegged_coin_type}</Text>
                      <Text size="2">Underlying Coin Type: {content.underlying_coin_type}</Text>
                      <Text size="2">Expiry: {new Date(Number(content.expiry_ms)).toLocaleString()}</Text>
                      <Text size="2">Total DS: {content.total_ds}</Text>
                    </>
                  )}
                </Flex>
              </Card>
            );
          })}
        </Flex>
      </Flex>
    </Container>
  );
} 