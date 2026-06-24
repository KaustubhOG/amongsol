# AmongSol

AmongSol is a multiplayer social-deduction coding game inspired by Among Us.
Players join a room, edit Rust code together, run tests, call meetings, and vote out the impostor before the round ends.

## What The Project Contains

- `frontend/` - Next.js UI for the home screen, lobby, code room, meeting flow, voting, and results.
- `backend/` - Axum + WebSocket game server that manages rooms, players, rounds, voting, and game state.
- `challenges/transfer/` - Rust challenge crate used by the code room gameplay.

## Core Flow

1. Open the home screen.
2. Create a room or join an existing room code.
3. If creating, choose the map. Right now the only available map is Rust.
4. Enter the lobby and wait for players.
5. Start the round.
6. Edit code in the code room, run tests, and call a meeting when needed.
7. Vote during the emergency meeting.
8. View the result screen and return home.

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
```

You can place that in a backend `.env` file or export it in your shell before running the server.

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
  challenges/
    transfer/
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

## Game UI Notes

- Home screen: choose between create and join.
- Create flow: choose the Rust map.
- Join flow: enter the room code only.
- Voting screen: any player can vote any player.
- Result screen: shows only the winner state and room code.

## Troubleshooting

- If the frontend cannot create or join rooms, confirm the backend is running on port `8080`.
- If the backend fails on startup, confirm `DATABASE_URL` points to a reachable PostgreSQL instance.
- If the UI shows stale room state, clear browser storage for the site and reconnect.

## License

No license has been defined for this repository yet.
