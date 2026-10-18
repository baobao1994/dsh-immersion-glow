# dsh-immersion-glow

A quiet time-awareness companion for DeepSeek Harness sessions. After a stretch of active work
it puts a small reminder card in the top-right corner that points you at this session's stats,
and hands that stretch back to you as a keepable record card when you choose to stop.

**Zero network. Nothing leaves this machine.**

[中文说明](README.zh.md) · [Known limitations](docs/known-limitations.md) · [Decisions](docs/ADR.md)

---

## Install

```sh
D="/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh"
"$D" plugin --profile desktop add /absolute/path/to/dsh-immersion-glow
```

**Then fully quit and reopen DSH.** A page refresh is not enough — a new bundle is a structural
change, not a config hot-reload.

To remove:

```sh
"$D" plugin --profile desktop remove dsh-immersion-glow
```

---

## What it does

**A card, not a decoration.** At 20 / 40 / 60 minutes of *active* time a reminder card appears in
the top-right corner and starts a 60-second countdown. It never blocks input, never takes focus,
never makes a sound. Click it to open the record card; click `×` to dismiss. After the last
threshold it keeps going at that step (80 / 100 / …) for as long as the stretch lasts.

**If you don't click, it leaves an unread badge.** A threshold reminder that times out without a
click shrinks to a small unread badge that stays until you open it. Confirmations ("Kept",
"Stats copied") use the same card without the badge — they simply fade out.

**The record card is the payoff.** It shows how long this stretch has been, how many
conversation turns and tool calls happened, and a time-of-day tag (Morning / Late night /
Long run / Fragment). Keep it if you want; kept records live in a gallery you can prune from the
settings row.

**Everything is local.** Settings, counts and the gallery live in one `localStorage` key
(`immersion-glow.v1`). There is no request, no telemetry endpoint, no account. The only way data
leaves is if *you* press "Copy stats" and paste it somewhere.

---

## What it will not do

- It does not read your message content. The probe only counts structural facts
  (turn numbers, `callId`s) and never touches text.
- It does not lock the screen, pause input, or force a break. You can always ignore it.
- It does not count idle time. Thirty minutes with no input is not thirty minutes of focus.

Full list in [known limitations](docs/known-limitations.md).

---

## Settings

`Settings → General` gets one row:

| Setting | Default | Notes |
|---|---|---|
| Enabled | on | Master switch |
| Thresholds | `20, 40, 60` | Comma separated minutes, strictly increasing, 1–6 entries |
| Idle freeze | 3 min | Time without input stops the counter |
| Show duration in composer | off | A tiny resident timer, off by default to stay quiet |
| — | — | “Cued N times · you opened it M times”, plus **Copy stats** and **Clear data** |

---

## Install requirements

| Item | Value |
|---|---|
| DeepSeek Harness | `0.2.0-rc.2` (verified against) |
| Cordis | `4.0.4` |
| Platform | Desktop and Web profiles |

`peerDependencies` are declared `optional` and pinned to the versions above. The PRD originally
asked for `0.1.0-rc.6`; that range does not satisfy the installed `0.1.1-rc.2` prerelease tuple,
so it would fail to install. See [ADR-102](docs/ADR.md).

---

## Development

```sh
npm run build    # inline src/client/*.js into lib/client.js
npm test         # 69 tests: timing, metrics, state, bundle load contract
npm run verify   # manifest, patch, locale, zero-network, require whitelist, sandbox
npm run check    # all of the above
```

Source lives in `src/client/*.js` as plain JS with no imports — modules share one closure and
are inlined in a fixed order by `tools/build-client.mjs`. This is deliberate: DSH's browser
plugin protocol only requires `window.__ModuleLoader__.load({ id, factory })` with a
single-argument `factory(require)`, and hand-written bundles are proven in production here
(see `dsh-trae-checkin`). It keeps the build at zero dependencies and lets tests evaluate source
files directly.

Adding a module means registering it in `MODULES` inside `tools/build-client.mjs`;
`npm run verify` fails if you forget.

Architecture notes, including three implementation-level corrections to the PRD that were
required to make the plugin load at all, are in [docs/ADR.md](docs/ADR.md).

---

## License

MIT
