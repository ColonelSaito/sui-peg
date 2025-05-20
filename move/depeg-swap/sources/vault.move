module depeg_swap::vault {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::types;

    // Error codes
    const E_EXPIRED: u64 = 0;
    const E_BAD_INPUT: u64 = 1;
    const E_INSUFFICIENT_VAULT_DS_SUPPLY: u64 = 2;
    const E_BAD_WITNESS: u64 = 3;

    const DEPEG_SWAP_CONVERSION_RATE: u64 = 100;

    // Vault witness for initialization
    public struct VAULT has drop {}

    // The underwriter cap is no longer tied to a specific token type
    public struct UnderwriterCap has key, store { 
        id: UID,
    }

    // Store the treasury cap
    public struct VaultTreasury has key {
        id: UID,
        cap: TreasuryCap<VAULT>
    }

    // Event Types
    public struct VaultCreatedEvent has copy, drop {
        vault_id: ID,
        expiry: u64,
        ds_token_id: ID,
    }

    public struct DepegSwapRedeemedEvent has copy, drop {
        redeemer: address,
        vault_id: ID,
        burned_ds_amount: u64,
        returned_pegged_value: u64,
        claimed_underlying_value: u64,
    }

    public struct UnderlyingRedeemedEvent has copy, drop {
        redeemer: address,
        vault_id: ID,
        redeemed_underlying_value: u64,
        redeemed_pegged_value: u64,
    }

    // Vault structure
    #[allow(lint(coin_field))]
    public struct Vault<phantom P: store, phantom U: store> has key, store {
        id: UID,
        pegged_vault: Coin<P>,    
        underlying_vault: Coin<U>, 
        total_ds: u64,             
        expiry: u64,               
    }

    fun init(witness: VAULT, ctx: &mut TxContext) {
        assert!(types::is_one_time_witness(&witness), E_BAD_WITNESS);
        
        // Create the currency
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            9,
            b"DS",
            b"Depeg Swap",
            b"Depeg Swap is a fixed-yield depeg swap on Sui.",
            option::none(),
            ctx
        );

        // Create and share the treasury
        let treasury = VaultTreasury {
            id: object::new(ctx),
            cap: treasury_cap
        };
        transfer::share_object(treasury);

        // Freeze the metadata, technially should be updateable for "create_vault"
        transfer::public_freeze_object(metadata);

        // Create and transfer the underwriter cap
        let underwriter_cap = UnderwriterCap { 
            id: object::new(ctx),
        };
        transfer::transfer(underwriter_cap, tx_context::sender(ctx));
    }

    // Create a new vault
    public(package) fun create_vault<P: store, U: store>(
        cap: &UnderwriterCap,
        treasury: &mut VaultTreasury,
        pegged: Coin<P>,
        underlying: Coin<U>,
        expiry: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): (Coin<VAULT>, Vault<P, U>) {
        // Verify the underwriter cap
        let _ = cap;
        
        let pegged_value = coin::value(&pegged);
        let underlying_value = coin::value(&underlying);
        assert!(pegged_value == underlying_value, E_BAD_INPUT);
        assert!(pegged_value > 0, E_BAD_INPUT);

        // Ensure expiry is in the future
        assert!(expiry > clock::timestamp_ms(clock), E_EXPIRED);

        let total_ds = pegged_value * DEPEG_SWAP_CONVERSION_RATE;
        
        // Mint the tokens for this vault
        let depeg_swap_coins = coin::mint<VAULT>(&mut treasury.cap, total_ds, ctx);
        
        // Get the token ID for the event
        let ds_token_id = object::id(&depeg_swap_coins);

        // Create the vault
        let vault = Vault {
            id: object::new(ctx),
            pegged_vault: pegged,
            underlying_vault: underlying,
            total_ds,
            expiry,
        };
        let vault_id = object::id(&vault);

        event::emit(VaultCreatedEvent { 
            vault_id,
            expiry,
            ds_token_id,
        });

        (depeg_swap_coins, vault)
    }

    // Redeem Depeg Swap tokens
    public fun redeem_depeg_swap<P: store, U: store>(
        vault: &mut Vault<P, U>,
        treasury: &mut VaultTreasury,
        ds_coins_to_redeem: &mut Coin<VAULT>,
        pegged_tokens_to_return: &mut Coin<P>,
        clock: &Clock,
        ctx: &mut TxContext
    ): Coin<U> { 
        assert!(clock::timestamp_ms(clock) < vault.expiry, E_EXPIRED);

        let ds_value_to_redeem = coin::value(ds_coins_to_redeem);
        assert!(ds_value_to_redeem > 0, E_BAD_INPUT);
        assert!(ds_value_to_redeem % DEPEG_SWAP_CONVERSION_RATE == 0, E_BAD_INPUT);

        let expected_pegged_and_underlying_value = ds_value_to_redeem / DEPEG_SWAP_CONVERSION_RATE;
        let provided_pegged_value = coin::value(pegged_tokens_to_return);
        assert!(provided_pegged_value == expected_pegged_and_underlying_value, E_BAD_INPUT);
        assert!(ds_value_to_redeem <= vault.total_ds, E_INSUFFICIENT_VAULT_DS_SUPPLY);

        let underlying_coins_for_user_claim = coin::take(
            coin::balance_mut(&mut vault.underlying_vault), 
            provided_pegged_value, 
            ctx
        );

        let pegged_tokens_taken = coin::take(
            coin::balance_mut(pegged_tokens_to_return), 
            provided_pegged_value, 
            ctx
        );

        let ds_tokens_taken = coin::take(
            coin::balance_mut(ds_coins_to_redeem), 
            ds_value_to_redeem, 
            ctx
        );

        coin::burn(&mut treasury.cap, ds_tokens_taken);
        coin::join(&mut vault.pegged_vault, pegged_tokens_taken);
        vault.total_ds = vault.total_ds - ds_value_to_redeem;

        event::emit(DepegSwapRedeemedEvent {
            redeemer: tx_context::sender(ctx),
            vault_id: object::id(vault), 
            burned_ds_amount: ds_value_to_redeem,
            returned_pegged_value: provided_pegged_value,
            claimed_underlying_value: expected_pegged_and_underlying_value,
        });

        underlying_coins_for_user_claim
    }

    // Underwriter claims remaining tokens after expiry
    public fun redeem_underlying<P: store, U: store>( 
        vault: &mut Vault<P, U>,
        cap: &UnderwriterCap,
        clock: &Clock,
        ctx: &mut TxContext
    ): (Coin<U>, Coin<P>) {
        let _ = cap;
        assert!(clock::timestamp_ms(clock) >= vault.expiry, E_EXPIRED);

        let pegged_value = coin::value(&vault.pegged_vault);
        let underlying_value = coin::value(&vault.underlying_vault);
        assert!(pegged_value > 0 && underlying_value > 0, E_BAD_INPUT);
                
        let pegged_tokens_for_underwriter = coin::take(
            coin::balance_mut(&mut vault.pegged_vault), 
            pegged_value, 
            ctx
        );
        let underlying_tokens_for_underwriter = coin::take(
            coin::balance_mut(&mut vault.underlying_vault), 
            underlying_value, 
            ctx
        );
        
        event::emit(UnderlyingRedeemedEvent {
            redeemer: tx_context::sender(ctx),
            vault_id: object::id(vault),
            redeemed_underlying_value: underlying_value,
            redeemed_pegged_value: pegged_value,
        });
        
        (underlying_tokens_for_underwriter, pegged_tokens_for_underwriter)
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(VAULT {}, ctx)
    }
} 