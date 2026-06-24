use withdraw_challenge::withdraw;

#[test]
fn test_withdraw_decreases_balance() {
    let mut balance = 1000u64;
    let remaining = withdraw(&mut balance, 250).unwrap();
    assert_eq!(remaining, 750);
    assert_eq!(balance, 750);
}

#[test]
fn test_rejects_zero_amount() {
    let mut balance = 1000u64;
    let result = withdraw(&mut balance, 0);
    assert_eq!(result, Err("amount must be greater than zero"));
    assert_eq!(balance, 1000);
}

#[test]
fn test_rejects_insufficient_funds() {
    let mut balance = 100u64;
    let result = withdraw(&mut balance, 250);
    assert_eq!(result, Err("insufficient funds"));
    assert_eq!(balance, 100);
}
