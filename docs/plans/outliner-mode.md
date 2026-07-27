# Reflect Outliner Mode

## Goal

Make Reflect a true outliner while preserving its daily-note-first, local-first,
Markdown-backed model.

Every editable body block is an outline item. Plain paragraphs cannot exist
outside an item. Items nest without a depth limit, move with their descendants,
fold as one subtree, and can eventually become the root of a focused view.

Regular-note titles remain the one temporary exception: the first H1 is the
note title and stays outside the outline. Daily-note dates already live outside
the editor.

## Product contract

- Enter in a non-empty item creates a sibling at the same depth.
- Tab indents an item one level beneath its previous sibling. It is a no-op
  when no sibling precedes the item at its current depth, preventing repeated
  indentation beneath the same parent.
- Shift-Tab outdents an item, but never unwraps a root item into a paragraph.
- Enter in an empty nested item outdents it.
- Enter in an empty root item is a no-op.
- Backspace in an empty item removes it and moves the caret to the end of the
  previous visible item. The first root item remains as the active typing
  target when no previous item exists.
- An empty item may exist only as the active typing target. Empty items that the
  caret leaves are removed and are never persisted as blank content.
- Import, paste, templates, AI replacements, attachments, block-handle actions,
  and programmatic insertion all pass through the same outline invariant.
- Folding and movement operate on the selected item and its complete descendant
  subtree.
- Formatting changes an item's presentation; it never destroys the item's
  outline identity.
- Focusing an item renders that item and its descendants as the active view,
  with ancestor breadcrumbs for zooming back out.

## Data and Markdown contract

Markdown remains the source of truth. Outline hierarchy uses ordinary nested
Markdown lists:

```markdown
- Parent
  - Child
  - Another child
- Sibling
```

The editor may hold one transient empty list item for the caret, but empty items
and paragraph-only gap blocks are not durable content.

Block identity must be designed before persistent folding and zoom URLs ship.
ProseMirror positions and text hashes are not durable identities: edits, moves,
external changes, and sync can all invalidate them. The identity representation
must remain portable in Markdown and survive reordering. SQLite may project
block identities, but it cannot be their only source because the database is
rebuildable.

The current `+` marker encoding for a collapsed bullet is useful compatibility,
but it is not the final folding contract: task, numbered, and visually formatted
items must be foldable without changing their semantic kind.

## Architecture

### Editor engine

The long-term editor API should expose one explicit `outlineMode`, ideally from
Meowdown. It owns:

- the document-shape invariant;
- root Enter/outdent guards;
- normalization of pasted and programmatically inserted blocks;
- outline-aware list-type commands;
- subtree move and fold behavior;
- empty-item pruning;
- selection preservation through normalization.

Reflect initially installs this behavior through Meowdown's documented child
extension seam. Generic behavior should be proposed upstream to Meowdown so the
Reflect integration can shrink to enabling a supported option.

### Reflect integration

Reflect owns:

- the regular-note title exception and daily-note framing;
- migration of existing Markdown;
- automatic writers and capture flows;
- stable block identity and Markdown representation;
- block routes, focused views, and breadcrumbs;
- compatibility checks and protected/read-only behavior.

The note session remains a persistence pipeline. It should receive already-valid
outline Markdown rather than trying to repair arbitrary editor output while
saving.

## Implementation phases

### Phase 1 — Outline invariant

- Add an editor extension that wraps top-level body blocks as bullet items.
- Preserve the first regular-note H1 as the title.
- Remove unselected empty items and empty paragraph gap blocks.
- Prevent Enter and outdent from creating a root paragraph.
- Prevent the bullet-format action from unwrapping a bullet.
- Apply the invariant to initial content, external reloads, paste, templates,
  AI replacements, attachments, and block-handle insertion.
- Remove the optional "Start with a bullet" and "Bullet after a heading"
  settings after the invariant fully supersedes them.

### Phase 2 — Canonical writers and migration

- Change note creation, capture, meeting, audio, contact, deep-link, and template
  writers to emit outline-valid Markdown directly.
- Build an explicit, previewable migration for existing notes.
- Keep unsupported or lossy Markdown protected rather than silently rewriting
  it.
- Preserve frontmatter, line endings, links, tasks, attachments, and the title
  H1.

