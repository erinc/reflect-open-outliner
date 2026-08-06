import { useMemo } from 'react'
import { definePlugin } from '@prosekit/core'
import type { Node as ProseMirrorNode } from '@prosekit/pm/model'
import {
  Plugin,
  PluginKey,
  Selection,
  type Command,
  type EditorState,
  type Transaction,
} from '@prosekit/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@prosekit/pm/view'
import { getTextblockDisplayText, Priority } from '@meowdown/core'
import { useExtension, useKeymap } from '@meowdown/react'
import { OUTLINE_FOCUS_BINDING } from '@/editor/keymap'

interface OutlineFocusState {
  readonly position: number | null
}

interface OutlineFocusMeta {
  readonly position: number | null
}

export interface OutlineFocusEntry {
  readonly label: string
  readonly position: number
}

const outlineFocusKey = new PluginKey<OutlineFocusState>('reflect-outline-focus')

function listNodeAt(doc: ProseMirrorNode, position: number): ProseMirrorNode | null {
  const node = doc.nodeAt(position)
  return node?.type.name === 'list' ? node : null
}

function displayLabel(node: ProseMirrorNode): string {
  const content = node.type.name === 'list' ? node.firstChild : node
  if (content === null) {
    return 'Untitled block'
  }
  const text = (content.isTextblock ? getTextblockDisplayText(content) : content.textContent).trim()
  if (text === '') {
    return 'Untitled block'
  }
  return text.length > 48 ? `${text.slice(0, 47)}…` : text
}

function outlineRootLabel(doc: ProseMirrorNode): string {
  for (let index = 0; index < doc.childCount; index += 1) {
    const node = doc.child(index)
    if (node.type.name !== 'heading' || node.attrs['level'] !== 1) {
      continue
    }
    const label = displayLabel(node)
    return label === 'Untitled block' ? 'All blocks' : label
  }
  return 'All blocks'
}

/**
 * Return the focused item path from the root item through the focused item.
 *
 * Positions are editor-session coordinates. They map through local edits but
 * are deliberately not exposed as durable block addresses.
 */
export function outlineFocusEntries(
  doc: ProseMirrorNode,
  focusPosition: number,
): readonly OutlineFocusEntry[] {
  if (listNodeAt(doc, focusPosition) === null) {
    return []
  }

  const inside = doc.resolve(Math.min(focusPosition + 1, doc.content.size))
  const entries: OutlineFocusEntry[] = []
  for (let depth = 1; depth <= inside.depth; depth += 1) {
    const node = inside.node(depth)
    if (node.type.name !== 'list') {
      continue
    }
    const position = inside.before(depth)
    entries.push({ label: displayLabel(node), position })
  }
  return entries.filter((entry) => entry.position <= focusPosition)
}

function nearestListPosition(state: EditorState, position = state.selection.from): number | null {
  const resolved = state.doc.resolve(position)
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    if (resolved.node(depth).type.name === 'list') {
      return resolved.before(depth)
    }
  }
  return null
}

function selectionInsideList(state: EditorState, position: number, node: ProseMirrorNode): boolean {
  return state.selection.from > position && state.selection.to < position + node.nodeSize
}

function selectionAtListEdge(
  doc: ProseMirrorNode,
  position: number,
  direction: -1 | 1,
): Selection | null {
  const node = listNodeAt(doc, position)
  if (node === null) {
    return null
  }
  const boundary = direction > 0 ? position + 1 : position + node.nodeSize - 1
  return Selection.findFrom(doc.resolve(boundary), direction, true)
}

function focusTransaction(state: EditorState, position: number | null): Transaction {
  const transaction = state.tr.setMeta(outlineFocusKey, { position } satisfies OutlineFocusMeta)
  if (position === null) {
    return transaction
  }
  const node = listNodeAt(state.doc, position)
  if (node === null || selectionInsideList(state, position, node)) {
    return transaction
  }
  const selection = selectionAtListEdge(state.doc, position, 1)
  return selection === null ? transaction : transaction.setSelection(selection).scrollIntoView()
}

