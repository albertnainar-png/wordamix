# Difficulty Mode (Easy + Hard)

Selectable modes: **EASY** and **HARD** (Normal and Expert were removed). Config: `DIFFICULTY` in `js/engine.js`; selectable ids = `DIFFICULTY_IDS = ['easy','hard']`, validated server-side with `isDifficulty` (exact lowercase). An internal legacy profile `normal` (shown as **DAILY**) is kept only so the Daily Board generates exactly as before; it is not selectable and the server rejects it.

| | EASY | HARD |
|---|---|---|
| Score multiplier (whole word score) | 1.00x | 1.25x |
| Possible-word list | **WORDS button during the round**, and again on the results screen | **only after the round** (results screen: ALL POSSIBLE WORDS) |
| Planted words | 5,5,4,4,4,4 letters, common words, mostly straight paths | 8,7,6,6,5 letters, zig-zag paths |
| Letter fill | vowel-friendly, few rare letters | more rare letters |
| Accepted board | >=88% of words 3-5 letters, <=50 words of 6+ | >=230 words of 6+, <=40% short words, longest >=9 |
| Search bound | 80 attempts / 220 ms | 150 / 400 ms (falls back to the best valid board) |

## Possible-word list
`WORDS` (Easy only, game screen) opens a scrollable overlay of every word traceable on the board, grouped by length, found words struck through; the timer keeps running. The results screen of every single-player round (and multiplayer results) has ALL POSSIBLE WORDS. The list is computed on the device from the board with the same solver; in multiplayer the board comes from the server, so everyone sees the same list. Android back closes the list first.

## Defaults and migration
Default is Easy. A saved Normal/Expert choice is migrated to Easy on load. Old per-difficulty stats stay in storage but only Easy/Hard are shown. Old Normal best scores remain under the Daily/legacy key.

## Multiplayer
Host picks Easy/Hard when creating the room and may change it in the lobby or before a rematch (`create{difficulty}`, `setdiff{difficulty}`; missing = easy, invalid/normal/expert = `bad_difficulty`). The server stores it, builds the board and scores with it, and ignores anything a client sends about difficulty, seed, letters or score.

## Scoring
`points = round((base + combo + special) x multiplier)`; `ScoreManager(dm)` returns `{base, comboBonus, special, subtotal, diffMult, points}`.

## Tests
`npm test` (engine 16, multiplayer 14 groups, difficulty 10, multiplayer-difficulty 9) and `npm run test:ui` (two jsdom flows incl. the word list). Also checked by hand in real Chromium (mobile touch emulation): drags on both modes, WORDS panel scroll, Hard hides the button. Not tested: a physical device or the Android APK.
