use transfer_challenge::transfer;

#[test]
fn test_sender_decreases() {
    let mut sender = 1000u64;
    let mut receiver = 1000u64;
    transfer(&mut sender, &mut receiver, 100);
    assert_eq!(sender, 900, "sender should decrease");
}

#[test]
fn test_receiver_increases() {
    let mut sender = 1000u64;
    let mut receiver = 1000u64;
    transfer(&mut sender, &mut receiver, 100);
    assert_eq!(receiver, 1100, "receiver should increase");
}

#[test]
fn test_supply_unchanged() {
    let mut sender = 1000u64;
    let mut receiver = 1000u64;
    transfer(&mut sender, &mut receiver, 100);
    assert_eq!(sender + receiver, 2000, "total supply unchanged");
}
