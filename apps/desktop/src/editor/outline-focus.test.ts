import { describe, expect, it } from 'vitest'
import { markdownToDoc } from '@meowdown/core'
import { outlineFocusEntries } from './outline-focus'

function positionOf(doc: ReturnType<typeof markdownToDoc>, text: string): number {
  let position: number | null = null
  doc.descendants((node, nodePosition) => {
    if (position === null && node.type.name === 'list' && node.firstChild?.textContent === text) {
      position = nodePosition
    }
  })
  if (position === null) {
    throw new Error(`list item not found: ${text}`)
  }
  return position
}

describe('outlineFocusEntries', () => {
  it('returns the root-to-item breadcrumb path', () => {
    const doc = markdownToDoc('- parent\n  - child\n    - grandchild\n- sibling')
    const focusPosition = positionOf(doc, 'grandchild')

    expect(outlineFocusEntries(doc, focusPosition).map((entry) => entry.label)).toEqual([
      'parent',
      'child',
      'grandchild',
    ])
  })

  it('addresses a root item at document position zero', () => {
    const doc = markdownToDoc('- parent\n  - child\n- sibling')

    expect(outlineFocusEntries(doc, 0)).toEqual([{ label: 'parent', position: 0 }])
  })

  it('uses a readable fallback for empty items', () => {
    const doc = markdownToDoc('- parent\n  -')
    const parent = doc.firstChild!
    const emptyPosition = 1 + parent.firstChild!.nodeSize

    expect(outlineFocusEntries(doc, emptyPosition).at(-1)?.label).toBe('Untitled block')
  })
})
