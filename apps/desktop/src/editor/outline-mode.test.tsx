import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { fireEvent } from '@/test-utils/fire-event'
import '@/test-utils/locator'
import { NoteEditor, type NoteEditorHandle } from './note-editor'

const editorRoot = page.locate('.ProseMirror')

function commandClick(element: HTMLElement): void {
  fireEvent.pointerDown(element, {
    button: 0,
    metaKey: true,
    pointerId: 1,
  })
  element.dispatchEvent(
    new PointerEvent('pointerup', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
      pointerId: 1,
    }),
  )
  fireEvent.click(element, { metaKey: true })
}

async function renderOutline(
  markdown: string,
  outlineTitle = false,
): Promise<NoteEditorHandle> {
  const handleRef = createRef<NoteEditorHandle>()
  await render(
    <NoteEditor
      initialContent={markdown}
      outlineMode={true}
      outlineTitle={outlineTitle}
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
  it('keeps a new regular note title outside the outline', async () => {
    const handle = await renderOutline('#', true)

    await userEvent.keyboard('Title{Enter}first{Enter}second')

    await vi.waitFor(() => {
      expect(handle.getMarkdown()).toBe('# Title\n\n- first\n- second\n')
    })
  })

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
    expect(getComputedStyle(items[0]!, '::after').backgroundColor).not.toBe(
      'rgba(0, 0, 0, 0)',
    )
    expect(getComputedStyle(items[1]!, '::after').content).toBe('""')
    expect(getComputedStyle(items[2]!, '::after').content).toBe('none')
    expect(getComputedStyle(items[3]!, '::after').content).toBe('none')
    const marker = items[0]?.querySelector<HTMLElement>(':scope > .list-marker')
    expect(marker).toBeDefined()
    expect(getComputedStyle(marker!).cursor).toBe('pointer')
  })

  it('focuses a clicked bullet subtree and zooms out through breadcrumbs', async () => {
    const handle = await renderOutline(
      '- parent\n  - child\n    - grandchild\n  - other child\n- sibling',
    )
    const items = editorRoot.element().querySelectorAll<HTMLElement>('.prosemirror-flat-list')
    const parentMarker = items[0]?.querySelector<HTMLElement>(':scope > .list-marker')
    const childMarker = items[1]?.querySelector<HTMLElement>(':scope > .list-marker')
    if (
      parentMarker === null ||
      parentMarker === undefined ||
      childMarker === null ||
      childMarker === undefined
    ) {
      throw new Error('outline markers were not rendered')
    }

    commandClick(parentMarker)

    await vi.waitFor(() => {
      expect(editorRoot.element().hasAttribute('data-reflect-outline-focus')).toBe(true)
    })
    const breadcrumbs = page.getByRole('navigation', { name: 'Focused block path' })
    await expect.element(breadcrumbs).toBeVisible()
    expect(
      breadcrumbs.element().querySelector('[aria-current="page"]')?.textContent,
    ).toBe('parent')
    expect(getComputedStyle(items[1]!).display).not.toBe('none')
    expect(getComputedStyle(items[2]!).display).not.toBe('none')
    expect(getComputedStyle(items[3]!).display).not.toBe('none')
    expect(getComputedStyle(items[4]!).display).toBe('none')

    await userEvent.click(page.getByRole('button', { name: 'All blocks' }))
    commandClick(childMarker)

    await vi.waitFor(() => {
      expect(
        breadcrumbs.element().querySelector('[aria-current="page"]')?.textContent,
      ).toBe('child')
    })
    expect(getComputedStyle(items[0]!).display).toBe('contents')
    expect(getComputedStyle(items[3]!).display).toBe('none')
    expect(handle.getMarkdown()).toBe(
      '- parent\n  - child\n    - grandchild\n  - other child\n- sibling\n',
    )

    await userEvent.click(page.getByRole('button', { name: 'All blocks' }))

    await vi.waitFor(() => {
      expect(editorRoot.element().hasAttribute('data-reflect-outline-focus')).toBe(false)
    })
    expect(getComputedStyle(items[3]!).display).not.toBe('none')
    expect(getComputedStyle(items[4]!).display).not.toBe('none')
  })

  it('folds a bullet on plain click and focuses it on Command-click', async () => {
    await renderOutline('- parent\n  - child\n- sibling')
    const parent = editorRoot
      .element()
      .querySelector<HTMLElement>('.prosemirror-flat-list')
    const parentMarker = parent?.querySelector<HTMLElement>(
      ':scope > .list-marker',
    )
    if (
      parent === null ||
      parent === undefined ||
      parentMarker === null ||
      parentMarker === undefined
    ) {
      throw new Error('parent marker was not rendered')
    }

    await userEvent.click(parentMarker)

    await vi.waitFor(() => {
      expect(
        editorRoot
          .element()
          .querySelector('.prosemirror-flat-list')
          ?.hasAttribute('data-list-collapsed'),
      ).toBe(true)
    })
    expect(editorRoot.element().hasAttribute('data-reflect-outline-focus')).toBe(false)

    const collapsedMarker = editorRoot
      .element()
      .querySelector<HTMLElement>('.prosemirror-flat-list > .list-marker')
    if (collapsedMarker === null) {
      throw new Error('collapsed parent marker was not rendered')
    }
    await userEvent.click(collapsedMarker)

    await vi.waitFor(() => {
      expect(
        editorRoot
          .element()
          .querySelector('.prosemirror-flat-list')
          ?.hasAttribute('data-list-collapsed'),
      ).toBe(false)
    })

    const expandedMarker = editorRoot
      .element()
      .querySelector<HTMLElement>('.prosemirror-flat-list > .list-marker')
    if (expandedMarker === null) {
      throw new Error('expanded parent marker was not rendered')
    }
    commandClick(expandedMarker)

    await vi.waitFor(() => {
      expect(editorRoot.element().hasAttribute('data-reflect-outline-focus')).toBe(true)
    })
  })

  it('focuses the caret item with the keyboard and uses Escape to zoom up', async () => {
    await renderOutline('- parent\n  - child')

    await userEvent.keyboard('{Meta>}{Shift>}.{/Shift}{/Meta}')

    const breadcrumbs = page.getByRole('navigation', { name: 'Focused block path' })
    await expect.element(breadcrumbs).toBeVisible()
    expect(
      breadcrumbs.element().querySelector('[aria-current="page"]')?.textContent,
    ).toBe('child')

    await userEvent.keyboard('{Escape}')

    await vi.waitFor(() => {
      expect(
        breadcrumbs.element().querySelector('[aria-current="page"]')?.textContent,
      ).toBe('parent')
    })
    expect(editorRoot.element().textContent).toContain('child')

    await userEvent.keyboard('{Escape}')

    await vi.waitFor(() => {
      expect(editorRoot.element().hasAttribute('data-reflect-outline-focus')).toBe(false)
    })
  })

  it('creates a child when Enter follows the focused root text', async () => {
    const handle = await renderOutline('- parent\n- sibling')
    const parentMarker = editorRoot
      .element()
      .querySelector<HTMLElement>('.prosemirror-flat-list > .list-marker')
    if (parentMarker === null) {
      throw new Error('parent marker was not rendered')
    }

    commandClick(parentMarker)
    handle.setSelection('end')
    await userEvent.keyboard('{Enter}child')

    await vi.waitFor(() => {
      expect(handle.getMarkdown()).toBe('- parent\n  - child\n- sibling\n')
    })
    expect(editorRoot.element().hasAttribute('data-reflect-outline-focus')).toBe(
      true,
    )
    const items = editorRoot.element().querySelectorAll('.prosemirror-flat-list')
    expect(items).toHaveLength(3)
    expect(getComputedStyle(items[2]!).display).toBe('none')
  })

  it('deletes an empty item and moves the caret to the previous item end', async () => {
    const handle = await renderOutline('- first')

    await userEvent.keyboard('{Enter}{Backspace}!')

    await vi.waitFor(() => {
      expect(handle.getMarkdown()).toBe('- first!\n')
    })
  })

  it('joins a sibling at its start and leaves the caret at the join', async () => {
    const handle = await renderOutline('- first\n- second')

    await userEvent.keyboard('{Meta>}{ArrowLeft}{/Meta}')
    await userEvent.keyboard('{Backspace}!')

    await vi.waitFor(() => {
      expect(handle.getMarkdown()).toBe('- first!second\n')
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
