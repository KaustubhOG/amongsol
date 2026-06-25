# AmongSol

AmongSol is a multiplayer social-deduction coding game inspired by Among Us. Players join a room, choose a challenge map, edit code together, run tests, call meetings, and vote out the impostor before the round ends.

## Screenshots

![Home Screen](Screenshots/Screenshot%20from%202026-06-25%2005-33-44.png)
![Create Room](Screenshots/Screenshot%20from%202026-06-25%2005-33-56.png)
![Lobby](Screenshots/Screenshot%20from%202026-06-25%2005-34-23.png)
![Game View](Screenshots/Screenshot%20from%202026-06-25%2005-34-51.png)
![Meeting Vote](Screenshots/Screenshot%20from%202026-06-25%2005-35-00.png)

## Solana Integration

AmongSol uses Solana for on-chain stakes and payouts. The integration is built on the Anchor framework and deployed to devnet.

### Staking Program

- **Program ID**: `H97Ae97W6cipiGASn27cRaj7ZAddGDnK9pS8qWKXZqTA`
- **Network**: Solana Devnet
- **RPC Endpoint**: `https://api.devnet.solana.com`

The staking program (`programs/amongsol_staking/`) manages room escrows:

1. **Initialize Game** - Host creates room escrow with stake amount (default 0.1 SOL)
2. **Deposit Stake** - Each player deposits stake into the vault PDA
3. **Settle Game** - Host signs settlement transaction distributing vault to winners

### Accounts Structure

```
Game Escrow (PDA)
├── seeds: ["game", room_id]
├── host: Pubkey
├── stake_lamports: u64
├── settled: bool
└── vault_bump: u8

Vault (PDA)
├── seeds: ["vault", game_escrow_key]
└── lamports: total pot
```

### Client Integration

The frontend (`frontend/lib/solana.ts`) handles:
- Wallet connection (Phantom, Solflare, Brave Wallet)
- Transaction construction with Anchor discriminators
- PDA derivation for game and vault accounts
- Stake deposit and settlement transactions

**Note**: Due to the recent patch, the settlement flow is currently in work. The stake deposit and game initialization are functional. Winner payout distribution via `settle_game` instruction is being finalized.

### Environment Variables

Frontend (`.env.local`):
```
NEXT_PUBLIC_AMONGSOL_STAKING_PROGRAM_ID=H97Ae97W6cipiGASn27cRaj7ZAddGDnK9pS8qWKXZqTA
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_BACKEND_URL=https://amongsol-production.up.railway.app
```

Backend (`.env`):
```
AMONGSOL_STAKING_PROGRAM_ID=H97Ae97W6cipiGASn27cRaj7ZAddGDnK9pS8qWKXZqTA
DATABASE_URL=postgresql://...
```

### Deploying the Staking Program

```bash
cd programs/amongsol_staking
anchor build
anchor deploy --provider.cluster devnet
# Update declare_id! in lib.rs with new program ID
# Update environment variables in frontend and backend
```

## Project Structure

```
amongsol/
├── frontend/                 # Next.js 16 application
│   ├── app/                  # App Router pages
│   │   ├── page.tsx         # Home screen
│   │   ├── create/          # Room creation
│   │   ├── join/            # Join by code
│   │   ├── lobby/           # Waiting room
│   │   ├── game/            # Code editor
│   │   ├── meeting/         # Discussion phase
│   │   ├── vote/            # Voting phase
│   │   └── results/         # Game outcome
│   ├── components/          # React components
│   ├── lib/                 # Utilities (socket, solana, backend)
│   └── package.json
├── backend/                  # Axum + WebSocket server
│   ├── src/
│   │   ├── main.rs          # Entry point
│   │   ├── game/            # Game logic
│   │   │   ├── manager.rs   # Room management
│   │   │   ├── session.rs   # Game state
│   │   │   ├── roles.rs     # Impostor assignment
│   │   │   ├── timer.rs     # Round timer
│   │   │   └── challenges.rs
│   │   ├── ws/              # WebSocket handlers
│   │   └── compiler/        # Cargo test runner
│   └── Cargo.toml
├── programs/
│   └── amongsol_staking/    # Anchor program
│       ├── src/lib.rs
│       ├── Cargo.toml
│       └── Anchor.toml
└── challenges/
    ├── rust/                # Rust challenges
    │   ├── transfer/
    │   ├── withdraw/
    │   └── initialize/
    └── anchor/              # Anchor challenges
        └── escrow_release/
```

## Core Flow

1. Open the home screen
2. Create a room or join an existing room code
3. If creating, choose a map: Rust or Anchor
4. Enter the lobby and wait for players
5. Each player connects a Solana wallet and stakes into the room vault
6. Start the round once 4 players have staked
7. Edit code in the code room, run tests, and call a meeting when needed
8. Vote during the emergency meeting
9. View the result screen, including the payout split
10. The host signs the settlement transaction to release the Anchor vault payout, then everyone can return home

