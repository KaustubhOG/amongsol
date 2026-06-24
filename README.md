# AmongSol

AmongSol is a multiplayer social-deduction coding game inspired by Among Us.
Players join a room, choose a challenge map, edit code together, run tests, call meetings, and vote out the impostor before the round ends.

## What The Project Contains

- `frontend/` - Next.js UI for the home screen, lobby, code room, meeting flow, voting, and results.
- `backend/` - Axum + WebSocket game server that manages rooms, players, rounds, voting, and game state.
- `challenges/rust/` - Rust map challenge crates.
- `challenges/anchor/` - Anchor/Solana map challenge crates.
- `programs/amongsol_staking/` - Anchor escrow program for room stakes and winner payouts.

## Core Flow

1. Open the home screen.
2. Create a room or join an existing room code.
3. If creating, choose a map: Rust or Anchor.
4. Enter the lobby and wait for players.
5. Each player connects a Solana wallet and stakes into the room vault.
6. Start the round once 4 players have staked.
7. Edit code in the code room, run tests, and call a meeting when needed.
8. Vote during the emergency meeting.
9. View the result screen, including the payout split.
10. The host signs the settlement transaction to release the Anchor vault payout, then everyone can return home.

## Requirements

- Node.js 18+ recommended
- npm
- Rust toolchain
- PostgreSQL

## Environment Setup

The backend requires a PostgreSQL connection string.

Set:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/amongsol
AMONGSOL_STAKING_PROGRAM_ID=vY8RcLmGmzFAHJjbD2asUfM3pUgmKpgisaVUp7rFDeR
```

You can place that in a backend `.env` file or export it in your shell before running the server.

The frontend uses Solana devnet by default. To override the RPC endpoint, set:

```bash
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_AMONGSOL_STAKING_PROGRAM_ID=vY8RcLmGmzFAHJjbD2asUfM3pUgmKpgisaVUp7rFDeR
```

## Project Structure

```text
amongsol/
  README.md
  backend/
    src/
      main.rs
      game/
      ws/
      compiler/
    Cargo.toml
  frontend/
    app/
      page.tsx
      create/
      join/
      lobby/
      game/
      meeting/
      vote/
      results/
    components/
    lib/
    package.json
  programs/
    amongsol_staking/
  challenges/
    rust/
      transfer/
      withdraw/
      initialize/
    anchor/
      escrow_release/
```

## Running The Backend

From the repo root:

```bash
cd backend
cargo run
```

The backend listens on:

- HTTP/WebSocket server: `http://localhost:8080`
- WebSocket endpoint: `ws://localhost:8080/ws`

Backend routes used by the frontend:

- `POST /game/create`
- `POST /game/join`
- `GET /ws`

`POST /game/create` accepts:

```json
{
  "wallet": "crew_wallet_or_local_identity",
  "map": "rust"
}
```

Supported map values:

- `rust`
- `anchor`

## Running The Frontend

From the repo root:

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Development Order

Recommended local startup order:

1. Start PostgreSQL.
2. Start the backend.
3. Start the frontend.
4. Open the app in the browser.

## Frontend Scripts

Inside `frontend/`:

- `npm run dev` - start the Next.js development server
- `npm run build` - build the production frontend
- `npm run start` - run the production build
- `npm run lint` - run ESLint

## Backend Notes

- The backend creates the `game_results` table on startup if it does not exist.
- Game rooms are managed in memory for the active server process.
- WebSocket state drives the lobby, game, meeting, vote, and result views.
- Each room stores the selected map, and test execution resolves challenges from `challenges/<map>/<challenge>`.
- Each player must stake before the host can start the room. The default stake is `100_000_000` lamports (`0.1 SOL`).
- Payouts are calculated from the same game winner state: impostor win pays the full pot to the impostor; civilian win splits the pot among non-impostors.
- Real escrow deposits use the `amongsol_staking` Anchor program. Deploy it, set `AMONGSOL_STAKING_PROGRAM_ID` on the backend and `NEXT_PUBLIC_AMONGSOL_STAKING_PROGRAM_ID` on the frontend, then fund players on the same cluster.
- The host initializes the room escrow when staking and later signs the result-screen settlement transaction that releases funds from the program vault to the computed winners.

## Game UI Notes

- Home screen: choose between create and join.
- Create flow: choose Rust or Anchor.
- Join flow: connect a Solana wallet and enter the room code.
- Voting screen: any player can vote any player.
- Result screen: shows the winner state, room code, and SOL payout split.

## Challenge Layout

Every map owns its challenge folders.

Rust challenges live in:

```text
challenges/rust/<challenge_id>/
```

Anchor challenges live in:

```text
challenges/anchor/<challenge_id>/
```

The backend passes both `map_id` and `challenge_id` into the test runner. This keeps Rust-specific work inside the Rust map folder and Anchor-specific work inside the Anchor map folder.

## Troubleshooting

- If the frontend cannot create or join rooms, confirm the backend is running on port `8080`.
- If the backend fails on startup, confirm `DATABASE_URL` points to a reachable PostgreSQL instance.
- If the UI shows stale room state, clear browser storage for the site and reconnect.

## License

No license has been defined for this repository yet.
