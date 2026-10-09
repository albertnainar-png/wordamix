# WORDAMIX
Mobile-first timed word game. Drag across adjacent letters (8 directions, turn anywhere, no tile reuse).

## Run locally
`python3 -m http.server 8000` then open http://localhost:8000 (the full dictionary loads via fetch, so use a server; double-clicking index.html still plays with a small built-in word list).

## GitHub Pages
Push to `main`; the included workflow `.github/workflows/pages.yml` deploys. In Settings > Pages choose "GitHub Actions". All paths are relative, so project sub-paths work.

## Layout
`index.html` (UI, SelectionManager pointer engine, AudioManager, StorageManager, game state) · `js/engine.js` (DictionaryManager, BoardManager, ScoreManager; pure logic) · `data/dictionary.txt` (44,870 everyday words, used for board targets; Ubuntu `wamerican`/SCOWL) + `data/dictionary-large.txt` (~270k accepted words, 3-12 letters; npm `word-list`, MIT) · `sw.js` offline cache · `tests/engine.test.js` (`node tests/engine.test.js`) · `original/` untouched copy of the first version.

## Changelog
- Replaced the selection engine: pointer capture, coalesced events, interpolated sampling so fast swipes cannot skip tiles, circular tile hit areas for clean diagonals, pointercancel cancels without scoring, other fingers ignored, page scroll/selection/context menu blocked.
- 44k-word local dictionary + built-in fallback; loads in the background.
- Boards: target words are placed first, rest filled with weighted letters (no Q), then solved and accepted only if many words and no dead tiles.
- Exact path validation, scoring table, combo, LONG / PERFECT / COMBO MASTER / WORD HUNTER bonuses.
- States, 60s timer, pause (auto-pauses when tab hidden), shuffle that keeps the best of many rearrangements, results screen, home/how-to/settings, localStorage, Web Audio, vibration, keyboard play (arrows + Space + Enter, or just type), reduced motion, PWA + service worker.

## Tests performed
Automated (Node, passing): adjacency, direction changes, tile reuse, non-adjacent rejection, horizontal/vertical/diagonal paths, 12 required words in dictionary, 100 generated boards (targets traceable, no Q, 75+ words each, ~7 ms), shuffle, lite-dictionary fallback, scoring/combo/bonuses.
Audit finding: of the 12 required words, TEAM was not traceable on any of the 4 original boards; the other 11 were.

## Limitations
- NOT tested in a real browser or on a real Android device (none available here). Touch, mouse, audio, vibration, pause, layout at 360/390/412 px, and the service worker are untested. Please try it on your phone.
- Dragging back over the previous tile does not undo it (reuse is rejected, as specified).
- Dictionary has no frequency ranking, so some uncommon words are accepted. Small profanity blocklist only.
- No PNG icons (SVG only); no pre-round countdown; no dedicated animated how-to demo.

## v3 additions
Rare-word bonus (+15, words outside the 45k everyday list), Daily Board (same board for everyone each local date) with Share, optional drag-back undo (Settings), 3-2-1 pre-round countdown, stats in Settings, PNG icons. Not done: special tiles, 4x4/6x6 modes, real-device testing.

## v4
Special tiles: one ×3 and two ×2 tiles per board multiply a word's base score (highest tile in the path counts).

## v5
Settings > Round length: 1, 2, 3 or 5 minutes. Best score is tracked separately per round length.

## v6 Learning topics
Pick a topic on the home screen (HR, Recruitment, Claude, Copilot, Business Analytics). Boards hide that topic's terms; finding one gives +20 and shows its meaning; the results screen lists terms you missed. Add or edit packs in `js/topics.js`. Terms are written by hand: please review them for accuracy.

## v7
Topics now: HR, Recruitment, Claude, Copilot, Business Analytics, Finance, Project Management, Marketing, AI and Machine Learning, Cybersecurity, Excel, Leadership, Sales.

## Android app
See `docs/ANDROID.md` (Capacitor project in `android/`).

## Multiplayer
See `docs/MULTIPLAYER.md` (server in `server/`, client in `js/multiplayer.js`). Single-player works without it.

## Difficulty
Easy and Hard (Easy shows the possible-word list during play, Hard after the round), single-player and multiplayer. See `docs/DIFFICULTY.md`.
