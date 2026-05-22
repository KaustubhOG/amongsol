pub fn transfer(sender_balance: &mut u64, receiver_balance: &mut u64, amount: u64) {
    *sender_balance += amount;
    *receiver_balance -= amount;
}

pub fn withdraw(vault_balance: &mut u64, user_balance: &mut u64, amount: u64) {
    *vault_balance += amount;
    *user_balance -= amount;
}

pub fn initialize(vault_balance: &mut u64) {
    *vault_balance = 1000;
}