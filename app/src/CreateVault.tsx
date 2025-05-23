import { Transaction } from "@mysten/sui/transactions";
import { Button, Container, Flex, Text, Select, Link } from "@radix-ui/themes";
import {
  useSignAndExecuteTransaction,
  useSuiClient,
  useSuiClientQuery,
  useCurrentAccount,
} from "@mysten/dapp-kit";
import { useNetworkVariable } from "./networkConfig";
import ClipLoader from "react-spinners/ClipLoader";
import { useState, ChangeEvent, useMemo } from "react";
import {
  TESTNET_VAULT_REGISTRY_ID,
  TESTNET_VAULT_TREASURY_ID,
} from "./constants";
import { type CoinStruct } from "@mysten/sui/client";
import toast from "react-hot-toast";

interface CoinOption {
  id: string;
  balance: string;
  type: string;
  decimals: number;
  symbol: string;
  isPegged: boolean;
}

function formatBalance(balance: string, decimals: number): string {
  const value = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  const paddedFractional = fractionalPart.toString().padStart(decimals, "0");
  return `${integerPart}.${paddedFractional}`;
}

function parseInputAmount(amount: string, decimals: number): bigint {
  // Remove any commas
  amount = amount.replace(/,/g, "");

  // Split on decimal point
  const parts = amount.split(".");
  const integerPart = parts[0];
  const fractionalPart = parts[1] || "";

  // Pad or truncate fractional part to match decimals
  const normalizedFractional = fractionalPart
    .padEnd(decimals, "0")
    .slice(0, decimals);

  // Combine integer and fractional parts
  const fullValue = `${integerPart}${normalizedFractional}`;

  // Convert to BigInt, removing any leading zeros
  return BigInt(fullValue.replace(/^0+/, "") || "0");
}

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
    isPending: isTransactionPending,
  } = useSignAndExecuteTransaction();

  const [selectedPeggedCoin, setSelectedPeggedCoin] =
    useState<CoinOption | null>(null);
  const [selectedUnderlyingCoin, setSelectedUnderlyingCoin] =
    useState<CoinOption | null>(null);
  const [expiryHours, setExpiryHours] = useState("24"); // Default 24 hours
  const [peggedAmount, setPeggedAmount] = useState("");
  const [underlyingAmount, setUnderlyingAmount] = useState("");

  // Query for user's coins
  const {
    data: userCoins,
    isPending: isCoinsLoading,
    error: coinsError,
  } = useSuiClientQuery(
    "getAllCoins",
    {
      owner: currentAccount?.address || "",
    },
    {
      enabled: !!currentAccount?.address,
    }
  );

  // Format coins for dropdown with basic information
  const coinOptions: CoinOption[] = useMemo(() => {
    if (!userCoins?.data) return [];

    return userCoins.data.map((coin: CoinStruct) => {
      const symbol = coin.coinType.split("::").pop() || "UNKNOWN";
      const isPegged = coin.coinType.includes("::pegged_coin::");
      return {
        id: coin.coinObjectId,
        balance: coin.balance,
        type: coin.coinType,
        decimals: 9, // Default to 9 decimals for Sui coins
        symbol: symbol,
        isPegged,
      };
    });
  }, [userCoins?.data]);

  // Separate pegged and underlying coins
  const peggedCoins = useMemo(
    () => coinOptions.filter((coin) => coin.type.includes("::pegged_coin::")),
    [coinOptions]
  );

  const underlyingCoins = useMemo(
    () =>
      coinOptions.filter((coin) => coin.type.includes("::underlying_coin::")),
    [coinOptions]
  );

  // Query for the VaultRegistry object directly
  const {
    data: registryData,
    isPending: isRegistryPending,
    error: registryError,
  } = useSuiClientQuery("getObject", {
    id: TESTNET_VAULT_REGISTRY_ID,
    options: { showContent: true },
  });

  // Query for the VaultTreasury object directly
  const {
    data: treasuryData,
    isPending: isTreasuryPending,
    error: treasuryError,
  } = useSuiClientQuery("getObject", {
    id: TESTNET_VAULT_TREASURY_ID,
    options: { showContent: true },
  });

  // System Clock object ID (this is a constant in Sui)
  const CLOCK_ID =
    "0x0000000000000000000000000000000000000000000000000000000000000006";

  async function createVault() {
    if (!currentAccount?.address) {
      console.error("No wallet connected");
      return;
    }

    if (
      !TESTNET_VAULT_REGISTRY_ID ||
      !TESTNET_VAULT_TREASURY_ID ||
      !selectedPeggedCoin ||
      !selectedUnderlyingCoin
    ) {
      console.error("Missing required object IDs or coin selections");
      return;
    }

    // Debug: Log object details
    try {
      const [registry, treasury] = await suiClient.multiGetObjects({
        ids: [TESTNET_VAULT_REGISTRY_ID, TESTNET_VAULT_TREASURY_ID],
        options: { showOwner: true, showContent: true, showType: true },
      });

      console.log("Detailed Object Info:", {
        registry: {
          id: registry.data?.objectId,
          owner: registry.data?.owner,
          type: registry.data?.type,
          version: registry.data?.version,
          digest: registry.data?.digest,
        },
        treasury: {
          id: treasury.data?.objectId,
          owner: treasury.data?.owner,
          type: treasury.data?.type,
          version: treasury.data?.version,
          digest: treasury.data?.digest,
        },
        currentAddress: currentAccount.address,
      });

      // Verify registry and treasury are shared
      const registryOwner = registry.data?.owner as {
        Shared?: { initial_shared_version: number };
      };
      const treasuryOwner = treasury.data?.owner as {
        Shared?: { initial_shared_version: number };
      };

      if (!registryOwner?.Shared) {
        console.error("Registry is not a shared object:", registry.data?.owner);
        return;
      }

      if (!treasuryOwner?.Shared) {
        console.error("Treasury is not a shared object:", treasury.data?.owner);
        return;
      }

      // Verify object types
      if (!registry.data?.type?.includes("::registry::VaultRegistry")) {
        console.error("Invalid Registry type:", registry.data?.type);
        return;
      }

      if (!treasury.data?.type?.includes("::vault::VaultTreasury")) {
        console.error("Invalid Treasury type:", treasury.data?.type);
        return;
      }
    } catch (error) {
      console.error("Error fetching object details:", error);
      return;
    }

    // Convert hours to milliseconds for expiry
    const expiryMs = Date.now() + parseInt(expiryHours) * 60 * 60 * 1000;

    // Convert display amounts to on-chain amounts using decimals
    const peggedAmountOnChain = parseInputAmount(
      peggedAmount,
      selectedPeggedCoin.decimals
    );
    const underlyingAmountOnChain = parseInputAmount(
      underlyingAmount,
      selectedUnderlyingCoin.decimals
    );

    // Verify coin amounts and balances
    if (peggedAmountOnChain !== underlyingAmountOnChain) {
      console.error(`Coin amounts must be equal:
        Pegged: ${peggedAmountOnChain.toString()}
        Underlying: ${underlyingAmountOnChain.toString()}
      `);
      return;
    }

    const peggedBalance = BigInt(selectedPeggedCoin.balance);
    const underlyingBalance = BigInt(selectedUnderlyingCoin.balance);

    if (peggedAmountOnChain > peggedBalance) {
      console.error(`Insufficient pegged coin balance:
        Required: ${peggedAmountOnChain.toString()}
        Available: ${peggedBalance.toString()}
      `);
      return;
    }

    if (underlyingAmountOnChain > underlyingBalance) {
      console.error(`Insufficient underlying coin balance:
        Required: ${underlyingAmountOnChain.toString()}
        Available: ${underlyingBalance.toString()}
      `);
      return;
    }

    // Debug: Log transaction details
    console.log("Transaction Details:", {
      packageId: depegSwapPackageId,
      registryId: TESTNET_VAULT_REGISTRY_ID,
      treasuryId: TESTNET_VAULT_TREASURY_ID,
      peggedCoin: {
        id: selectedPeggedCoin.id,
        type: selectedPeggedCoin.type,
        amount: peggedAmountOnChain.toString(),
        balance: peggedBalance.toString(),
      },
      underlyingCoin: {
        id: selectedUnderlyingCoin.id,
        type: selectedUnderlyingCoin.type,
        amount: underlyingAmountOnChain.toString(),
        balance: underlyingBalance.toString(),
      },
      expiryMs: expiryMs.toString(),
      currentTime: Date.now().toString(),
    });

    const tx = new Transaction();

    // Convert amounts to u64 strings
    const amount = peggedAmountOnChain.toString();

    // Split the pegged coin first
    const [splitPeggedCoin] = tx.splitCoins(tx.object(selectedPeggedCoin.id), [
      tx.pure.u64(amount),
    ]);

    // Split the underlying coin with the exact same amount
    const [splitUnderlyingCoin] = tx.splitCoins(
      tx.object(selectedUnderlyingCoin.id),
      [tx.pure.u64(amount)]
    );

    console.log([selectedPeggedCoin.type, selectedUnderlyingCoin.type]);

    // Create vault with split coins
    tx.moveCall({
      target: `${depegSwapPackageId}::registry::create_vault_collection`,
      typeArguments: [selectedPeggedCoin.type, selectedUnderlyingCoin.type],
      arguments: [
        tx.object(TESTNET_VAULT_REGISTRY_ID),
        tx.object(TESTNET_VAULT_TREASURY_ID),
        splitPeggedCoin,
        splitUnderlyingCoin,
        tx.pure.u64(expiryMs.toString()),
        tx.object("0x6"),
      ],
    });

    // Add debug logging for the transaction
    console.log("Transaction Structure:", {
      amount,
      peggedCoin: {
        id: selectedPeggedCoin.id,
        type: selectedPeggedCoin.type,
        split: splitPeggedCoin,
      },
      underlyingCoin: {
        id: selectedUnderlyingCoin.id,
        type: selectedUnderlyingCoin.type,
        split: splitUnderlyingCoin,
      },
      expiry: expiryMs.toString(),
    });

    signAndExecute(
      {
        transaction: tx,
      },
      {
        onSuccess: async ({ digest }) => {
          console.log("Transaction success:", { digest });
          const { effects } = await suiClient.waitForTransaction({
            digest: digest,
            options: {
              showEffects: true,
            },
          });

          if (effects?.status?.error) {
            console.error("Transaction failed:", effects.status.error);
            toast.error(`Transaction failed: ${effects.status.error}`, {
              duration: 5000,
              style: {
                borderRadius: "10px",
                background: "#333",
                color: "#fff",
              },
            });
            return;
          }

          // The first created object should be our vault
          const vaultId = effects?.created?.[0]?.reference?.objectId;
          if (!vaultId) {
            console.error("No vault created in transaction");
            toast.error("No vault created in transaction", {
              duration: 5000,
              style: {
                borderRadius: "10px",
                background: "#333",
                color: "#fff",
              },
            });
            return;
          }

          toast.success(
            <div>
              <div>Successfully created vault!</div>
              <a
                href={`https://suiscan.xyz/testnet/tx/${digest}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#0066cc", textDecoration: "underline" }}
              >
                View transaction
              </a>
            </div>,
            {
              duration: 5000,
              style: {
                borderRadius: "10px",
                background: "#333",
                color: "#fff",
              },
            }
          );
          onCreated(vaultId);
        },
        onError: (error) => {
          console.error("Transaction error:", error);
          toast.error(
            `Transaction error: ${error instanceof Error ? error.message : "Unknown error"}`,
            {
              duration: 5000,
              style: {
                borderRadius: "10px",
                background: "#333",
                color: "#fff",
              },
            }
          );
        },
      }
    );
  }

  const isLoading = isRegistryPending || isTreasuryPending || isCoinsLoading;
  const errors = [coinsError, registryError, treasuryError].filter(Boolean);
  const isReady =
    registryData && treasuryData && userCoins && coinOptions.length > 0;

  if (errors.length > 0) {
    return (
      <Container>
        <Text color="red">
          Error loading data: {errors.map((e) => e?.message).join(", ")}
        </Text>
      </Container>
    );
  }

  return (
    <Container>
      <Flex direction="column" gap="3">
        <Text size="5">Create New Vault</Text>

        {isLoading ? (
          <Flex align="center" gap="2">
            <ClipLoader size={20} />
            <Text>Loading required objects...</Text>
          </Flex>
        ) : !isReady ? (
          <Text color="red">
            Missing required objects. Make sure:
            {!registryData && <li>The VaultRegistry object is not found</li>}
            {!treasuryData && <li>The VaultTreasury object is not found</li>}
          </Text>
        ) : (
          <>
            <Text size="2" color="gray">
              Found required objects:
            </Text>
            <Text size="2">Registry: {TESTNET_VAULT_REGISTRY_ID}</Text>
            <Text size="2">Treasury: {TESTNET_VAULT_TREASURY_ID}</Text>
          </>
        )}

        <Select.Root
          value={selectedPeggedCoin?.id || ""}
          onValueChange={(value) => {
            const coin = peggedCoins.find((c) => c.id === value);
            setSelectedPeggedCoin(coin || null);
          }}
        >
          <Select.Trigger placeholder="Select Pegged Coin" />
          <Select.Content>
            {peggedCoins.length === 0 ? (
              <Select.Item value="no-coins">
                No pegged coins available
              </Select.Item>
            ) : (
              peggedCoins.map((coin) => (
                <Select.Item key={coin.id} value={coin.id}>
                  {coin.type} (Balance:{" "}
                  {formatBalance(coin.balance, coin.decimals)})
                </Select.Item>
              ))
            )}
          </Select.Content>
        </Select.Root>

        <input
          type="text"
          placeholder={`Pegged Coin Amount (${selectedPeggedCoin?.symbol || ""})`}
          value={peggedAmount}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setPeggedAmount(e.target.value)
          }
          className="rt-TextFieldInput"
        />

        <Select.Root
          value={selectedUnderlyingCoin?.id || ""}
          onValueChange={(value) => {
            const coin = underlyingCoins.find((c) => c.id === value);
            setSelectedUnderlyingCoin(coin || null);
          }}
        >
          <Select.Trigger placeholder="Select Underlying Coin" />
          <Select.Content>
            {underlyingCoins.length === 0 ? (
              <Select.Item value="no-coins">
                No underlying coins available
              </Select.Item>
            ) : (
              underlyingCoins.map((coin) => (
                <Select.Item key={coin.id} value={coin.id}>
                  {coin.type} (Balance:{" "}
                  {formatBalance(coin.balance, coin.decimals)})
                </Select.Item>
              ))
            )}
          </Select.Content>
        </Select.Root>

        <input
          type="text"
          placeholder={`Underlying Coin Amount (${selectedUnderlyingCoin?.symbol || ""})`}
          value={underlyingAmount}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setUnderlyingAmount(e.target.value)
          }
          className="rt-TextFieldInput"
        />

        <input
          type="number"
          placeholder="Expiry Hours"
          value={expiryHours}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setExpiryHours(e.target.value)
          }
          className="rt-TextFieldInput"
        />

        <Button
          onClick={createVault}
          disabled={
            !isReady ||
            isTransactionPending ||
            !selectedPeggedCoin ||
            !selectedUnderlyingCoin ||
            !peggedAmount ||
            !underlyingAmount
          }
          style={{
            cursor:
              !isReady ||
              isTransactionPending ||
              !selectedPeggedCoin ||
              !selectedUnderlyingCoin ||
              !peggedAmount ||
              !underlyingAmount
                ? "default"
                : "pointer",
          }}
        >
          {isTransactionPending ? <ClipLoader size={20} /> : "Create Vault"}
        </Button>
      </Flex>
    </Container>
  );
}