function dispatchFocus(view: EditorView, position: number | null): void {
  view.dispatch(focusTransaction(view.state, position))
  view.focus()
}

function breadcrumbDom(state: EditorState, position: number): HTMLElement {
  const nav = document.createElement('nav')
  nav.className = 'reflect-outline-breadcrumbs'
  nav.contentEditable = 'false'
  nav.setAttribute('aria-label', 'Focused block path')

  const entries = outlineFocusEntries(state.doc, position)
  const root = document.createElement('button')
  root.type = 'button'
  root.className = 'reflect-outline-breadcrumb'
  root.dataset['outlineFocusRoot'] = ''
  root.textContent = outlineRootLabel(state.doc)
  root.title = 'Show all blocks'
  nav.append(root)

  for (const [index, entry] of entries.entries()) {
    const separator = document.createElement('span')
    separator.className = 'reflect-outline-breadcrumb-separator'
    separator.setAttribute('aria-hidden', 'true')
    separator.textContent = '›'
    nav.append(separator)

    const current = index === entries.length - 1
    const crumb = document.createElement(current ? 'span' : 'button')
    crumb.className = 'reflect-outline-breadcrumb'
    crumb.textContent = entry.label
    if (crumb instanceof HTMLButtonElement) {
      crumb.type = 'button'
      crumb.dataset['outlineFocusPosition'] = String(entry.position)
      crumb.title = `Focus ${entry.label}`
    } else {
      crumb.setAttribute('aria-current', 'page')
    }
    nav.append(crumb)
  }
  return nav
}

function focusDecorations(state: EditorState): DecorationSet {
  const focus = outlineFocusKey.getState(state)
  if (focus?.position === null || focus === undefined) {
    return DecorationSet.empty
  }
  const focusedNode = listNodeAt(state.doc, focus.position)
  if (focusedNode === null) {
    return DecorationSet.empty
  }

  const focusPosition = focus.position
  const entries = outlineFocusEntries(state.doc, focusPosition)
  const decorations: Decoration[] = []
  for (const entry of entries) {
    const node = listNodeAt(state.doc, entry.position)
    if (node === null) {
      continue
    }
    const current = entry.position === focusPosition
    decorations.push(
      Decoration.node(entry.position, entry.position + node.nodeSize, {
        class: current
          ? 'reflect-outline-focus-ancestor reflect-outline-focus-target'
          : 'reflect-outline-focus-ancestor',
      }),
    )
  }
  decorations.push(
    Decoration.widget(0, () => breadcrumbDom(state, focusPosition), {
      key: `reflect-outline-breadcrumbs-${focusPosition}`,
      side: -1,
    }),
  )
  return DecorationSet.create(state.doc, decorations)
}

function focusPositionFromMarker(view: EditorView, event: Event): number | null {
  const target = event.target
  if (!(target instanceof Element)) {
    return null
  }
  const marker = target.closest('.list-marker')
  const item = marker?.closest('.prosemirror-flat-list')
  if (!(marker instanceof HTMLElement) || !(item instanceof HTMLElement)) {
    return null
  }
  // A task's marker is its checkbox. Keep that primary action intact; the
  // keyboard focus command still works for task items.
  if (item.dataset['listKind'] === 'task') {
    return null
  }
  const content = item.querySelector(':scope > .list-content')
  if (!(content instanceof HTMLElement)) {
    return null
  }
  const firstBlock = content.firstElementChild
  if (!(firstBlock instanceof HTMLElement)) {
    return null
  }
  // `posAtDOM(content, 0)` is the list node's outer boundary for a root
  // item, whose resolved depth is the document. Step into the first block so
  // the resolved position carries the item itself in its ancestor chain.
  const domPosition = view.posAtDOM(firstBlock, 0)
  return nearestListPosition(view.state, domPosition)
}

