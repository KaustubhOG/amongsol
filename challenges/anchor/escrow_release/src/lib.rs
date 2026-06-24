#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Pubkey(pub [u8; 32]);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Escrow {
    pub authority: Pubkey,
    pub released: bool,
    pub amount: u64,
}

pub fn release_escrow(escrow: &mut Escrow, signer: Pubkey) -> Result<(), &'static str> {
    if escrow.authority != signer {
        return Err("invalid authority");
    }
    if escrow.released {
        return Err("escrow already released");
    }
    escrow.released = true;
    Ok(())
}
