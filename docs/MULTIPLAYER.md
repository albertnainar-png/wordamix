# Wordamix Multiplayer v1

## Architecture
- `server/server.js` HTTP (serves the game files, `/health`, `/join/CODE` -> `/?join=CODE`) + WebSocket `/ws` (max message 4 KB, token-bucket rate limit 15 msg/s).
- `server/rooms.js` RoomManager: in-memory rooms, lifecycle, host, reconnect, throttled scoreboard. Transport-agnostic (`conn.send()`), so a store (Redis etc.) can be added later behind the same Map.
- `server/game.js` loads dictionaries, builds the board from a server seed using the unchanged `js/engine.js`, and judges every word with `validatePath` + `ScoreManager`.
- `js/multiplayer.js` client layer (screens, socket, lobby, live board, results). `js/mp-config.js` server URL. Hooks in `index.html` are only active when a multiplayer round is running (`mp` variable); single-player code paths are untouched.

## Room lifecycle
LOBBY -> COUNTDOWN (server startAt) -> PLAYING -> COMPLETE -> (host start) COUNTDOWN ... ; CLOSED by host (or when everyone has left / idle 5 min). Joining is allowed in LOBBY/COMPLETE only.

## Protocol (JSON; client -> server)
`{t:'create',name,difficulty?}` · `{t:'setdiff',difficulty}` (host, lobby/after round) · `{t:'join',code,name}` · `{t:'join',code,pid,token}` (reconnect) · `{t:'start'}` (host; also rematch) · `{t:'word',gid,path:[tile indexes]}` · `{t:'leave'}` · `{t:'close'}` (host) · `{t:'ping'}`
Server -> client: `joined{code,pid,token,host,status,players,now}` · `players{host,players:[[id,name,online]]}` · `game{gid,letters,bonus,startAt,endAt,duration,now,you:{score,combo,found}}` · `result{gid,kind,word,points,total,combo,tags}` · `scores{top:[[id,name,score]],n}` (only when changed, <= every 700 ms, top 10) · `end{gid,top:[[id,name,score,words,bestCombo]],n,you:{rank,...}}` · `settings{difficulty}` · `closed` · `error{code,msg}` (`joined`, `game`, `end` also carry `difficulty`; `game` carries `mult`) · `pong`
Error codes: bad_difficulty, room_not_found, in_progress, closed, full, bad_name, bad_msg, not_host, bad_state, not_in_room, rate_limited.

## Server authority / anti-cheat foundation
The client sends only the tile path. The server validates path (indexes, adjacency, no reuse), word (dictionary), duplicates, tile multipliers, rare bonus, combo and score, and only accepts words between server startAt and endAt+800 ms for the current game id. The client's displayed score is whatever the server returns. Timing uses server timestamps (`now` offset), so everyone starts on the same server clock. Future: per-word timing/rate analysis, signed reconnect tokens, replay logs.

## Security
Strict message validation, 4 KB cap, binary rejected, rate limiting + disconnect on abuse, names normalised to letters/digits/space/_ . - (max 16) and rendered with textContent only, no eval/innerHTML for player data, random 64-bit player ids + 128-bit reconnect tokens, 5-char codes from an unambiguous alphabet with uniqueness check, static file whitelist (server code and node_modules are never served), optional `ALLOWED_ORIGINS`, no secrets in the browser. Limits: `MAX_PLAYERS` (default 200), max rooms 1000.

## Run
```
npm install
npm run server            # http://localhost:8080  (PORT, MAX_PLAYERS, ALLOWED_ORIGINS env vars)
```
Open http://localhost:8080 in two browsers (or one normal + one private window): Multiplayer -> Create room; second window: Multiplayer -> enter the code -> Join; host presses START GAME. On a phone on the same Wi-Fi use http://<computer-ip>:8080.
Tests: `npm test` (engine + 14 multiplayer groups incl. 10 simulated players), `npm run test:ui` (two simulated browsers drive the real page).

## Production
Needs a Node host with WebSocket support behind HTTPS/WSS (Render, Fly.io, Railway, a VPS + Caddy/nginx with `Upgrade` headers), gzip for `data/dictionary-large.txt`, `ALLOWED_ORIGINS` set, process restarts (rooms are in memory and are lost on restart). For GitHub Pages or the Android app edit `js/mp-config.js`: `{server:'wss://your-host/ws', web:'https://your-pages-url/'}` (Android needs wss; cleartext ws is blocked). Run a single server instance (no shared state yet).

## Limitations
Shuffle and Pause are disabled in multiplayer (fairness + server validation). Topics and Daily Board are single-player only. Touch/drag in multiplayer reuses the single-player engine but was not run on a physical device. Room lists are re-broadcast on every join (fine for dozens of players; very large rooms would need diffs). Clock sync is one-way offset (~latency accurate). No persistent storage, no spectator mode, no chat.
