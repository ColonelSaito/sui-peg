module depeg_swap::registry {
    use sui::object_table::{Self, ObjectTable};
    use sui::clock::{Clock};
    use sui::coin::Coin;
    use depeg_swap::vault::{Self, Vault, UnderwriterCap, VaultTreasury};

    // Registry witness for initialization
    public struct REGISTRY has drop {}

    // Error codes
    public struct VaultRegistry has key, store {
        id: UID,
        collections: vector<ID>,
    }

    // A collection for vaults of a specific coin type pair
    public struct VaultCollection<phantom P: store, phantom U: store> has key, store {
        id: UID,
        table: ObjectTable<ID, Vault<P, U>>,
    }

    fun init(_: REGISTRY, ctx: &mut TxContext) {
        let reg = VaultRegistry { 
            id: object::new(ctx),
            collections: vector::empty<ID>(),
        };
        transfer::share_object(reg);
    }

    // Create a new vault collection for a specific coin type pair
    #[allow(lint(self_transfer))]
    public fun create_vault_collection<P: store, U: store>(
        registry: &mut VaultRegistry,
        cap: &UnderwriterCap,
        treasury: &mut VaultTreasury,
        pegged: Coin<P>,
        underlying: Coin<U>,
        expiry: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): ID {
        let mut collection = VaultCollection<P, U> {
            id: object::new(ctx),
            table: object_table::new<ID, Vault<P, U>>(ctx),
        };
        
        let collection_id = object::id(&collection);
        vector::push_back(&mut registry.collections, collection_id);

        // Create the initial vault
        let (ds_coins, vault) = vault::create_vault(
            cap,
            treasury,
            pegged,
            underlying,
            expiry,
            clock,
            ctx
        );

        let vault_id = object::id(&vault);
        object_table::add(&mut collection.table, vault_id, vault);

        // Transfer DS coins to sender
        transfer::public_transfer(ds_coins, tx_context::sender(ctx));
        
        // Share the collection
        transfer::share_object(collection);
        vault_id
    }

    // Add a getter for the collections vector
    public fun get_collections(registry: &VaultRegistry): &vector<ID> {
        &registry.collections
    }

    public fun borrow_mut_vault<P: store, U: store>(
        collection: &mut VaultCollection<P, U>,
        vault_id: ID
    ): &mut Vault<P, U> {
        object_table::borrow_mut(&mut collection.table, vault_id)
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(REGISTRY {}, ctx)
    }
} 