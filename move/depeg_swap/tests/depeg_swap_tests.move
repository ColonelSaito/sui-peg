#[test_only]
module depeg_swap::depeg_swap_tests {
    use sui::test_scenario::{Self, Scenario};
    use sui::coin::{Self, Coin};
    use sui::clock::{Self, Clock};
    use sui::test_utils::{assert_eq, destroy};
    use sui::test_scenario::ctx;
    
    use depeg_swap::vault::{Self, VAULT, UnderwriterCap, VaultTreasury};
    use depeg_swap::registry::{Self, VaultRegistry};
    use depeg_swap::vault::Vault;
    
    public struct PEGGED has store {}
    public struct UNDERLYING has store {}

    const ADMIN: address = @0x1;
    const USER: address = @0x2;
    
   
    fun setup_test(): Scenario {
        let mut scenario = test_scenario::begin(ADMIN);
        let amount = 1_000_000_000;
        
        {
            let ctx = test_scenario::ctx(&mut scenario);
            let pegged_coins = coin::mint_for_testing<PEGGED>(amount, ctx);
            transfer::public_transfer(pegged_coins, ADMIN);

            let user_pegged_coins = coin::mint_for_testing<PEGGED>(amount, ctx);
            transfer::public_transfer(user_pegged_coins, USER);

            let underlying_coins = coin::mint_for_testing<UNDERLYING>(amount, ctx);
            transfer::public_transfer(underlying_coins, ADMIN)
        }; 
        
        scenario
    }
    
    fun setup_clock(scenario: &mut Scenario): Clock {
        let ctx = test_scenario::ctx(scenario);
        clock::create_for_testing(ctx)
    }
    