function handleMarkerPointerDown(view: EditorView, event: MouseEvent): boolean {
  if (event.button !== 0 || (!event.metaKey && !event.ctrlKey) || event.shiftKey || event.altKey) {
    return false
  }
  const position = focusPositionFromMarker(view, event)
  if (position === null) {
    return false
  }
  event.preventDefault()
  dispatchFocus(view, position)
  return true
}

function handleBreadcrumbClick(view: EditorView, event: MouseEvent): boolean {
  const target = event.target
  if (!(target instanceof Element)) {
    return false
  }
  const button = target.closest<HTMLButtonElement>('.reflect-outline-breadcrumb')
  if (button === null) {
    return false
  }

  const rawPosition = button.dataset['outlineFocusPosition']
  const position = rawPosition === undefined ? null : Number.parseInt(rawPosition, 10)
  if (position !== null && !Number.isSafeInteger(position)) {
    return false
  }
  event.preventDefault()
  dispatchFocus(view, position)
  return true
}

function createOutlineFocusPlugin(): Plugin<OutlineFocusState> {
  return new Plugin<OutlineFocusState>({
    key: outlineFocusKey,
    state: {
      init: () => ({ position: null }),
      apply: (transaction, value, _oldState, newState) => {
        const meta = transaction.getMeta(outlineFocusKey) as OutlineFocusMeta | undefined
        if (meta !== undefined) {
          return {
            position:
              meta.position === null || listNodeAt(newState.doc, meta.position) !== null
                ? meta.position
                : null,
          }
        }
        if (value.position === null || !transaction.docChanged) {
          return value
        }
        const mapped = transaction.mapping.mapResult(value.position, 1)
        return {
          position:
            !mapped.deleted && listNodeAt(newState.doc, mapped.pos) !== null ? mapped.pos : null,
        }
      },
    },
    props: {
      attributes: (state) =>
        outlineFocusKey.getState(state)?.position === null
          ? {}
          : { 'data-reflect-outline-focus': '' },
      decorations: focusDecorations,
      handleDOMEvents: {
        click: handleBreadcrumbClick,
      },
    },
    view: (view) => {
      // Meowdown owns a bubbling mousedown handler for folding. Focus is the
      // outliner's modified-click action, so claim pointerdown in capture phase
      // before that handler. Plain clicks deliberately fall through to folding.
      let suppressClickThrough = false
      let suppressionTimer: ReturnType<typeof setTimeout> | undefined
      let pointerId: number | null = null
      const clearClickSuppression = (): void => {
        suppressClickThrough = false
        pointerId = null
        if (suppressionTimer !== undefined) {
          clearTimeout(suppressionTimer)
          suppressionTimer = undefined
        }
      }
      const onPointerDown = (event: PointerEvent): void => {
        if (!(event.target instanceof Node) || !view.dom.contains(event.target)) {
          return
        }
        if (handleMarkerPointerDown(view, event)) {
          suppressClickThrough = true
          pointerId = event.pointerId
          event.stopPropagation()
        }
      }
      const onPointerUp = (event: PointerEvent): void => {
        if (event.pointerId !== pointerId) {
          return
        }
        // A click generated from this pointerup is dispatched before the next
        // task. Clear afterward so a drag/no-click cannot suppress a later
        // unrelated click.
        suppressionTimer = setTimeout(clearClickSuppression)
      }
      const onPointerCancel = (event: PointerEvent): void => {
        if (event.pointerId === pointerId) {
          clearClickSuppression()
        }
      }
      const onClick = (event: MouseEvent): void => {
        if (!suppressClickThrough) {
          return
        }
        clearClickSuppression()
        // Focusing inserts breadcrumbs above the item on pointerdown. Without
        // suppressing the paired click, that layout shift can retarget the
        // click to the new root breadcrumb and immediately zoom back out.
        event.preventDefault()
        event.stopPropagation()
      }
      const ownerDocument = view.dom.ownerDocument
      ownerDocument.addEventListener('pointerdown', onPointerDown, {
        capture: true,
      })
      ownerDocument.addEventListener('pointerup', onPointerUp, {
        capture: true,
      })
      ownerDocument.addEventListener('pointercancel', onPointerCancel, {
        capture: true,
      })
      ownerDocument.addEventListener('click', onClick, { capture: true })
      return {
        destroy: () => {
          clearClickSuppression()
          ownerDocument.removeEventListener('pointerdown', onPointerDown, {
            capture: true,
          })
          ownerDocument.removeEventListener('pointerup', onPointerUp, {
            capture: true,
          })
          ownerDocument.removeEventListener('pointercancel', onPointerCancel, {
            capture: true,
          })
          ownerDocument.removeEventListener('click', onClick, {
            capture: true,
          })
        },
      }
    },
    appendTransaction: (_transactions, oldState, newState) => {
      const focus = outlineFocusKey.getState(newState)
      if (focus?.position === null || focus === undefined) {
        return null
      }
      const node = listNodeAt(newState.doc, focus.position)
      if (node === null || selectionInsideList(newState, focus.position, node)) {
        return null
      }
      const direction = newState.selection.head < oldState.selection.head ? 1 : -1
      const selection = selectionAtListEdge(newState.doc, focus.position, direction)
      return selection === null
        ? null
        : newState.tr.setSelection(selection).setMeta('addToHistory', false)
    },
  })
}

