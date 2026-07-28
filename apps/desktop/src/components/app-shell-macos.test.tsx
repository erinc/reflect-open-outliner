import { render } from 'vitest-browser-react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/window-chrome', () => ({ hasMacosTitleBarOverlay: true }))

const { AppShell } = await import('./app-shell')

describe('AppShell on macOS', () => {
  it('keeps the main pane below the overlaid titlebar controls', async () => {
    const view = await render(<AppShell>Note content</AppShell>)

    const main = view.getByRole('main').element()
    expect(main.classList.contains('pt-7')).toBe(true)
  })

  it('keeps context scrolling while hiding its scrollbar', async () => {
    const view = await render(<AppShell context={<div>Context content</div>}>Note content</AppShell>)

    const context = view.getByRole('complementary', { name: 'Context' }).element()
    const scroller = context.querySelector('.overflow-auto')
    expect(scroller?.classList.contains('scrollbar-none')).toBe(true)
  })
})
