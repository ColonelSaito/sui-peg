module depeg_swap::registry {
    use sui::clock::{Clock};
    use sui::coin::Coin;
    use depeg_swap::vault::{Self};

    // Registry witness for initialization
    public struct REGISTRY has drop {}

    public struct VaultRegistry has key, store {
        id: UID,
        vaults: vector<ID>,
    }

    fun init(_: REGISTRY, ctx: &mut TxContext) {
        let reg = VaultRegistry { 
            id: object::new(ctx),
            vaults: vector::empty<ID>(),
        };
        transfer::share_object(reg);
    }

    // Create a new vault collection for a specific coin type pair
    #[allow(lint(self_transfer, share_owned))]
    public fun create_vault_collection<P, U>(
        registry: &mut VaultRegistry,
        pegged: Coin<P>,
        underlying: Coin<U>,
        expiry: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): ID {
        // Create the initial vault
        let (ds_coins, vault, underwriter_cap) = vault::create(
            pegged,
            underlying,
            expiry,
            clock,
            ctx
        );

        let vault_id = object::id(&vault);
        vector::push_back(&mut registry.vaults, vault_id);

        // Transfer DS coins to sender
        transfer::public_transfer(ds_coins, tx_context::sender(ctx));
        transfer::public_transfer(underwriter_cap, tx_context::sender(ctx));
        transfer::public_share_object(vault);

        vault_id
    }

    /// Anyone can see the full list of vault IDs.
    public fun list_vaults(reg: &VaultRegistry): &vector<ID> {
        &reg.vaults
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(REGISTRY {}, ctx)
    }
}