const focusSelectedItem: Command = (state, dispatch) => {
  const position = nearestListPosition(state)
  if (position === null) {
    return false
  }
  dispatch?.(focusTransaction(state, position))
  return true
}

const insertFocusedChild: Command = (state, dispatch) => {
  const focus = outlineFocusKey.getState(state)
  if (focus?.position === null || focus === undefined || !state.selection.empty) {
    return false
  }
  const focusedNode = listNodeAt(state.doc, focus.position)
  if (focusedNode === null) {
    return false
  }
  const contentBlock = focusedNode.firstChild
  if (
    contentBlock === null ||
    !contentBlock.isTextblock ||
    nearestListPosition(state) !== focus.position ||
    state.selection.$from.parent !== contentBlock ||
    state.selection.$from.parentOffset !== contentBlock.content.size
  ) {
    return false
  }

  const paragraphType = state.schema.nodes['paragraph']
  if (paragraphType === undefined) {
    return false
  }
  if (dispatch !== undefined) {
    const emptyParagraph = paragraphType.create()
    const child = focusedNode.type.createChecked(
      { kind: 'bullet', collapsed: false },
      emptyParagraph,
    )
    const insertAt = focus.position + 1 + contentBlock.nodeSize
    const transaction = state.tr.insert(insertAt, child)
    const selection = Selection.near(transaction.doc.resolve(insertAt + 2), 1)
    dispatch(transaction.setSelection(selection).scrollIntoView())
  }
  return true
}

const zoomOut: Command = (state, dispatch) => {
  const focus = outlineFocusKey.getState(state)
  if (focus?.position === null || focus === undefined || !state.selection.empty) {
    return false
  }
  const entries = outlineFocusEntries(state.doc, focus.position)
  const parent = entries.at(-2)?.position ?? null
  dispatch?.(focusTransaction(state, parent))
  return true
}

/**
 * Session-local Workflowy-style block focus.
 *
 * Mod-clicking a bullet focuses its subtree. Breadcrumbs, Escape, and
 * Mod-Shift-. navigate focus. Stable URLs await portable Markdown IDs for
 * outline items.
 */
export function OutlineFocus(): null {
  const extension = useMemo(() => definePlugin(createOutlineFocusPlugin()), [])
  const keymap = useMemo(
    () => ({
      Enter: insertFocusedChild,
      [OUTLINE_FOCUS_BINDING]: focusSelectedItem,
      Escape: zoomOut,
    }),
    [],
  )

  useExtension(extension, { priority: Priority.highest })
  useKeymap(keymap, { priority: Priority.highest })
  return null
}
