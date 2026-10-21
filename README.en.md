<div align="center">

# dsh-immersion-glow

**A quiet time-awareness companion for DeepSeek Harness.**
It breathes in the corner; when you have sat too long, it says one thing: step away.

[![npm version](https://img.shields.io/badge/npm-0.1.2-c9a24b)](https://www.npmjs.com/package/dsh-immersion-glow)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-green.svg)](https://nodejs.org)
[![tests](https://img.shields.io/badge/tests-288%20passing-brightgreen)](test/)

**Zero network.** No requests, no telemetry, no account. Everything lives in one `localStorage` key.

[中文说明](README.md) · [Design](docs/DESIGN.md) · [Limitations](docs/known-limitations.md) · [Decisions](docs/ADR.md)

</div>

---

## Screenshots

| Reading | At a threshold | Record | Summary |
| --- | --- | --- | --- |
| ![](https://raw.githubusercontent.com/baobao1994/dsh-immersion-glow/main/docs/img/reading-light.png) | ![](https://raw.githubusercontent.com/baobao1994/dsh-immersion-glow/main/docs/img/alert-light.png) | ![](https://raw.githubusercontent.com/baobao1994/dsh-immersion-glow/main/docs/img/record-light.png) | ![](https://raw.githubusercontent.com/baobao1994/dsh-immersion-glow/main/docs/img/summary-light.png) |

| Detail panel | Settings |
| --- | --- |
| ![](https://raw.githubusercontent.com/baobao1994/dsh-immersion-glow/main/docs/img/panel-light.png) | ![](https://raw.githubusercontent.com/baobao1994/dsh-immersion-glow/main/docs/img/settings-light.png) |

---

## What it does

**Nothing before you ask.** The reading does not appear until this session has actually sent a
request. Open a session, browse, think — the corner stays clean. Set the thresholds to empty and
nothing shows either; the thresholds you set are the switch.

**A reading, not a decoration.** A small breathing ember below the title bar (position measured,
never hard-coded, so it never covers the host's buttons):

```
● 14 min · next reminder in 6 min
```

One number — the session's net active time, ticking every second, not the model's inference time —
and one sentence about it. The ember breathes every 5 seconds (12 breaths a minute); the halo
widens as you approach the next threshold, and that halo is the only progress signal. **No ring**: a
ring reads as completion, and this is about rest.

**At each threshold the ember stops breathing.** At 20 / 40 / 60 minutes of active time the
breathing stops and a warm card grows in the same corner:

```
● 40 min · time to step away
Stand up and look at something 6 m away.
[Take a break]  [Later]            42s
```

The line **changes with the hour and rotates**: daytime asks you to stand up, late night tells you to
stop — "Stop here. The screen will wait until tomorrow." Within a bucket it rotates by reminder count,
so two consecutive alerts never say the same thing. The heading stays fixed: it is the product's
signature, not copy.

The primary action is **Take a break**, not "show me the numbers". Taking it starts a 20-second rest
(a slower 7-second exhale). Later dismisses without interrupting. Miss it and the ember stays lit.

**It remembers whether the session was worth it.** The record card asks one question — did it get
you there: **yes / mostly / no**. Three states, because "mostly, with some rework" is the common
honest answer. Per model you can leave a five-point rating and a one-line note. **You rate; it never
guesses.**

**Then it only shows evidence.** The summary has three blocks: hit rate across your rated records;
a rest receipt (how often it reminded you, how often you stopped, the longest stop — counted as
**60 seconds with no input**, not button clicks); and "does the long haul pay off?", your records
bucketed by session length (≤30 / 30–60 / >60 min) with a hit rate each.

It gives no ranking and draws no conclusion — it puts time and your own judgement side by side.

---

## Install

> [!IMPORTANT]
> Use the official installer. Do not edit a profile's `package.json` or `node_modules` by hand —
> the desktop build treats them as one atomic transaction.

### Desktop

```bash
# The desktop build must use the CLI bundled inside the app
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop add dsh-immersion-glow
```

### Web

```bash
dsh plugin --profile web add dsh-immersion-glow
```

### From source

```bash
git clone git@github.com:baobao1994/dsh-immersion-glow.git
cd dsh-immersion-glow
npm install && npm run build
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop add "$PWD"
```

**Fully quit and reopen DSH afterwards.** A page refresh is not enough — a new bundle is a
structural change, not a config hot-reload.

Remove:

```bash
"/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh" plugin --profile desktop remove dsh-immersion-glow
```

---

## Privacy

**Zero network.** Settings, records, ratings and the summary live in one `localStorage` key
(`immersion-glow.v1`).

**What it reads:**

- **Structure**: turn and step boundaries, model/provider ids, token counts;
- **The first sentence of your first message**, truncated to 60 characters, used as the task name
  so you can recognise a run later.

**What it does not read**: your follow-ups, the assistant's output, tool arguments.

---

## Settings

A dedicated page: **Settings → Immersion awareness**.

| Setting | Default | Notes |
| --- | --- | --- |
| Enabled | on | Master switch |
| Thresholds | `20, 40, 60` | Comma-separated minutes, 1–6 entries, strictly increasing. **Empty hides the reading entirely.** |
| Idle freeze | 3 min | No input stops the active counter; **exempt while the model is answering** |
| Top-right reading | on | The resident line and its detail panel |

---

## What it will not do

**It does not judge models for you.** The summary shows objective signals — time, first-token
latency, decode speed, turns — plus the long-haul comparison and the rest receipt. The host exposes
no quality signal, so any automatic "which model is better at code" claim would be fiction.

See [known limitations](docs/known-limitations.md).

---

## Development

```bash
npm run build    # inline src/client/*.js into lib/client.js
npm test         # 288 tests
npm run verify   # manifest, patch, locale, zero-network, require whitelist
npm run check    # all of the above
```

Source lives in `src/client/*.js` as plain JS with no imports — modules share one closure and are
inlined in a fixed order by `tools/build-client.mjs`. Adding a module means registering it in
`MODULES`; `npm run verify` fails if you forget.

### Publishing

```bash
npm login                 # 2FA required
npm run check
npm publish               # publishConfig.access = public
```

`files` ships only `lib`, `locale`, `cordis.patch.yml`, both READMEs and `docs/img` — source,
tests and design docs stay in the repo.

---

## Requirements

| Item | Value |
| --- | --- |
| DeepSeek Harness | `0.2.0-rc.2` (verified) |
| Cordis | `4.0.4` |
| Node | `>=20` |
| Platform | Desktop and Web profiles |

---

## License

MIT
