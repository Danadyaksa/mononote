# Mononote

Minimalist, sleek desktop notepad built with **Tauri v2 (Rust)**, **React**, **TypeScript**, and **TipTap** — inspired by the clean typography and instant capture flow of Apple Notes.

## Features

- **First-Line Automatic Title:** The first block of every note acts as the title (`24px`), flowing directly into comfortable body copy (`16px`, `1.65` line-height, `65ch` reading width).
- **Essential Formatting Only:** Bold (`Ctrl+B`), Italic (`Ctrl+I`), Bullet List, and interactive Checklists — no folders, slash-menus, or visual clutter.
- **Pin to Screen (Always-on-Top + Focus Mode):** Lock the window above other apps with one click; the sidebar automatically collapses into a single-note focus card (toggleable anytime via `Ctrl+\`).
- **Warm Light & Sleek Dark Themes:** Paper-warm light palette (`#FAF9F6`) and soft graphite dark palette (`#18181A`) designed for low eye strain.
- **Atomic Local Storage:** Notes are saved locally in `AppData` as individual JSON files via Rust atomic writes (`.tmp` + `sync_all` + `rename`) with `300ms` auto-save and instant flush on note switch or window close.

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + N` | Create new note |
| `Ctrl + \` | Toggle sidebar |
| `Ctrl + F` | Search notes |
| `Ctrl + B` | Bold text |
| `Ctrl + I` | Italic text |

## Development & Build

```bash
# Install dependencies
npm install

# Run in development mode (Vite + Tauri desktop window)
npm run tauri dev

# Run frontend & Rust unit tests
npm test
cd src-tauri && cargo test

# Build optimized Windows NSIS installer (~2 MB)
npx tauri build --bundles nsis
```
