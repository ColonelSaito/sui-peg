import { Transaction } from "@mysten/sui/transactions";
import { Button, Container, Flex, Text } from "@radix-ui/themes";
import { useSignAndExecuteTransaction, useSuiClient, useSuiClientQuery, useCurrentAccount } from "@mysten/dapp-kit";
import { useNetworkVariable } from "./networkConfig";
import ClipLoader from "react-spinners/ClipLoader";
import { useState, ChangeEvent } from "react";
import { TESTNET_VAULT_REGISTRY_ID, TESTNET_VAULT_TREASURY_ID, TESTNET_UNDERWRITER_CAP } from "./constants";

export function CreateVault({
  onCreated,
}: {
  onCreated: (id: string) => void;
}) {
  const depegSwapPackageId = useNetworkVariable("depegSwapPackageId");
  const suiClient = useSuiClient();
  const currentAccount = useCurrentAccount();
  const {
    mutate: signAndExecute,
    isSuccess,
    isPending,
  } = useSignAndExecuteTransaction();

  const [peggedCoinId, setPeggedCoinId] = useState("");
  const [underlyingCoinId, setUnderlyingCoinId] = useState("");
  const [expiryHours, setExpiryHours] = useState("24"); // Default 24 hours

  // Query for the VaultRegistry object directly
  const { data: registryData, isPending: isRegistryPending } = useSuiClientQuery(
    'getObject',
    {
      id: TESTNET_VAULT_REGISTRY_ID,
      options: { showContent: true }
    }
  );

  // Query for the VaultTreasury object directly
  const { data: treasuryData, isPending: isTreasuryPending } = useSuiClientQuery(
    'getObject',
    {
      id: TESTNET_VAULT_TREASURY_ID,
      options: { showContent: true }
    }
  );

  // Query for the UnderwriterCap directly
  const { data: underwriterCapData, isPending: isCapPending } = useSuiClientQuery(
    'getObject',
    {
      id: TESTNET_UNDERWRITER_CAP,
      options: { showContent: true }
    }
  );

  // System Clock object ID (this is a constant in Sui)
  const CLOCK_ID = "0x0000000000000000000000000000000000000000000000000000000000000006";

  function createVault() {
    if (!TESTNET_VAULT_REGISTRY_ID || !TESTNET_VAULT_TREASURY_ID || !TESTNET_UNDERWRITER_CAP) {
      console.error("Missing required object IDs:", {
        registryId: TESTNET_VAULT_REGISTRY_ID,
        treasuryId: TESTNET_VAULT_TREASURY_ID,
        underwriterCapId: TESTNET_UNDERWRITER_CAP
      });
      return;
    }

    const tx = new Transaction();
    
    // Convert hours to milliseconds for expiry
    const expiryMs = Date.now() + parseInt(expiryHours) * 60 * 60 * 1000;

    tx.moveCall({
      arguments: [
        tx.object(TESTNET_VAULT_REGISTRY_ID),
        tx.object(TESTNET_UNDERWRITER_CAP),
        tx.object(TESTNET_VAULT_TREASURY_ID),
        tx.object(peggedCoinId),
        tx.object(underlyingCoinId),
        tx.pure.u64(expiryMs),
        tx.object(CLOCK_ID),
      ],
      target: `${depegSwapPackageId}::registry::create_vault_collection`,
    });

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async ({ digest }) => {
          const { effects } = await suiClient.waitForTransaction({
            digest: digest,
            options: {
              showEffects: true,
            },
          });

          // The first created object should be our vault
          onCreated(effects?.created?.[0]?.reference?.objectId!);
        },
      },
    );
  }

  const isLoading = isRegistryPending || isTreasuryPending || isCapPending;
  const isReady = registryData && treasuryData && underwriterCapData;

  return (
    <Container>
      <Flex direction="column" gap="3">
        <Text size="5">Create New Vault</Text>
        
        {isLoading ? (
          <Text>Loading required objects...</Text>
        ) : !isReady ? (
          <Text color="red">
            Missing required objects. Make sure:
            {!registryData && <li>The VaultRegistry object is not found</li>}
            {!treasuryData && <li>The VaultTreasury object is not found</li>}
            {!underwriterCapData && <li>The UnderwriterCap is not found</li>}
          </Text>
        ) : (
          <>
            <Text size="2" color="gray">Found required objects:</Text>
            <Text size="2">Registry: {TESTNET_VAULT_REGISTRY_ID}</Text>
            <Text size="2">Treasury: {TESTNET_VAULT_TREASURY_ID}</Text>
            <Text size="2">UnderwriterCap: {TESTNET_UNDERWRITER_CAP}</Text>
          </>
        )}
        
        <input 
          type="text"
          placeholder="Pegged Coin Object ID"
          value={peggedCoinId}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setPeggedCoinId(e.target.value)}
          className="rt-TextFieldInput"
        />

        <input 
          type="text"
          placeholder="Underlying Coin Object ID"
          value={underlyingCoinId}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setUnderlyingCoinId(e.target.value)}
          className="rt-TextFieldInput"
        />

        <input 
          type="number"
          placeholder="Expiry (hours)"
          value={expiryHours}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setExpiryHours(e.target.value)}
          className="rt-TextFieldInput"
        />

        <Button
          size="3"
          onClick={() => createVault()}
          disabled={!isReady || !peggedCoinId || !underlyingCoinId || isSuccess || isPending}
        >
          {isSuccess || isPending ? <ClipLoader size={20} /> : "Create Vault"}
        </Button>
      </Flex>
    </Container>
  );
} 