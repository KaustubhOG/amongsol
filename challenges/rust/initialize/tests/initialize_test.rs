use initialize_challenge::initialize;

#[test]
fn test_initializes_supply_with_decimals() {
    let result = initialize(1000, 2);
    assert_eq!(result, (100000, 2, true));
}

#[test]
fn test_rejects_zero_supply() {
    let result = initialize(0, 9);
    assert_eq!(result, (0, 9, false));
}

#[test]
fn test_keeps_decimals() {
    let result = initialize(10, 6);
    assert_eq!(result.1, 6);
}
