# AmongSol

AmongSol is a real-time multiplayer social deduction game built for developers. Players join a shared code room, collaboratively write and fix Rust or Solana/Anchor programs, run live tests, and try to identify the hidden impostor sabotaging the codebase before time runs out. Stakes are locked on-chain at the start of every round and distributed automatically to winners through a Solana smart contract.

---

## Table of Contents

- [Overview](#overview)
- [Screenshots](#screenshots)
- [Solana Integration](#solana-integration)
  - [Staking Program](#staking-program)
  - [On-Chain Account Structure](#on-chain-account-structure)
  - [Transaction Lifecycle](#transaction-lifecycle)
  - [Client Integration](#client-integration)
  - [Payout Logic](#payout-logic)
  - [Deploying the Staking Program](#deploying-the-staking-program)
  - [Environment Variables](#environment-variables)
- [Gameplay](#gameplay)
- [Project Structure](#project-structure)
- [Backend Architecture](#backend-architecture)
- [Challenge System](#challenge-system)
- [WebSocket Protocol](#websocket-protocol)
- [Requirements](#requirements)
- [Running Locally](#running-locally)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)

---

## Overview

AmongSol puts between two and four developers in a shared code editor. One of them is secretly assigned the impostor role. The rest are engineers whose job is to make all tests pass. The impostor's job is to quietly introduce bugs, stall collaborators, and escape detection until the round ends.

At the start of every game, each player stakes a fixed amount of SOL into an on-chain escrow vault managed by the AmongSol Anchor program. The vault only releases funds after the game concludes and the host signs a settlement transaction. Winners receive the full pot split according to the outcome — impostor takes everything on a win, civilians split the pot equally when they vote the impostor out.

The game is built on a Rust/Axum WebSocket backend, a Next.js frontend with a Monaco-based shared code editor, and an Anchor smart contract deployed to Solana Devnet.

---

## Screenshots

**Home Screen**

![Home Screen](Screenshots/Screenshot%20from%202026-06-25%2005-33-44.png)

**Create Room**

![Create Room](Screenshots/Screenshot%20from%202026-06-25%2005-33-56.png)

**Lobby**

![Lobby](Screenshots/Screenshot%20from%202026-06-25%2005-34-23.png)

**Game View**

![Game View](Screenshots/Screenshot%20from%202026-06-25%2005-34-51.png)

**Meeting and Vote**

![Meeting Vote](Screenshots/Screenshot%20from%202026-06-25%2005-35-00.png)

---

## Solana Integration

Solana is the financial backbone of every AmongSol game. Rather than keeping stakes in a database or trusting the server with funds, AmongSol uses a purpose-built Anchor smart contract to custody all player stakes on-chain for the duration of the round. No one can access the vault until the game ends and the settlement instruction is invoked.

### Staking Program

| Property | Value |
|---|---|
| Program ID | `H97Ae97W6cipiGASn27cRaj7ZAddGDnK9pS8qWKXZqTA` |
| Network | Solana Devnet |
| RPC Endpoint | `https://api.devnet.solana.com` |
| Framework | Anchor |
| Default Stake | 0.1 SOL per player |

The staking program lives at `programs/amongsol_staking/` and exposes three primary instructions:

**initialize_game**

Called by the host when a room is created. This instruction derives a Game Escrow PDA using the room ID as a seed and records the host public key, the agreed stake amount in lamports, and a settled flag initialized to false. No funds move at this step.

**deposit_stake**

Called once per player when they confirm their stake from the lobby. The instruction verifies the depositing wallet matches the expected stake amount and transfers lamports from the player's account into the Vault PDA. The Vault PDA is a system-owned account derived from the Game Escrow address. This instruction can only be called while the game has not been settled.

**settle_game**

Called by the host at the end of the game after winner determination. This instruction verifies the caller is the host recorded at initialization, marks the escrow as settled, and transfers lamports out of the Vault PDA to winner addresses. The transfer amounts are provided as instruction arguments by the frontend and are computed off-chain based on the game result.

### On-Chain Account Structure

```
Game Escrow PDA
  seeds : ["game", room_id_bytes]
  ├── host          : Pubkey
  ├── stake_lamports: u64
  ├── settled       : bool
  └── vault_bump    : u8

Vault PDA
  seeds : ["vault", game_escrow_pubkey]
  └── lamports: u64   (sum of all player deposits)
```

The Game Escrow account stores metadata. The Vault is a bare system account that holds the actual SOL. Separating metadata from the lamport custody makes the settlement math simpler and avoids rent-exemption edge cases.

### Transaction Lifecycle

The full on-chain lifecycle of a single game round:

```
1. Host calls initialize_game(room_id, stake_lamports)
     -> Game Escrow PDA is created on-chain
     -> Vault PDA address is derived but not yet funded

2. Each player calls deposit_stake(game_escrow)
     -> Player wallet transfers stake_lamports to Vault PDA
     -> Backend receives ConfirmStake WebSocket message with tx signature
     -> Backend verifies signature and marks player as staked

3. Game plays out entirely off-chain (WebSocket server)
     -> Tests run, meetings are called, votes are cast
     -> Backend determines winner

4. Results screen: host calls settle_game(game_escrow, winner_addresses, amounts)
     -> Vault lamports are distributed to winners
     -> Escrow.settled is set to true
     -> Further deposits blocked
```

No admin key holds funds at any point. The host wallet is the only authority for the settlement instruction, and its identity is recorded at initialization time, so a malicious backend cannot redirect winnings.

### Client Integration

The frontend handles all wallet and transaction logic in `frontend/lib/solana.ts`. It supports three wallet adapters out of the box:

- Phantom
- Solflare
- Brave Wallet

Key operations performed by the client library:

**PDA derivation** — Both the Game Escrow and Vault PDAs are derived client-side using `@solana/web3.js` `PublicKey.findProgramAddressSync` with the same seeds used on-chain. This lets the frontend construct transactions without any server round-trip.

**Anchor discriminator construction** — Instructions are built manually using Anchor's 8-byte discriminator (first 8 bytes of `sha256("global:<instruction_name>")`), which allows the frontend to call the program without a generated IDL client if needed.

**Transaction submission** — All transactions are signed by the user's wallet and sent to the configured RPC endpoint. The returned transaction signature is sent to the backend via WebSocket as a `ConfirmStake` or post-settlement confirmation message.

```typescript
// Example: deriving the Game Escrow PDA client-side
const [gameEscrowPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("game"), Buffer.from(roomId)],
  PROGRAM_ID
);

// Example: deriving the Vault PDA from the escrow address
const [vaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), gameEscrowPda.toBuffer()],
  PROGRAM_ID
);
```

### Payout Logic

Payout distribution is determined by who gets voted out:

| Outcome | Distribution |
|---|---|
| Ejected player is the impostor | Full vault transferred to the impostor |
| Ejected player is not the impostor | Vault split equally among all non-impostor players |
| Round ends with no ejection | Impostor wins; full vault transferred to impostor |

The payout amounts are computed on the backend after the game ends and passed as arguments to the `settle_game` instruction. The on-chain program does not independently compute winner logic — it trusts the host-signed instruction and enforces only that the host is the signer and the vault has not already been settled.

### Deploying the Staking Program

To redeploy the staking program to Devnet:

```bash
cd programs/amongsol_staking

# Build the program
anchor build

# Deploy to Devnet
anchor deploy --provider.cluster devnet
```

After a fresh deploy, the program ID will change. Update the following:

1. `declare_id!` macro in `programs/amongsol_staking/src/lib.rs`
2. `NEXT_PUBLIC_AMONGSOL_STAKING_PROGRAM_ID` in `frontend/.env.local`
3. `AMONGSOL_STAKING_PROGRAM_ID` in `backend/.env`

To verify the deployment:

```bash
solana program show <new_program_id> --url devnet
```

### Environment Variables

**Frontend** (`frontend/.env.local`):

```
NEXT_PUBLIC_AMONGSOL_STAKING_PROGRAM_ID=H97Ae97W6cipiGASn27cRaj7ZAddGDnK9pS8qWKXZqTA
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_BACKEND_URL=https://amongsol-production.up.railway.app
```

**Backend** (`backend/.env`):

```
DATABASE_URL=postgresql://user:password@host:5432/database
AMONGSOL_STAKING_PROGRAM_ID=H97Ae97W6cipiGASn27cRaj7ZAddGDnK9pS8qWKXZqTA
```

---

## Gameplay

### Full Round Flow

1. A player opens the home screen and creates a new room, selecting a challenge map (Rust or Anchor).
2. Other players join via a room code.
3. Each player connects a Solana wallet (Phantom, Solflare, or Brave Wallet) from the lobby and deposits the required stake into the on-chain vault.
4. The host starts the round once all four players have confirmed their stakes.
5. The game assigns roles privately: one player is the impostor, the rest are engineers.
6. Players see the challenge in a shared Monaco editor. Each player controls a distinct function. Engineers try to make tests pass; the impostor tries to introduce or preserve failures without getting caught.
7. Any player can run `cargo test` at any time. Results are broadcast to all players.
8. Any player can call an emergency meeting to discuss suspicious edits. The edit history is shared during the meeting.
9. Players vote to eject a suspect. Simple majority carries.
10. The game ends when the impostor is ejected, all tests pass with the impostor still in the room, or the 3-minute timer expires.
11. The results screen shows the winner, the impostor's identity, and the payout amounts.
12. The host signs the settlement transaction to release the vault to winners.

### Round Timer

Each round lasts 3 minutes. A 30-second code lock warning fires before editing is disabled at the end of the round. The timer pauses during emergency meetings and resumes when voting concludes.

### Voting

Voting requires a simple majority: `floor(players / 2) + 1` votes to eject. If no majority is reached, the meeting ends with no ejection and the round continues.

---

## Project Structure

```
amongsol/
├── frontend/                    # Next.js 16 application
│   ├── app/
│   │   ├── page.tsx             # Home screen
│   │   ├── create/              # Room creation and map selection
│   │   ├── join/                # Join room by code
│   │   ├── lobby/               # Waiting room and stake confirmation
│   │   ├── game/                # Shared Monaco code editor
│   │   ├── meeting/             # Emergency meeting discussion
│   │   ├── vote/                # Voting phase
│   │   └── results/             # Game outcome and payout summary
│   ├── components/              # Reusable React components
│   ├── lib/
│   │   ├── socket.ts            # WebSocket client
│   │   ├── solana.ts            # Wallet adapter and transaction builder
│   │   └── backend.ts           # HTTP helpers
│   └── package.json
│
├── backend/                     # Axum + WebSocket server (Rust)
│   ├── src/
│   │   ├── main.rs              # Server entry point
│   │   ├── game/
│   │   │   ├── manager.rs       # Room registry (DashMap)
│   │   │   ├── session.rs       # Per-room game state machine
│   │   │   ├── roles.rs         # Impostor assignment
│   │   │   ├── timer.rs         # Round countdown
│   │   │   └── challenges.rs    # Challenge loader
│   │   ├── ws/                  # WebSocket message handlers
│   │   └── compiler/            # cargo test runner
│   └── Cargo.toml
│
├── programs/
│   └── amongsol_staking/        # Anchor smart contract
│       ├── src/lib.rs           # Program instructions
│       ├── Cargo.toml
│       └── Anchor.toml
│
└── challenges/
    ├── rust/                    # Pure Rust challenge crates
    │   ├── transfer/
    │   ├── withdraw/
    │   └── initialize/
    └── anchor/                  # Solana/Anchor challenge crates
        └── escrow_release/
```

---

## Backend Architecture

### Game Manager

The game manager maintains two concurrent hash maps using `DashMap`:

- `sessions` maps a `GameId` to a `GameSession`, storing all runtime state for an active room.
- `conn_to_game` maps a `ConnectionId` to a `GameId`, used to route incoming WebSocket messages to the correct session without a linear scan.

### Game Session State Machine

Each room transitions through a fixed set of states:

```
Lobby
  |
  v
Playing  <---------+
  |                |
  v                |
CodeLocked         |
  |                |
  v                |
Meeting            |
  |                |
  v                |
Voting  -----------+
  |
  v
Ended
```

Meetings and voting can loop back into Playing if no ejection reaches majority. Code is locked when the timer drops below 30 seconds and cannot be unlocked.

### Database

The backend connects to a PostgreSQL database via `sqlx`. On startup it runs a `CREATE TABLE IF NOT EXISTS` migration to ensure the `game_results` table exists. Game results (winner role, impostor identity, player list, payout amounts) are persisted at end of round for audit purposes.

---

## Challenge System

Challenges are self-contained Cargo crates stored under `challenges/<map>/<challenge_id>/`. Each crate has a set of functions with stub implementations and a test suite targeting those functions.

When a round starts:

1. The backend reads the challenge directory for the selected map.
2. The stub source is sent to all players as their starting code via the `GameStarted` WebSocket message.
3. When a player runs tests, the backend copies the challenge crate to a temporary directory, replaces the target function bodies with the current player code from session state, and spawns `cargo test` as a subprocess.
4. Standard output and exit code are captured and broadcast to all players as a `TestResults` message.

Supported maps:

- `rust` — Pure Rust functions covering common programming tasks.
- `anchor` — Solana/Anchor instruction handlers targeting program correctness.

Adding a new challenge requires creating a new directory under the appropriate map folder with a valid `Cargo.toml` and at least one `#[test]` that can fail when the stub is unimplemented.

---

## WebSocket Protocol

All real-time game state is communicated over a single persistent WebSocket connection per player.

### Client to Server Messages

| Message | Payload | Description |
|---|---|---|
| `JoinGame` | room_code, wallet_address | Enter an existing room |
| `ConfirmStake` | tx_signature | Notify backend of successful stake deposit |
| `StartGame` | — | Host initiates the round |
| `EditCode` | function_id, content | Broadcast a code edit |
| `RunTests` | — | Trigger cargo test execution |
| `CallMeeting` | — | Initiate an emergency meeting |
| `StartVoting` | — | Transition meeting to voting phase |
| `CastVote` | target_player_id | Submit a vote for ejection |

### Server to Client Messages

| Message | Payload | Description |
|---|---|---|
| `GameJoined` | full session state | Sent on successful join to sync state |
| `PlayerJoined` | player info | Broadcast when a new player enters the lobby |
| `PlayerLeft` | player_id | Broadcast on disconnection |
| `StakeUpdated` | player_id, staked | Reflects on-chain stake confirmation |
| `GameStarted` | challenge functions | Delivers starting stubs to all players |
| `RoleAssigned` | role | Private message; tells player their role |
| `TestResults` | passed, output | Broadcast test execution result |
| `PlayerEditing` | player_id, function_id | Collaborative cursor presence |
| `TimerTick` | seconds_remaining | Sent every second during Playing state |
| `CodeLocked` | — | Signals 30-second lock has engaged |
| `MeetingCalled` | edit_history | Broadcasts full edit log for discussion |
| `VotingStarted` | — | Transitions all clients to voting phase |
| `VoteUpdate` | vote_counts | Running vote tally |
| `GameOver` | winner_role, impostor_id, payouts | Final result broadcast |

---

## Requirements

| Dependency | Minimum Version |
|---|---|
| Node.js | 18 |
| Rust toolchain | 1.75 |
| Anchor CLI | 0.29 |
| Solana CLI | 1.18 |
| PostgreSQL | 14 |
| Solana wallet extension | Phantom, Solflare, or Brave Wallet |

---

## Running Locally

### 1. Database

Start a PostgreSQL instance and note the connection string. The backend will create the required table automatically.

### 2. Backend

```bash
cd backend
```

Create `backend/.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/amongsol
AMONGSOL_STAKING_PROGRAM_ID=H97Ae97W6cipiGASn27cRaj7ZAddGDnK9pS8qWKXZqTA
```

Start the server:

```bash
cargo run
```

The backend listens on:
- HTTP and WebSocket: `http://localhost:8080`
- WebSocket endpoint: `ws://localhost:8080/ws`

### 3. Frontend

```bash
cd frontend
```

Create `frontend/.env.local`:

```
NEXT_PUBLIC_AMONGSOL_STAKING_PROGRAM_ID=H97Ae97W6cipiGASn27cRaj7ZAddGDnK9pS8qWKXZqTA
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
```

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in a browser.

### Development Wallet Setup

To test the staking flow locally, use Solana Devnet wallets with airdropped SOL:

```bash
# Airdrop devnet SOL to a test wallet
solana airdrop 2 <wallet_address> --url devnet
```

Each player needs at least 0.1 SOL plus a small buffer for transaction fees (~0.001 SOL per transaction).

---

## Deployment

### Frontend (Vercel)

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Set the Root Directory to `frontend`.
4. Add all environment variables from `frontend/.env.local`.
5. Deploy.

### Backend (Railway)

1. Create a new Railway project from the GitHub repository.
2. Set the Root Directory to `backend`.
3. Add environment variables: `DATABASE_URL` and `AMONGSOL_STAKING_PROGRAM_ID`.
4. Under Settings, go to Networking and expose port 8080 publicly.
5. Deploy.

### Database (Neon)

Provision a serverless PostgreSQL instance on Neon. Copy the connection string and set it as `DATABASE_URL` in both the Railway backend environment and locally. The backend handles schema creation on startup.

---

## Known Limitations

- The `settle_game` instruction flow is currently being finalized after a recent patch. Stake deposit and game initialization are fully functional.
- Maximum room size is 4 players.
- Round duration is fixed at 3 minutes with no configurable override.
- Game results persistence requires a live PostgreSQL connection; in-memory sessions are lost on backend restart.
- Anchor challenges require `solana-program` and related crates available in the compile environment; cold builds on the backend may be slow.

---

## Troubleshooting

| Symptom | Resolution |
|---|---|
| Frontend cannot create or join rooms | Verify the backend is running and `NEXT_PUBLIC_BACKEND_URL` is set correctly |
| Backend fails on startup | Check that `DATABASE_URL` points to a reachable PostgreSQL instance |
| Stale room state in the browser | Clear browser local storage for the site and reconnect |
| Wallet not detected | Install Phantom or Solflare; if using Brave, disable the built-in Brave Wallet |
| WebSocket connection fails | Confirm backend port 8080 is publicly accessible and not blocked by a firewall |
| Stake deposit transaction fails | Ensure the wallet has at least 0.1 SOL plus ~0.001 SOL for fees on Devnet |
| cargo test hangs in the browser | The backend challenge runner has a timeout; check backend logs for the subprocess exit reason |
| Monaco editor renders blank | Verify the game route is receiving the `GameStarted` message; check WebSocket connection state in browser devtools |

---

## License

No license has been defined for this repository yet.
