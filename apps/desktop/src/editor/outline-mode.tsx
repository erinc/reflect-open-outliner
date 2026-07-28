import { useMemo, type ReactElement } from 'react'
import { definePlugin } from '@prosekit/core'
import type { ProseMirrorNode } from '@prosekit/pm/model'
import {
  Plugin,
  Selection,
  type Command,
  type EditorState,
  type Transaction,
} from '@prosekit/pm/state'
import { Priority } from '@meowdown/core'
import { useExtension, useKeymap } from '@meowdown/react'
import { OutlineFocus } from '@/editor/outline-focus'

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
    if (node.type.name === 'heading' && node.attrs['level'] === 1) {
      return index
    }
    if (isEmptyTextblock(node) || isEmptyOutlineItem(node)) {
      continue
    }
    return null
  }
  return null
}

/**
 * Repair the top-level document shape after an editor transaction.
 *
 * Every non-list body block, including an empty block, is wrapped in a
 * canonical bullet item. Empty outline items remain durable blocks, while
 * plain empty paragraphs cannot escape the outline. The first regular-note H1
 * remains the title, including the empty H1 that seeds a new note before its
 * title is typed.
 */
export function normalizeOutlineTransaction(
  state: EditorState,
  allowTitle: boolean,
): Transaction | null {
  const listType = state.schema.nodes['list']
  if (listType === undefined) {
    return null
  }

  const preservedTitleIndex = titleIndex(state.doc, allowTitle)
  const actions: Array<{
    readonly from: number
    readonly to: number
    readonly node: ProseMirrorNode
  }> = []

  let position = 0
  for (let index = 0; index < state.doc.childCount; index += 1) {
    const node = state.doc.child(index)
    const from = position
    const to = from + node.nodeSize
    position = to

    if (index === preservedTitleIndex || node.type === listType) {
      continue
    }

    actions.push({ from, to, node })
  }

  if (actions.length === 0) {
    return null
  }

  const transaction = state.tr
  for (const action of actions.reverse()) {
    const item = listType.createChecked(
      { kind: 'bullet', collapsed: false },
      action.node,
    )
    transaction.replaceWith(action.from, action.to, item)
  }
  return transaction.docChanged ? transaction : null
}

interface ListContext {
  readonly depth: number
  readonly node: ProseMirrorNode
}

function nearestListContext(state: EditorState): ListContext | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name === 'list') {
      return { depth, node }
    }
  }
  return null
}

/** Whether the selection is inside an item of `kind`. */
export function isSelectionInListKind(state: EditorState, kind: string): boolean {
  return nearestListContext(state)?.node.attrs['kind'] === kind
}

/**
 * Whether the selected item has a preceding sibling at the same depth.
 *
 * That sibling is the only structurally valid parent for one indent step.
 * Once indented, the item is the parent's first child and cannot indent again
 * until another sibling precedes it at that depth.
 */
export function canStrictIndent(state: EditorState): boolean {
  const context = nearestListContext(state)
  if (context === null) {
    return false
  }
  const parentDepth = context.depth - 1
  const index = state.selection.$from.index(parentDepth)
  const previousSibling =
    index > 0 ? state.selection.$from.node(parentDepth).child(index - 1) : null
  return previousSibling?.type.name === 'list'
}

function isSelectionInRootItem(state: EditorState): boolean {
  const context = nearestListContext(state)
  return (
    context !== null &&
    state.selection.$from.node(context.depth - 1).type.name === 'doc'
  )
}

const deleteEmptyOutlineItem: Command = (state, dispatch) => {
  const context = nearestListContext(state)
  if (
    !state.selection.empty ||
    context === null ||
    !isEmptyOutlineItem(context.node)
  ) {
    return false
  }

  const from = state.selection.$from.before(context.depth)
  const previousSelection = Selection.findFrom(state.doc.resolve(from), -1)
  if (previousSelection === null) {
    return true
  }

  if (dispatch !== undefined) {
    const to = state.selection.$from.after(context.depth)
    const transaction = state.tr.delete(from, to)
    const boundary = transaction.mapping.map(from)
    const selection = Selection.near(transaction.doc.resolve(boundary), -1)
    dispatch(transaction.setSelection(selection).scrollIntoView())
  }
  return true
}

const insertEmptyRootSibling: Command = (state, dispatch) => {
  const context = nearestListContext(state)
  if (context === null) {
    return false
  }
  const firstBlock = context.node.firstChild
  if (
    !state.selection.empty ||
    firstBlock === null ||
    !isSelectionInRootItem(state) ||
    !isEmptyOutlineItem(context.node)
  ) {
    return false
  }

  if (dispatch !== undefined) {
    const emptyBlock = firstBlock.type.create(firstBlock.attrs)
    const emptyItem = context.node.type.createChecked(
      { ...context.node.attrs, checked: false, collapsed: false },
      emptyBlock,
    )
    const insertAt = state.selection.$from.after(context.depth)
    const transaction = state.tr.insert(insertAt, emptyItem)
    const selection = Selection.near(
      transaction.doc.resolve(insertAt + 2),
      1,
    )
    dispatch(transaction.setSelection(selection).scrollIntoView())
  }
  return true
}

const protectRootOutdent: Command = (state) => isSelectionInRootItem(state)
const protectInvalidIndent: Command = (state) =>
  nearestListContext(state) !== null && !canStrictIndent(state)

function protectListKind(kind: string): Command {
  return (state) => isSelectionInListKind(state, kind)
}

/**
 * Enforce the editor-side outline invariant.
 *
 * This is installed through Meowdown's child-extension seam while the generic
 * behavior is prepared for Meowdown's own `outlineMode` API.
 */
export function OutlineMode({ allowTitle }: OutlineModeProps): ReactElement {
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
      Backspace: deleteEmptyOutlineItem,
      Enter: insertEmptyRootSibling,
      Tab: protectInvalidIndent,
      'Shift-Tab': protectRootOutdent,
      'Mod-[': protectRootOutdent,
      'Mod-]': protectInvalidIndent,
      'Mod-Shift-7': protectListKind('ordered'),
      'Mod-Shift-8': protectListKind('bullet'),
      'Mod-Shift-9': protectListKind('task'),
    }),
    [],
  )

  useExtension(invariant, { priority: Priority.high })
  useKeymap(keymap, { priority: Priority.high })
  return <OutlineFocus />
}
