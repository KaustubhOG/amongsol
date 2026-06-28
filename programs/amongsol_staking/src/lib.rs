use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("J1EHYJokNcbDGKYk3W8wkpmfAUogjD1NGq1jonPx2CnA");

#[program]
pub mod amongsol_staking {
    use super::*;

    pub fn initialize_game(
        ctx: Context<InitializeGame>,
        game_id: [u8; 8],
        stake_lamports: u64,
    ) -> Result<()> {
        require!(stake_lamports > 0, StakingError::InvalidStake);

        let game = &mut ctx.accounts.game;
        game.host = ctx.accounts.host.key();
        game.game_id = game_id;
        game.stake_lamports = stake_lamports;
        game.settled = false;
        game.bump = ctx.bumps.game;
        game.vault_bump = ctx.bumps.vault;

        Ok(())
    }

    pub fn deposit_stake(ctx: Context<DepositStake>) -> Result<()> {
        let game = &ctx.accounts.game;
        require!(!game.settled, StakingError::AlreadySettled);

        let transfer = system_program::Transfer {
            from: ctx.accounts.player.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        };

        system_program::transfer(
            CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer),
            game.stake_lamports,
        )?;

        Ok(())
    }

    pub fn settle_game<'info>(
        ctx: Context<'_, '_, '_, 'info, SettleGame<'info>>,
        payouts: Vec<Payout>,
    ) -> Result<()> {
        require!(!ctx.accounts.game.settled, StakingError::AlreadySettled);
        require_keys_eq!(
            ctx.accounts.game.host,
            ctx.accounts.host.key(),
            StakingError::InvalidHost
        );

        let total: u64 = payouts
            .iter()
            .try_fold(0_u64, |acc, payout| acc.checked_add(payout.lamports))
            .ok_or(StakingError::InvalidPayout)?;
        require!(
            total <= ctx.accounts.vault.lamports(),
            StakingError::InvalidPayout
        );
        require!(
            payouts.len() == ctx.remaining_accounts.len(),
            StakingError::InvalidPayout
        );

        // The vault is a system-owned PDA, so SOL can only leave it through a
        // system-program transfer signed by the vault's own seeds. A program
        // may not directly debit lamports from an account it does not own.
        let game_key = ctx.accounts.game.key();
        let vault_bump = ctx.accounts.game.vault_bump;
        let vault_seeds: &[&[u8]] = &[b"vault", game_key.as_ref(), &[vault_bump]];
        let signer_seeds: &[&[&[u8]]] = &[vault_seeds];

        for (payout, recipient) in payouts.iter().zip(ctx.remaining_accounts.iter()) {
            require_keys_eq!(
                payout.recipient,
                recipient.key(),
                StakingError::InvalidPayout
            );

            let transfer = system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: recipient.clone(),
            };
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    transfer,
                    signer_seeds,
                ),
                payout.lamports,
            )?;
        }

        ctx.accounts.game.settled = true;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(game_id: [u8; 8])]
pub struct InitializeGame<'info> {
    #[account(
        init,
        payer = host,
        space = 8 + GameEscrow::INIT_SPACE,
        seeds = [b"game", game_id.as_ref()],
        bump
    )]
    pub game: Account<'info, GameEscrow>,
    #[account(mut)]
    pub host: Signer<'info>,
    /// CHECK: PDA vault that only this program can debit during settlement.
    #[account(mut, seeds = [b"vault", game.key().as_ref()], bump)]
    pub vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositStake<'info> {
    #[account(seeds = [b"game", game.game_id.as_ref()], bump = game.bump)]
    pub game: Account<'info, GameEscrow>,
    /// CHECK: PDA vault derived from the game escrow account.
    #[account(mut, seeds = [b"vault", game.key().as_ref()], bump = game.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub player: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleGame<'info> {
    #[account(mut, seeds = [b"game", game.game_id.as_ref()], bump = game.bump)]
    pub game: Account<'info, GameEscrow>,
    /// CHECK: PDA vault derived from the game escrow account.
    #[account(mut, seeds = [b"vault", game.key().as_ref()], bump = game.vault_bump)]
    pub vault: UncheckedAccount<'info>,
    pub host: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct GameEscrow {
    pub host: Pubkey,
    pub game_id: [u8; 8],
    pub stake_lamports: u64,
    pub settled: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Payout {
    pub recipient: Pubkey,
    pub lamports: u64,
}

#[error_code]
pub enum StakingError {
    #[msg("stake must be greater than zero")]
    InvalidStake,
    #[msg("game escrow is already settled")]
    AlreadySettled,
    #[msg("only the game host can settle this escrow")]
    InvalidHost,
    #[msg("payout recipients or lamports do not match the vault")]
    InvalidPayout,
}
