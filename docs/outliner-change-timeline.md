# Reflect Outliner changes

Major changes on `codex/outliner-foundation`, excluding upstream merges:

- **Outliner editor:** Note bodies are nested Markdown bullets with
  outline-aware keyboard behavior, durable empty bullets, nesting guides, and
  regular-note titles kept outside the outline.
  ([foundation](https://github.com/erinc/reflect-open-outliner/commit/190332f2),
  [behavior](https://github.com/erinc/reflect-open-outliner/commit/2e2c5fa3),
  [guides](https://github.com/erinc/reflect-open-outliner/commit/26a33c19),
  [titles](https://github.com/erinc/reflect-open-outliner/commit/d8bfc5af))
- **Focused outlines:** Any item can become a session-local focused view with
  ancestor breadcrumbs and keyboard navigation back to the full note.
  ([commit](https://github.com/erinc/reflect-open-outliner/commit/031dec77))
- **Dedicated desktop app:** Reflect Outliner installs separately with its own
  app identity and development and build commands.
  ([commit](https://github.com/erinc/reflect-open-outliner/commit/eeb8fa7c))
- **Simpler interface:** Removed desktop audio capture, sidebar search, and
  visible shortcut hints.
  ([audio](https://github.com/erinc/reflect-open-outliner/commit/00e1e78a),
  [search](https://github.com/erinc/reflect-open-outliner/commit/f0db02cf),
  [hints](https://github.com/erinc/reflect-open-outliner/commit/d07e90e4))
- **Wiki links:** Path-qualified wiki links remain readable in suggestions and
  search results.
  ([commit](https://github.com/erinc/reflect-open-outliner/commit/f6df2ef3))
- **Calendar:** All-day Apple Calendar events appear in the daily context
  sidebar.
  ([commit](https://github.com/erinc/reflect-open-outliner/commit/8e4b72dc))
- **Fork isolation:** Outliner work stays on its maintained product branch, and
  only the `erinc` fork may be changed.
  ([workflow](https://github.com/erinc/reflect-open-outliner/commit/3ba0dbbe),
  [safeguards](https://github.com/erinc/reflect-open-outliner/commit/fa8e63cf))
