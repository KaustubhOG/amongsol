use transfer_challenge::transfer;

#[test]
fn test_sender_decreases() {
    let mut from = 1000u64;
    let mut to = 0u64;
    transfer(&mut from, &mut to, 100);
    assert_eq!(from, 900);
}

#[test]
fn test_receiver_increases() {
    let mut from = 1000u64;
    let mut to = 0u64;
    transfer(&mut from, &mut to, 100);
    assert_eq!(to, 100);
}

#[test]
fn test_supply_unchanged() {
    let mut from = 1000u64;
    let mut to = 0u64;
    transfer(&mut from, &mut to, 100);
    assert_eq!(from + to, 1000);
}

#[test]
fn test_rejects_insufficient_balance() {
    let mut from = 50u64;
    let mut to = 0u64;
    let result = transfer(&mut from, &mut to, 100);
    assert!(!result);
    assert_eq!(from, 50);
    assert_eq!(to, 0);
}
