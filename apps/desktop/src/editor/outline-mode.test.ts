import { describe, expect, it } from 'vitest'
import { docToMarkdown, markdownToDoc } from '@meowdown/core'
import type { ProseMirrorNode } from '@prosekit/pm/model'
import { EditorState, TextSelection } from '@prosekit/pm/state'
import {
  canStrictIndent,
  isSelectionInListKind,
  normalizeOutlineTransaction,
} from './outline-mode'

function normalizedDoc(markdown: string, allowTitle = false): ProseMirrorNode {
  const doc = markdownToDoc(markdown)
  const state = EditorState.create({ doc })
  const transaction = normalizeOutlineTransaction(state, allowTitle)
  return transaction?.doc ?? doc
}

function listItem(
  doc: ProseMirrorNode,
  text: string,
  kind: 'bullet' | 'ordered' | 'task' = 'bullet',
): ProseMirrorNode {
  const paragraph = doc.type.schema.nodes['paragraph']!.create(
    null,
    text === '' ? undefined : doc.type.schema.text(text),
  )
  return doc.type.schema.nodes['list']!.create({ kind }, paragraph)
}

function textPosition(doc: ProseMirrorNode, text: string): number {
  let match: number | null = null
  doc.descendants((node, position) => {
    if (match === null && node.isText && node.text?.includes(text)) {
      match = position + 1
    }
  })
  if (match === null) {
    throw new Error(`text not found: ${JSON.stringify(text)}`)
  }
  return match
}

describe('normalizeOutlineTransaction', () => {
  it('wraps top-level paragraphs as compact sibling items', () => {
    const doc = normalizedDoc('first\n\nsecond')

    expect(docToMarkdown(doc)).toBe('- first\n- second\n')
    expect([...Array(doc.childCount).keys()].map((index) => doc.child(index).type.name)).toEqual([
      'list',
      'list',
    ])
  })

  it('preserves the first regular-note H1 and wraps its body', () => {
    const doc = normalizedDoc('# Project\n\nfirst\n\nsecond', true)

    expect(docToMarkdown(doc)).toBe('# Project\n\n- first\n- second\n')
    expect(doc.child(0).type.name).toBe('heading')
    expect(doc.child(1).type.name).toBe('list')
    expect(doc.child(2).type.name).toBe('list')
  })

  it('wraps headings when the title exception is disabled', () => {
    const doc = normalizedDoc('## Section\n\ntext')

    expect(doc.child(0).type.name).toBe('list')
    expect(doc.child(0).firstChild?.type.name).toBe('heading')
    expect(doc.child(1).type.name).toBe('list')
  })

  it('keeps an empty outline item as a durable bullet block', () => {
    const base = markdownToDoc('- placeholder')
    const first = listItem(base, 'first')
    const empty = listItem(base, '')
    const second = listItem(base, 'second')
    const doc = base.type.create(base.attrs, [first, empty, second])
    const secondTextPosition = first.nodeSize + empty.nodeSize + 2
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, secondTextPosition),
    })

    const transaction = normalizeOutlineTransaction(state, false)

    expect(transaction).toBeNull()
    expect(docToMarkdown(state.doc)).toBe('- first\n-\n- second\n')
  })

  it('wraps an abandoned empty paragraph instead of deleting it', () => {
    const base = markdownToDoc('first')
    const first = base.firstChild!
    const empty = base.type.schema.nodes['paragraph']!.create()
    const second = base.type.schema.nodes['paragraph']!.create(
      null,
      base.type.schema.text('second'),
    )
    const doc = base.type.create(base.attrs, [first, empty, second])
    const state = EditorState.create({ doc })

    const transaction = normalizeOutlineTransaction(state, false)

    expect(transaction).not.toBeNull()
    expect(docToMarkdown(transaction!.doc)).toBe('- first\n-\n- second\n')
  })
})

describe('isSelectionInListKind', () => {
  it('reads the nearest item kind at the selection', () => {
    const doc = markdownToDoc('- bullet\n  1. ordered')
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, textPosition(doc, 'ordered')),
    })

    expect(isSelectionInListKind(state, 'ordered')).toBe(true)
    expect(isSelectionInListKind(state, 'bullet')).toBe(false)
  })
})

describe('canStrictIndent', () => {
  function stateAt(markdown: string, text: string): EditorState {
    const doc = markdownToDoc(markdown)
    return EditorState.create({
      doc,
      selection: TextSelection.create(doc, textPosition(doc, text)),
    })
  }

  it('allows one indent beneath a preceding sibling', () => {
    expect(canStrictIndent(stateAt('- parent\n- child', 'child'))).toBe(true)
  })

  it('rejects another indent when the item is already the first child', () => {
    expect(canStrictIndent(stateAt('- parent\n  - child', 'child'))).toBe(false)
  })

  it('allows a deeper indent when a real sibling precedes the item', () => {
    expect(
      canStrictIndent(stateAt('- parent\n  - first\n  - second', 'second')),
    ).toBe(true)
  })
})