### Phase 3 — Durable block identity

- Choose a portable Markdown representation for stable block IDs.
- Parse, validate, generate, and repair duplicate IDs locally.
- Project block IDs and ancestry into the rebuildable index.
- Preserve IDs through editing, movement, sync, import, and conflict resolution.
- Add block-link resolution without weakening `private: true`.

### Phase 4 — Folding

- Make every item with descendants foldable, independent of task/list/heading
  presentation.
- Fold and unfold complete subtrees from pointer and keyboard controls.
- Persist fold state through the block identity contract.
- Add expand/collapse-all operations and verify keyboard and touch parity.

### Phase 5 — Focus and zoom

- Route to a note plus block ID.
- Render the focused block as the view subject and only its descendants as the
  editable outline.
- Show ancestor breadcrumbs and support zoom-out/history navigation.
- Keep edits in the original note document; focused views are projections, not
  copied notes.
- Make backlinks, search results, tasks, and block links open the correct focus
  target.

## Compatibility and tests

The outliner suite is the contract used to detect upstream regressions:

- Enter at start, middle, and end of an item.
- Enter on empty nested and root items.
- Tab/Shift-Tab at every depth.
- Backspace/Delete around item boundaries.
- Multi-item selection, indent, outdent, and subtree movement.
- Plain text, Markdown, rich HTML, template, attachment, and AI insertion.
- Empty-note and title-only-note lazy creation.
- External reload and sync conflict behavior.
- Folding for bullets, tasks, numbered items, and formatted items.
- Desktop Chromium, desktop WebKit, and the iOS touch surface.
- Markdown round-trip and migration fixtures.

`pnpm check` and focused Vitest browser/node suites must pass before an outliner
change is published.

## Running the foundation

The dedicated desktop flavor enables the outline invariant automatically and
installs as **Reflect Outliner**, with the distinct bundle identifier
`app.reflect.desktop.outliner`. Run it from source with:

```bash
pnpm outliner:dev
```

Build a local macOS application bundle with:

```bash
pnpm outliner:build
```

The bundle is written to:

```text
target/release/bundle/macos/Reflect Outliner.app
```

Copy that application to `/Applications` to install it. Local builds are not
notarized, so macOS may require right-clicking the app and choosing **Open** the
first time.

Use a disposable or backed-up graph. Editing an existing note can normalize its
body into outline items and persist that Markdown. Daily notes outline the
entire editor body; regular notes preserve their first H1 as the title.

Reflect Outliner uses a distinct app identifier, window title, deep-link scheme,
and fork-local no-op updater endpoint, so it can coexist with Reflect without
being replaced by an original-author update. Graph files, settings, recent
graphs, and keychain entries remain intentionally compatible with Reflect.

This foundation includes the document invariant and core keyboard guards. It
does not yet include persistent folding, block identity, focus/zoom, or the
previewable graph migration.

## Maintaining the fork

This checkout uses:

- `origin`: `git@github.com:erinc/reflect-open-outliner.git`
- `upstream`: fetches `git@github.com:team-reflect/reflect-open.git`, with its
  push URL disabled
- `master`: a clean branch tracking `upstream/master`
- `codex/outliner-*`: scoped implementation branches

All outliner pull requests target `erinc/reflect-open-outliner:master`. Never
push a branch or open an outliner pull request against
`team-reflect/reflect-open`.

Update the mirror and merge it into an outliner branch:

```bash
git fetch upstream
git switch master
git merge --ff-only upstream/master
git push origin master
git switch codex/outliner-foundation
git merge master
pnpm check
pnpm test --run <focused-tests>
```

Enable Git's recorded conflict resolution for recurring upstream merges:

```bash
git config rerere.enabled true
git config rerere.autoupdate true
```

Upstream synchronization should arrive through a reviewed pull request inside
the outliner fork, targeting `erinc/reflect-open-outliner:master`, with all
outliner tests. It must not auto-merge merely because Git reports no textual
conflicts; editor semantics can regress in a clean merge.

Generic Meowdown changes should be contributed to
`github.com/prosekit/meowdown`. If they cannot be upstreamed, maintain a small
Meowdown fork with its own `origin`/`upstream` remotes and pinned releases.
Never patch installed `node_modules`.