    #[test]
    fun test_create_vault_collection() {
        let mut scenario = setup_test();
        let clock = setup_clock(&mut scenario);

        let depeg_swap_conversion_rate = 100; // Matches vault::DEPEG_SWAP_CONVERSION_RATE
        let expiry_offset_ms = 3_600_000; // 1 hour in milliseconds
        
        {
            vault::init_for_testing(ctx(&mut scenario));
            registry::init_for_testing(ctx(&mut scenario));
        };
        
        test_scenario::next_tx(&mut scenario, ADMIN);


        let mut vault_registry = test_scenario::take_shared<VaultRegistry>(&scenario);
        let mut treasury = test_scenario::take_shared<VaultTreasury>(&scenario);
        
        {
            let pegged_coins = test_scenario::take_from_sender<Coin<PEGGED>>(&scenario);
            let underlying_coins = test_scenario::take_from_sender<Coin<UNDERLYING>>(&scenario);
            
            let actual_pegged_value = coin::value(&pegged_coins);
            let expected_ds_minted = actual_pegged_value * depeg_swap_conversion_rate;

            let current_time_ms = clock::timestamp_ms(&clock);
            let expiry_time_ms = current_time_ms + expiry_offset_ms;

            registry::create_vault_collection<PEGGED, UNDERLYING>(
                &mut vault_registry,
                &mut treasury,
                pegged_coins,
                underlying_coins,
                expiry_time_ms,
                &clock,
                ctx(&mut scenario)
            );

            // Advance tx to complete transfers 
            test_scenario::next_tx(&mut scenario, ADMIN);

            let ds_coins = test_scenario::take_from_sender<Coin<VAULT>>(&scenario);
            let ds_coins_value = coin::value(&ds_coins);
            assert_eq(ds_coins_value, expected_ds_minted);

            transfer::public_transfer(ds_coins, ADMIN);
        };
        
        test_scenario::return_shared(vault_registry);
        test_scenario::return_shared(treasury);
        
        destroy(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_redeem_depeg_swap() {
        let mut scenario = setup_test();
        let clock = setup_clock(&mut scenario);

        let expiry_offset_ms = 3_600_000;
        
        {
            vault::init_for_testing(ctx(&mut scenario));
            registry::init_for_testing(ctx(&mut scenario));
        };
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        
        let mut vault_registry = test_scenario::take_shared<VaultRegistry>(&scenario);
        let mut treasury = test_scenario::take_shared<VaultTreasury>(&scenario);
        
        let vault_id: ID;
        {
            let pegged_coins = test_scenario::take_from_sender<Coin<PEGGED>>(&scenario);
            let underlying_coins = test_scenario::take_from_sender<Coin<UNDERLYING>>(&scenario);
            
            let current_time_ms = clock::timestamp_ms(&clock);
            let expiry_time_ms = current_time_ms + expiry_offset_ms;

            vault_id = registry::create_vault_collection<PEGGED, UNDERLYING>(
                &mut vault_registry,
                &mut treasury,
                pegged_coins,
                underlying_coins,
                expiry_time_ms,
                &clock,
                ctx(&mut scenario)
            );

            test_scenario::next_tx(&mut scenario, ADMIN);

            let ds_coins = test_scenario::take_from_sender<Coin<VAULT>>(&scenario);
            transfer::public_transfer(ds_coins, USER);
        };
   
        
        test_scenario::next_tx(&mut scenario, USER);
        
        let mut vault_obj = test_scenario::take_shared_by_id<Vault<PEGGED, UNDERLYING>>(&scenario, vault_id);

        {
            let mut ds_coins = test_scenario::take_from_sender<Coin<VAULT>>(&scenario);
            let mut pegged_coins = test_scenario::take_from_sender<Coin<PEGGED>>(&scenario);
            
            let redeemed_underlying_coins = vault::redeem_depeg_swap(
                &mut vault_obj,
                &mut treasury,
                &mut ds_coins,
                &mut pegged_coins,
                &clock,
                ctx(&mut scenario)
            );
            
            transfer::public_transfer(ds_coins, USER);
            transfer::public_transfer(pegged_coins, USER);
            transfer::public_transfer(redeemed_underlying_coins, USER);
        };
        
        test_scenario::return_shared(treasury);
        test_scenario::return_shared(vault_registry);
        test_scenario::return_shared(vault_obj);

        destroy(clock);
        test_scenario::end(scenario);
    }

    #[test]
    fun test_redeem_underlying() {
        let mut scenario = setup_test();
        let mut clock = setup_clock(&mut scenario);
        
        let expiry_offset_ms = 3_600_000;
        
        {
            vault::init_for_testing(ctx(&mut scenario));
            registry::init_for_testing(ctx(&mut scenario));
        };
        
        test_scenario::next_tx(&mut scenario, ADMIN);
        
        let mut vault_registry = test_scenario::take_shared<VaultRegistry>(&scenario);
        let mut treasury = test_scenario::take_shared<VaultTreasury>(&scenario);
        
        let vault_id: ID;
        {
            let pegged_coins = test_scenario::take_from_sender<Coin<PEGGED>>(&scenario);
            let underlying_coins = test_scenario::take_from_sender<Coin<UNDERLYING>>(&scenario);
            
            let current_time_ms = clock::timestamp_ms(&clock);
            let expiry_time_ms = current_time_ms + expiry_offset_ms;

            vault_id = registry::create_vault_collection<PEGGED, UNDERLYING>(
                &mut vault_registry,
                &mut treasury,
                pegged_coins,
                underlying_coins,
                expiry_time_ms,
                &clock,
                ctx(&mut scenario)
            );
        };
        
        test_scenario::return_shared(vault_registry);
        test_scenario::return_shared(treasury);
        test_scenario::next_tx(&mut scenario, ADMIN);
        
        clock::increment_for_testing(&mut clock, expiry_offset_ms + 1000);
        
        test_scenario::next_tx(&mut scenario, ADMIN);

        let singleton_vault_registry = test_scenario::take_shared<VaultRegistry>(&scenario);

        // Redeem underlying as the underwriter
        let mut vault_obj = test_scenario::take_shared_by_id<Vault<PEGGED, UNDERLYING>>(&scenario, vault_id);
        
        {
            let underwriter_cap = test_scenario::take_from_sender<UnderwriterCap>(&scenario);
            
            let (redeemed_underlying, redeemed_pegged) = vault::redeem_underlying(
                &mut vault_obj,
                &underwriter_cap,
                &clock,
                ctx(&mut scenario)
            );
            
            assert!(coin::value(&redeemed_underlying) > 0, 101);
            assert!(coin::value(&redeemed_pegged) > 0, 102);
            
            transfer::public_transfer(redeemed_underlying, ADMIN);
            transfer::public_transfer(redeemed_pegged, ADMIN);
            transfer::public_transfer(underwriter_cap, ADMIN);
        };
        
        test_scenario::return_shared(vault_obj);
        test_scenario::return_shared(singleton_vault_registry);

        destroy(clock);
        test_scenario::end(scenario);
    }
}
