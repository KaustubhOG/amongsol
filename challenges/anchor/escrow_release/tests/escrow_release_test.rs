use escrow_release_challenge::{release_escrow, Escrow, Pubkey};

fn key(value: u8) -> Pubkey {
    Pubkey([value; 32])
}

#[test]
fn test_authority_can_release_escrow() {
    let authority = key(7);
    let mut escrow = Escrow {
        authority,
        released: false,
        amount: 500,
    };

    let result = release_escrow(&mut escrow, authority);

    assert_eq!(result, Ok(()));
    assert!(escrow.released);
    assert_eq!(escrow.amount, 500);
}

#[test]
fn test_wrong_signer_cannot_release_escrow() {
    let authority = key(7);
    let mut escrow = Escrow {
        authority,
        released: false,
        amount: 500,
    };

    let result = release_escrow(&mut escrow, key(9));

    assert_eq!(result, Err("invalid authority"));
    assert!(!escrow.released);
}

#[test]
fn test_cannot_release_twice() {
    let authority = key(7);
    let mut escrow = Escrow {
        authority,
        released: true,
        amount: 500,
    };

    let result = release_escrow(&mut escrow, authority);

    assert_eq!(result, Err("escrow already released"));
    assert!(escrow.released);
}
