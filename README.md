# 🌀 Depeg Swap Protocol on Sui

**Depeg Swap** is a fixed-yield, dual-asset vault system designed for the Sui blockchain. it allows underwriter to deposits their underlying and pegged token (i.e. $wBTC and $LBTC) to the vault and mints depeg token (wBTC-depeg token). And Hedger could purchase the depeg token (wBTC-depeg token) to hedge their pegged tokens positions (i.e. $LBTC). 

1. when there is depeg events, hedger could redeem underlying token (i.e. $wBTC) with their pegged token (i.e. $LBTC) and depeg token (i.e. wBTC-depeg token)
2. when there is no depeg events upon maturity, underwriter could claim underlying tokens from the vault (i.e. $wBTC and $LBTC)


---

## 📦 Modules Overview

### 1. `depeg_swap::vault`

This module handles the core logic of vault creation, token minting, and redemption.

#### ✅ Key Functions

##### `init(witness: VAULT, ctx: &mut TxContext)`
- Initializes the `VAULT` token type and sets up the treasury.
- Mints the DS (Depeg Swap) token and shares the treasury on-chain.

##### `create_vault<P, U>(...)`
- Mints DS tokens backed by equal amounts of a pegged asset and an underlying asset.

##### `redeem_depeg_swap(...)`
- Allows users to redeem DS tokens **before expiry**.
- Burns DS tokens and returns the underlying asset in exchange for the pegged tokens.

##### `redeem_underlying(...)`
- Allows **underwriters** to claim both underlying and pegged assets **after expiry**.


### 2. `depeg_swap::registry`

Manages a global registry of all created vaults.

#### ✅ Key Functions

##### `init(_: REGISTRY, ctx: &mut TxContext)`
- Initializes and shares the `VaultRegistry` object.

##### `create_vault_collection<P, U>(...)`
- A wrapper around `vault::create_vault`.
- Registers the new vault ID into the global registry.
- Transfers minted DS coins and underwriter caps to the sender.

##### `list_vaults(reg: &VaultRegistry): &vector<ID>`
- Returns the list of all created vault IDs.

---

## 🛠 Data Structures

### `Vault<P, U>`
- Stores paired assets (`pegged`, `underlying`), expiry, and DS token total.

### `VaultTreasury`
- Stores the treasury capability for minting and burning DS tokens.

### `UnderwriterCap`
- A capability object granting permission to call `redeem_underlying`.

### `VaultRegistry`
- A shared object tracking all vault IDs.

---

## 👨‍💻 Author

Built by Sui Peg — Soon on Sui.

