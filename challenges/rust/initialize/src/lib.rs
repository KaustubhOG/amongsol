pub fn initialize(supply: u64, decimals: u8) -> (u64, u8, bool) {
    if supply == 0 {
        return (0, decimals, false);
    }
    let adjusted = supply * 10u64.pow(decimals as u32);
    (adjusted, decimals, true)
}
