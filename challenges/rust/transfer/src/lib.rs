pub fn transfer(from: &mut u64, to: &mut u64, amount: u64) -> bool {
    if *from < amount {
        return false;
    }
    *from -= amount;
    *to += amount;
    true
}
