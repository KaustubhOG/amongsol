pub fn withdraw(balance: &mut u64, amount: u64) -> Result<u64, &'static str> {
    if amount == 0 {
        return Err("amount must be greater than zero");
    }
    if *balance < amount {
        return Err("insufficient funds");
    }
    *balance -= amount;
    Ok(*balance)
}
