pub fn transfer(from: &mut u64, to: &mut u64, amount: u64) -> bool {
    if *from < amount {
        return false;
    }
    *from -= amount;
    *to += amount;
    true
}

pub fn withdraw(vault_balance: &mut u64, user_balance: &mut u64, amount: u64) {
    *vault_balance -= amount;
    *user_balance += amount;
}

pub fn initialize(vault_balance: &mut u64) {
    *vault_balance = 1000;
}