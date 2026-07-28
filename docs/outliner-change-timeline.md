# Outliner change timeline

Major changes made on `codex/outliner-foundation`, excluding changes merged
from upstream.

## July 27, 2026

- Added the Outliner foundation: note bodies are normalized into nested
  Markdown bullets, with outline-aware Enter, Tab, Shift-Tab, and Backspace
  behavior. Empty bullets are preserved and outline guides show nesting.
  ([foundation](https://github.com/erinc/reflect-open-outliner/commit/190332f2),
  [keyboard behavior](https://github.com/erinc/reflect-open-outliner/commit/2e2c5fa3),
  [empty bullets and guides](https://github.com/erinc/reflect-open-outliner/commit/26a33c19))
- Added a separately installable **Reflect Outliner** desktop flavor with its
  own app identity and development and build commands.
  ([commit](https://github.com/erinc/reflect-open-outliner/commit/eeb8fa7c))
- Added session-local focus for any outline item, including ancestor
  breadcrumbs and keyboard navigation back to the full note.
  ([commit](https://github.com/erinc/reflect-open-outliner/commit/031dec77))
- Made path-qualified wiki links readable in suggestions and search results.
  ([commit](https://github.com/erinc/reflect-open-outliner/commit/f6df2ef3))
- Added all-day Apple Calendar events to the daily context sidebar.
  ([commit](https://github.com/erinc/reflect-open-outliner/commit/8e4b72dc))
- Established the fork workflow that keeps `master` as an upstream mirror and
  Outliner work isolated on its maintained product branch.
  ([commit](https://github.com/erinc/reflect-open-outliner/commit/3ba0dbbe))

## July 28, 2026

- Kept a new regular note's title outside the outline while preserving the
  outline invariant for its body.
  ([commit](https://github.com/erinc/reflect-open-outliner/commit/d8bfc5af))
- Simplified the desktop interface by removing the audio memo button, sidebar
  search, and visible keyboard-shortcut hints.
  ([audio memo](https://github.com/erinc/reflect-open-outliner/commit/00e1e78a),
  [sidebar search](https://github.com/erinc/reflect-open-outliner/commit/f0db02cf),
  [shortcut hints](https://github.com/erinc/reflect-open-outliner/commit/d07e90e4))
- Tightened repository safeguards so only the `erinc` fork can be changed.
  ([commit](https://github.com/erinc/reflect-open-outliner/commit/fa8e63cf))