## Requirements

- Node.js 18+
- npm
- Rust toolchain (1.75+)
- PostgreSQL database
- Solana wallet extension (Phantom, Solflare, or Brave Wallet)

## Environment Setup

### Backend

Create `backend/.env`:
```
DATABASE_URL=postgresql://user:password@host:5432/database
AMONGSOL_STAKING_PROGRAM_ID=H97Ae97W6cipiGASn27cRaj7ZAddGDnK9pS8qWKXZqTA
```

The backend creates the `game_results` table on startup if it does not exist.

### Frontend

Create `frontend/.env.local`:
```
NEXT_PUBLIC_AMONGSOL_STAKING_PROGRAM_ID=H97Ae97W6cipiGASn27cRaj7ZAddGDnK9pS8qWKXZqTA
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_BACKEND_URL=https://your-backend-url
```

## Running Locally

### Backend

```bash
cd backend
cargo run
```

The backend listens on:
- HTTP/WebSocket server: `http://localhost:8080`
- WebSocket endpoint: `ws://localhost:8080/ws`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`

### Development Order

1. Start PostgreSQL
2. Start the backend (`cd backend && cargo run`)
3. Start the frontend (`cd frontend && npm run dev`)
4. Open the app in the browser

## Frontend Scripts

Inside `frontend/`:
- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run start` - Run production build
- `npm run lint` - Run ESLint

## Backend Architecture

### Game Manager

In-memory room management using `DashMap` for concurrent access:
- `sessions`: GameId -> GameSession
- `conn_to_game`: ConnectionId -> GameId

### Game Session State Machine

```
Lobby -> Playing -> CodeLocked -> Meeting -> Voting -> Ended
              \_______________/                |
                     |_________________________|
```

### WebSocket Protocol

**Client Messages:**
- `JoinGame` - Enter room with wallet
- `ConfirmStake` - Submit stake transaction signature
- `StartGame` - Host starts round
- `EditCode` - Modify function implementation
- `RunTests` - Execute cargo test
- `CallMeeting` - Trigger discussion phase
- `StartVoting` - Begin voting
- `CastVote` - Vote for ejection

**Server Messages:**
- `GameJoined` - Initial state sync
- `PlayerJoined` / `PlayerLeft` - Presence updates
- `StakeUpdated` - Stake status changes
- `GameStarted` - Challenge functions delivered
- `RoleAssigned` - Impostor/Engineer role
- `TestResults` - Test pass/fail
- `PlayerEditing` - Collaborative editing cursor
- `TimerTick` - Countdown updates
- `CodeLocked` - Editing disabled
- `MeetingCalled` - Edit history for discussion
- `VotingStarted` - Voting phase begins
- `VoteUpdate` - Vote counts
- `GameOver` - Winner, impostor, payout summary

### Challenge System

Challenges are stored as Cargo crates in `challenges/<map>/<challenge_id>/`.

The backend copies the challenge to a temporary directory, replaces the target function with player code, and runs `cargo test`.

Supported maps:
- `rust` - Pure Rust challenges
- `anchor` - Solana/Anchor program challenges

### Timer

3-minute round timer with 30-second code lock warning. Timer pauses during meetings.

### Voting

Simple majority voting (threshold = players/2 + 1). Ejected player determines winner:
- Ejected = impostor -> Civilians win
- Ejected != impostor -> Impostor wins

### Payouts

- **Impostor wins**: Full pot to impostor
- **Civilians win**: Pot split equally among non-impostors

Payout calculation happens on-chain via the settlement transaction.

## Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Import project in Vercel
3. Set Root Directory to `frontend`
4. Add environment variables
5. Deploy

### Backend (Railway)

1. Create new project from GitHub
2. Set Root Directory to `backend`
3. Add environment variables
4. Settings -> Networking -> Add Public Port 8080
5. Deploy

### Database (Neon)

Provision a PostgreSQL database and add connection string to `DATABASE_URL`.

## Troubleshooting

| Issue | Resolution |
|-------|------------|
| Frontend cannot create/join rooms | Verify backend is running and `NEXT_PUBLIC_BACKEND_URL` is correct |
| Backend fails on startup | Confirm `DATABASE_URL` points to reachable PostgreSQL |
| Stale room state in UI | Clear browser storage for the site and reconnect |
| Wallet not detected | Install Phantom or Solflare extension; disable Brave Wallet if using Brave |
| WebSocket connection fails | Ensure backend port 8080 is publicly accessible |

## Known Limitations

- Settlement transaction (`settle_game`) is in work due to recent patch
- Game results persistence requires PostgreSQL
- Maximum 4 players per room
- Round duration fixed at 3 minutes

## License

No license has been defined for this repository yet.