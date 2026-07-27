import { useMemo } from 'react'
import { definePlugin } from '@prosekit/core'
import type { ProseMirrorNode } from '@prosekit/pm/model'
import { Plugin, type Command, type EditorState, type Transaction } from '@prosekit/pm/state'
import { Priority } from '@meowdown/core'
import { useExtension, useKeymap } from '@meowdown/react'

interface OutlineModeProps {
  /**
   * Preserve the first non-empty H1 as a regular note's title. Daily notes
   * pass false because their date subject already lives outside the editor.
   */
  allowTitle: boolean
}

function isEmptyTextblock(node: ProseMirrorNode): boolean {
  return node.isTextblock && node.content.size === 0
}

function isEmptyOutlineItem(node: ProseMirrorNode): boolean {
  return (
    node.type.name === 'list' &&
    node.childCount === 1 &&
    node.firstChild !== null &&
    isEmptyTextblock(node.firstChild)
  )
}

function titleIndex(doc: ProseMirrorNode, allowTitle: boolean): number | null {
  if (!allowTitle) {
    return null
  }
  for (let index = 0; index < doc.childCount; index += 1) {
    const node = doc.child(index)
    if (isEmptyTextblock(node) || isEmptyOutlineItem(node)) {
      continue
    }
    return node.type.name === 'heading' && node.attrs['level'] === 1 ? index : null
  }
  return null
}

function activeTopLevelIndex(state: EditorState): number | null {
  return state.selection.empty ? state.selection.$from.index(0) : null
}

/**
 * Repair the top-level document shape after an editor transaction.
 *
 * The active empty block is kept as the caret's transient typing target.
 * Empty siblings are removed; every non-list body block is wrapped in a
 * canonical bullet item. The first regular-note H1 remains the title.
 */
export function normalizeOutlineTransaction(
  state: EditorState,
  allowTitle: boolean,
): Transaction | null {
  const listType = state.schema.nodes['list']
  if (listType === undefined) {
    return null
  }

  const activeIndex = activeTopLevelIndex(state)
  const preservedTitleIndex = titleIndex(state.doc, allowTitle)
  const actions: Array<
    | { readonly kind: 'delete'; readonly from: number; readonly to: number }
    | {
        readonly kind: 'wrap'
        readonly from: number
        readonly to: number
        readonly node: ProseMirrorNode
      }
  > = []

  let position = 0
  for (let index = 0; index < state.doc.childCount; index += 1) {
    const node = state.doc.child(index)
    const from = position
    const to = from + node.nodeSize
    position = to

    if (index === preservedTitleIndex || node.type === listType) {
      if (isEmptyOutlineItem(node) && index !== activeIndex) {
        actions.push({ kind: 'delete', from, to })
      }
      continue
    }

    if (isEmptyTextblock(node) && index !== activeIndex) {
      actions.push({ kind: 'delete', from, to })
      continue
    }
    actions.push({ kind: 'wrap', from, to, node })
  }

  if (actions.length === 0) {
    return null
  }

  const transaction = state.tr
  for (const action of actions.reverse()) {
    if (action.kind === 'delete') {
      transaction.delete(action.from, action.to)
      continue
    }
    const item = listType.createChecked(
      { kind: 'bullet', collapsed: false },
      action.node,
    )
    transaction.replaceWith(action.from, action.to, item)
  }
  return transaction.docChanged ? transaction : null
}

function nearestList(state: EditorState): ProseMirrorNode | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name === 'list') {
      return node
    }
  }
  return null
}

/** Whether the selection is inside an item of `kind`. */
export function isSelectionInListKind(state: EditorState, kind: string): boolean {
  return nearestList(state)?.attrs['kind'] === kind
}

function isSelectionInRootItem(state: EditorState): boolean {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== 'list') {
      continue
    }
    return $from.node(depth - 1).type.name === 'doc'
  }
  return false
}

const protectEmptyRootItem: Command = (state) => {
  const item = nearestList(state)
  return (
    state.selection.empty &&
    item !== null &&
    isSelectionInRootItem(state) &&
    isEmptyOutlineItem(item)
  )
}

const protectRootOutdent: Command = (state) => isSelectionInRootItem(state)

function protectListKind(kind: string): Command {
  return (state) => isSelectionInListKind(state, kind)
}

/**
 * Enforce the editor-side outline invariant.
 *
 * This is installed through Meowdown's child-extension seam while the generic
 * behavior is prepared for Meowdown's own `outlineMode` API.
 */
export function OutlineMode({ allowTitle }: OutlineModeProps): null {
  const invariant = useMemo(
    () =>
      definePlugin(
        new Plugin({
          appendTransaction: (_transactions, _oldState, state) =>
            normalizeOutlineTransaction(state, allowTitle),
        }),
      ),
    [allowTitle],
  )
  const keymap = useMemo(
    () => ({
      Enter: protectEmptyRootItem,
      'Shift-Tab': protectRootOutdent,
      'Mod-[': protectRootOutdent,
      'Mod-Shift-7': protectListKind('ordered'),
      'Mod-Shift-8': protectListKind('bullet'),
      'Mod-Shift-9': protectListKind('task'),
    }),
    [],
  )

  useExtension(invariant, { priority: Priority.high })
  useKeymap(keymap, { priority: Priority.high })
  return null
}
