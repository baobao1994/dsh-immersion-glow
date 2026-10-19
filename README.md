# dsh-immersion-glow

A quiet companion for DeepSeek Harness sessions. Once you actually send a request, it puts a
small resident reading in the top-right corner showing which model is running and how long it has
taken. At each threshold it reminds you to look back, and you can record whether the task actually
got you there and how useful each model felt.

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

**Nothing before you ask.** The reading does not appear until this session has actually sent a
request. Open a session, browse, think — the corner stays clean. Set the thresholds to empty and
nothing shows either; the thresholds you set are the switch.

**A reading, not a decoration.** A small ring just below the title bar (measured, never
hard-coded, so it never covers the host's buttons): the arc shows how far you are into the next
rest threshold, the centre shows the model's time, and the label beside it names the current
model. Click it and the detail panel opens — a bar splitting time by model, model time vs.
tool time, and one line per model carrying the rating and note you gave it last time. It never
blocks input, never takes focus, never makes a sound.

**It knows which model did what.** Each assistant reply is timed with the same rule the host itself
uses (`step/start` → the message completing), and attributed to the model that produced it. Switch
models mid-session and the split follows.

**At each threshold, the ring itself speaks up.** At 20 / 40 / 60 minutes of *active* time the ring
turns amber, a line says so, and a 60-second countdown runs. It is the same component in a
different state — not a second card appearing. If you miss it, the ring stays amber with an unread
dot. Clicking it expands — it already holds everything. The run can then be
kept as a record card, which carries both this run's numbers and your all-time figures.

**Say whether it worked.** The record card asks one question — did it get you there: **yes /
mostly / no**. Three states, not a checkbox, because "mostly, with some rework" is the common
honest answer and a boolean would flatten it. Your answer feeds the summary's hit rate.

**Note which model was good.** Per model you can leave a five-word rating (bad → excellent) and a
line of note. Nothing is inferred for you — see below.

**Everything is local.** Settings, records, ratings and the summary live in one `localStorage` key
(`immersion-glow.v1`). No request, no telemetry endpoint, no account.

---

## What it will not do

**It does not judge models for you.** The summary shows objective signals — time spent, first-token
latency, decode speed, turns. That is all the host measures. There is no quality signal, so any
automatic claim about which model is "better at code" would be fiction. The panel puts the evidence
next to your own ratings and leaves the conclusion to you.

Full list in [known limitations](docs/known-limitations.md).

---

## What it reads

Worth stating plainly, because it changed in this version:

- **Structure**: turn and step boundaries, model/provider ids, token counts.
- **The first sentence of your first message**, truncated to 60 characters, used as the task name so
  you can recognise a run later. Nothing else from your messages is read — not your follow-ups, not
  the assistant's output, not tool arguments.

The previous version promised to never touch message text. Getting a meaningful task name requires
reading that first line, so the promise is now narrower and explicit rather than absolute.

---

## Settings

`Settings → General` gets one row:

| Setting | Default | Notes |
|---|---|---|
| Enabled | on | Master switch |
| Thresholds | `20, 40, 60` | Comma separated minutes, strictly increasing, 1–6 entries. **Empty hides the reading entirely.** |
| Idle freeze | 3 min | Time without input stops the active counter; **exempt while the model is answering** |
| Top-right reading | on | The resident line and its detail panel |
| — | — | Collection + Summary buttons, "Cued N times · you opened it M times", **Copy stats**, **Clear data** |

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
npm test         # 135 tests: timing, metrics, state, model attribution, data flow, bundle contract
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

### How per-model attribution works

The host does not expose a projection that splits time by model, so the plugin derives it from the
chat snapshot: every assistant node is one model call, timed `completedTime - stepStartTime`, and
attributed via the `trajectory` projection's `providerMetadata`. When that projection is
unavailable it falls back to the current model and marks the figure as approximate. It never
guesses.

Architecture notes, including three implementation-level corrections to the PRD that were
required to make the plugin load at all, are in [docs/ADR.md](docs/ADR.md).

---

## License

MIT