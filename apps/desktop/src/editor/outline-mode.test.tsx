import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import '@/test-utils/locator'
import { NoteEditor, type NoteEditorHandle } from './note-editor'

const editorRoot = page.locate('.ProseMirror')

async function renderOutline(markdown: string): Promise<NoteEditorHandle> {
  const handleRef = createRef<NoteEditorHandle>()
  await render(
    <NoteEditor
      initialContent={markdown}
      outlineMode={true}
      handleRef={handleRef}
    />,
  )
  await expect.element(editorRoot).toBeVisible()
  handleRef.current?.focus()
  handleRef.current?.setSelection('end')
  if (handleRef.current === null) {
    throw new Error('outline editor handle was not attached')
  }
  return handleRef.current
}

describe('NoteEditor outline mode', () => {
  it('creates compact sibling items with Enter', async () => {
    const handle = await renderOutline('- first')

    await userEvent.keyboard('{Enter}second')

    await vi.waitFor(() => {
      expect(handle.getMarkdown()).toBe('- first\n- second\n')
    })
  })

  it('keeps an empty root item as a bullet and creates the next sibling', async () => {
    const handle = await renderOutline('- first')

    await userEvent.keyboard('{Enter}{Enter}second')

    await vi.waitFor(() => {
      expect(handle.getMarkdown()).toBe('- first\n-\n- second\n')
    })
  })

  it('shows hierarchy guides only when an item has nested children', async () => {
    await renderOutline('- parent\n  - child\n    - grandchild\n- sibling')

    expect(editorRoot.element().classList.contains('reflect-outline-editor')).toBe(
      true,
    )
    const items = editorRoot.element().querySelectorAll('.prosemirror-flat-list')
    expect(items).toHaveLength(4)
    expect(getComputedStyle(items[0]!, '::after').content).toBe('""')
    expect(getComputedStyle(items[0]!, '::after').width).toBe('1px')
    expect(getComputedStyle(items[1]!, '::after').content).toBe('""')
    expect(getComputedStyle(items[2]!, '::after').content).toBe('none')
    expect(getComputedStyle(items[3]!, '::after').content).toBe('none')
  })

  it('deletes an empty item and moves the caret to the previous item end', async () => {
    const handle = await renderOutline('- first')

    await userEvent.keyboard('{Enter}{Backspace}!')

    await vi.waitFor(() => {
      expect(handle.getMarkdown()).toBe('- first!\n')
    })
  })

  it('deletes a cleared first child and moves the caret to its parent end', async () => {
    const handle = await renderOutline('- parent\n  - child')

    await userEvent.keyboard(
      '{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}!',
    )

    await vi.waitFor(() => {
      expect(handle.getMarkdown()).toBe('- parent!\n')
    })
  })

  it('outdents a nested empty item instead of creating an empty line', async () => {
    const handle = await renderOutline('- parent\n  - child')

    await userEvent.keyboard('{Enter}{Enter}next')

    await vi.waitFor(() => {
      expect(handle.getMarkdown()).toBe('- parent\n  - child\n- next\n')
    })
  })

  it('allows only one indent beneath the preceding parent', async () => {
    const handle = await renderOutline('- parent\n- child')

    await userEvent.keyboard('{Tab}{Tab}')

    await vi.waitFor(() => {
      expect(handle.getMarkdown()).toBe('- parent\n  - child\n')
    })
  })

  it('does not outdent a root item with Shift-Tab', async () => {
    const handle = await renderOutline('- first')

    await userEvent.keyboard('{Shift>}{Tab}{/Shift}')

    await vi.waitFor(() => {
      expect(handle.getMarkdown()).toBe('- first\n')
    })
  })
})
