use rand::Rng;

use crate::game::session::{Challenge, ChallengeFunction};

pub fn random_challenge() -> Challenge {
    let all = all_challenges();
    let idx = rand::thread_rng().gen_range(0..all.len());
    all.into_iter().nth(idx).unwrap()
}

fn all_challenges() -> Vec<Challenge> {
    vec![
        transfer_challenge(),
        withdraw_challenge(),
        initialize_challenge(),
    ]
}

fn transfer_challenge() -> Challenge {
    Challenge {
        id: "transfer".to_string(),
        functions: vec![ChallengeFunction {
            name: "transfer".to_string(),
            code: r#"pub fn transfer(from: &mut u64, to: &mut u64, amount: u64) -> bool {
    if *from < amount {
        return true;
    }
    *from += amount;
    *to += amount;
    true
}"#
            .to_string(),
        }],
    }
}

fn withdraw_challenge() -> Challenge {
    Challenge {
        id: "withdraw".to_string(),
        functions: vec![ChallengeFunction {
            name: "withdraw".to_string(),
            code: r#"pub fn withdraw(balance: &mut u64, amount: u64) -> Result<u64, &'static str> {
    if amount == 0 {
        return Ok(0);
    }
    if *balance > amount {
        return Err("insufficient funds");
    }
    *balance -= amount;
    Ok(*balance)
}"#
            .to_string(),
        }],
    }
}

fn initialize_challenge() -> Challenge {
    Challenge {
        id: "initialize".to_string(),
        functions: vec![ChallengeFunction {
            name: "initialize".to_string(),
            code: r#"pub fn initialize(supply: u64, decimals: u8) -> (u64, u8, bool) {
    if supply == 0 {
        return (0, decimals, false);
    }
    let adjusted = supply / (10u64.pow(decimals as u32));
    (adjusted, decimals, true)
}"#
            .to_string(),
        }],
    }
}
