module test_coins::pegged_coin {
    use sui::coin::{Self, TreasuryCap};

    /// One Time Witness for the PEGGED coin
    public struct PEGGED_COIN has drop {}

    const TEST_MINT_AMOUNT: u64 = 1_000_000_000; // 1 billion units (adjust decimals as needed)
    const RECEIVER: address = @0x9c4403d237a8904640ea6515e5fdb96e28700f9974eaf6dd216b4d466eee56ec;

    fun init(witness: PEGGED_COIN, ctx: &mut TxContext) {
        // Create PEGGED token
        let (mut treasury_cap, metadata) = coin::create_currency(
            witness,
            9, // decimals
            b"PEGD",
            b"Pegged Test Token",
            b"Test token for depeg swap testing",
            option::none(),
            ctx
        );

        let sender = tx_context::sender(ctx);

        // Mint and transfer PEGGED tokens to test address
        let pegged_coins = coin::mint(&mut treasury_cap, TEST_MINT_AMOUNT, ctx);
        transfer::public_transfer(pegged_coins, RECEIVER);

        // Transfer the treasury cap to the publisher
        transfer::public_transfer(treasury_cap, sender);

        // Freeze metadata
        transfer::public_freeze_object(metadata);
    }

    /// Mint more PEGGED tokens (only treasury cap owner can call this)
    public entry fun mint(
        treasury_cap: &mut TreasuryCap<PEGGED_COIN>, 
        amount: u64, 
        recipient: address, 
        ctx: &mut TxContext
    ) {
        let coins = coin::mint(treasury_cap, amount, ctx);
        transfer::public_transfer(coins, recipient);
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(PEGGED_COIN {}, ctx)
    }
}
