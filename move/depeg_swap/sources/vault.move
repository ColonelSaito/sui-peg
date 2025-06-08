module depeg_swap::vault {
    use sui::coin::{Self, Coin};
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::balance::{Supply, Balance, create_supply, increase_supply};

    // Error codes
    const E_EXPIRED: u64 = 0;
    const E_BAD_INPUT: u64 = 1;
    const E_INSUFFICIENT_VAULT_DS_SUPPLY: u64 = 2;

    const DEPEG_SWAP_CONVERSION_RATE: u64 = 100;

    // Vault token for the vault (depeg swap)
    public struct DepegSwapToken<phantom P, phantom U> has drop {}

    // The underwriter cap is no longer tied to a specific token type
    public struct UnderwriterCap has key, store { 
        id: object::UID,
    }

    // Event Types
    public struct VaultCreatedEvent has copy, drop {
        vault_id: object::ID,
        expiry: u64,
    }

    public struct DepegSwapRedeemedEvent has copy, drop {
        redeemer: address,
        vault_id: object::ID,
        burned_ds_amount: u64,
        returned_pegged_value: u64,
        claimed_underlying_value: u64,
    }

    public struct UnderlyingRedeemedEvent has copy, drop {
        redeemer: address,
        vault_id: object::ID,
        redeemed_underlying_value: u64,
        redeemed_pegged_value: u64,
    }

    // Vault structure
    #[allow(lint(coin_field))]
    public struct Vault<phantom P, phantom U> has key, store {
        id: object::UID,
        pegged_coin: Balance<P>,    
        underlying_coin: Balance<U>,             
        expiry: u64,         
        depeg_swap_token_supply: Supply<DepegSwapToken<P, U>>,
    }

    public(package) fun create<P, U>(
        pegged: Coin<P>,
        underlying: Coin<U>,
        expiry: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): (Coin<DepegSwapToken<P, U>>, Vault<P, U>, UnderwriterCap) {
        let pegged_value = coin::value(&pegged);
        let underlying_value = coin::value(&underlying);
        assert!(pegged_value == underlying_value, E_BAD_INPUT);
        assert!(pegged_value > 0, E_BAD_INPUT);

        // Ensure expiry is in the future
        assert!(expiry > clock::timestamp_ms(clock), E_EXPIRED);

        // Calculate how much depeg swap tokens to mint based on conversion rate
        let total_ds = pegged_value * DEPEG_SWAP_CONVERSION_RATE;
        
        // Create the supply for depeg swap tokens
        let mut depeg_swap_token_supply = create_supply(DepegSwapToken<P, U> {});
        
        // Mint the depeg swap tokens that will be returned to the user
        let ds_token_balance = increase_supply(&mut depeg_swap_token_supply, total_ds);
        let ds_coins = coin::from_balance(ds_token_balance, ctx);

        // Create the vault with the supply stored
        let vault = Vault {
            id: object::new(ctx),
            pegged_coin: coin::into_balance(pegged),
            underlying_coin: coin::into_balance(underlying),
            expiry,
            depeg_swap_token_supply,
        };

        let vault_id = object::id(&vault);

        // Create the underwriter cap
        let underwriter_cap = UnderwriterCap { 
            id: object::new(ctx),
        };

        event::emit(VaultCreatedEvent {
            vault_id,
            expiry,
        });

        (ds_coins, vault, underwriter_cap)
    }


    // Redeem Depeg Swap tokens
    public fun redeem_depeg_swap<P, U>(
        vault: &mut Vault<P, U>,
        ds_coins_to_redeem: &mut Coin<DepegSwapToken<P, U>>,
        pegged_tokens_to_return: &mut Coin<P>,
        clock: &Clock,
        ctx: &mut TxContext
    ): Coin<U> { 
        assert!(clock::timestamp_ms(clock) < vault.expiry, E_EXPIRED);

        let ds_value_to_redeem = coin::value(ds_coins_to_redeem);
        assert!(ds_value_to_redeem > 0, E_BAD_INPUT);
        assert!(ds_value_to_redeem % DEPEG_SWAP_CONVERSION_RATE == 0, E_BAD_INPUT);

        // Check that provided pegged value is equal to expected pegged and underlying value
        let expected_pegged_and_underlying_value = ds_value_to_redeem / DEPEG_SWAP_CONVERSION_RATE;
        let provided_pegged_value = coin::value(pegged_tokens_to_return);
        assert!(provided_pegged_value == expected_pegged_and_underlying_value, E_BAD_INPUT);

        // Check that the vault has enough underlying coins
        let vault_underlying_value = sui::balance::value(&vault.underlying_coin);
        assert!(expected_pegged_and_underlying_value <= vault_underlying_value, E_INSUFFICIENT_VAULT_DS_SUPPLY);

        let underlying_balance = sui::balance::split(&mut vault.underlying_coin, provided_pegged_value);
        let underlying_coins_for_user_claim = coin::from_balance(underlying_balance, ctx);
        let pegged_tokens_taken = coin::split(pegged_tokens_to_return, provided_pegged_value, ctx);
        
        // Join the returned pegged tokens to vault balance
        sui::balance::join(&mut vault.pegged_coin, coin::into_balance(pegged_tokens_taken));

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
    public fun redeem_underlying<P, U>( 
        vault: &mut Vault<P, U>,
        _cap: &UnderwriterCap,
        clock: &Clock,
        ctx: &mut TxContext
    ): (Coin<U>, Coin<P>) {
        assert!(clock::timestamp_ms(clock) >= vault.expiry, E_EXPIRED);

        let pegged_value = sui::balance::value(&vault.pegged_coin);
        let underlying_value = sui::balance::value(&vault.underlying_coin);
        assert!(pegged_value > 0 || underlying_value > 0, E_BAD_INPUT);
                
        // Extract all remaining balances and convert to coins
        let pegged_balance = sui::balance::split(&mut vault.pegged_coin, pegged_value);
        let underlying_balance = sui::balance::split(&mut vault.underlying_coin, underlying_value);
        
        let pegged_tokens_for_underwriter = coin::from_balance(pegged_balance, ctx);
        let underlying_tokens_for_underwriter = coin::from_balance(underlying_balance, ctx);
        
        event::emit(UnderlyingRedeemedEvent {
            redeemer: tx_context::sender(ctx),
            vault_id: object::id(vault),
            redeemed_underlying_value: underlying_value,
            redeemed_pegged_value: pegged_value,
        });
        
        (underlying_tokens_for_underwriter, pegged_tokens_for_underwriter)
    }
}
