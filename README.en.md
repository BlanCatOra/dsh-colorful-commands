# dsh-colorful-commands

[中文](README.md) | English

Color the DeepSeek Harness interface **by category**: thinking, commands (**graded by risk**), file reads, writes, search, web requests, other tools. Interface controls near the composer (permission select, plan mode) can be colored separately, and the permission select **recolors itself per access level**.

Ships with three preset palettes — **Chinese traditional (default)**, **Japanese traditional**, and **Macaron** — and lets you set every category by hand, with separate colors for light and dark themes.

---

## What it colors

| Category | Target |
|---|---|
| Thinking / reasoning | Reasoning rows (`data-variant="think"`) |
| Commands | `bash` / `pwsh` |
| **Command · low/medium/high risk** | `bash` / `pwsh` rows, graded by a risk word list over the command text |
| **Model request retry** | the retry row (`_retryRow`) |
| File reads | `read` / `read_image` |
| Writes / edits | `write` / `edit` / `run_code` |
| Search | `grep` / `glob` (local search) |
| Web requests | `web_search` / `web_fetch` |
| Other tools | Anything unclassified |
| User / assistant | User and assistant blocks in the message flow |

Controls: **permission select**, **model select**, **plan mode**, **activity bar**, **composer toolbar**.

## How it colors

A **2px left stripe plus header text and icon color** — never the background. Background tinting fights the host's own hover/selected states and reads as noise in a long session.

Expanded command output, diffs, and file contents are **not** tinted: color applies to the collapsed header only, so the body keeps the native palette. This is deliberate — coloring large bodies badly hurts readability.

## Install

Desktop (DeepSeek Harness Desktop): **Settings → Plugins → Add plugin**, enter `dsh-colorful-commands`, then restart the app.

Web / CLI profile:

```sh
dsh plugin --profile web add dsh-colorful-commands
```

From source:

```sh
git clone <this repo>
cd dsh-colorful-commands
dsh plugin --profile desktop add link:.
```

## Where to configure

**Sidebar → Plugins → find "Colorful Commands" → configure there.**

Per DSH convention, a plugin's own settings live on its **plugin detail page**, not in Settings (Settings keeps a read-only plugin list).

The card lets you:

- toggle coloring on/off (off restores the native palette immediately, settings are kept);
- pick a preset (Chinese traditional [default] / Japanese traditional / Macaron / none);
- set each category: **color picker**, **hex input** (`#RGB` / `#RRGGBB`), **palette swatches**;
- set light and dark themes **separately**;
- see a **live preview** — the preview runs the same stylesheet generator as the real thing, so it cannot disagree with the result.

Edits stay in a draft until you press **Save**.

## Permissions

**None required.** This plugin:

- reads and writes no files;
- makes no network requests;
- registers no HTTP routes;
- never executes, blocks, or modifies any command — "dangerous command" is purely a color decision, and getting it wrong only affects color.

The Host side does one thing: declare the settings schema. All coloring happens in the browser.

## Known limitations

- Coloring relies on the stable `data-*` attributes DSH exposes (`data-tool` / `data-variant` / `data-kind` / `data-chat-flow-kind` / `data-slot`). If a major DSH upgrade changes them, update `src/classify.js` — that file is the single mapping point and is covered by tests.
- No corner radius, font, or animation changes — those belong to the DSH theme itself, not this plugin.
- Dangerous-command detection is **keyword matching**, not a command parser; it exists only as a visual hint.

## Development

```sh
npm run build   # generate lib/client.js from src/ (with build-time artifact guards)
npm test        # build, then run the full suite
```

`lib/client.js` is generated — **do not edit it by hand**. Rebuild after changing `src/`.

## License

MIT
