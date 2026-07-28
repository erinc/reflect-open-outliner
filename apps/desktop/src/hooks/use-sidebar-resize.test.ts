import { describe, expect, it } from 'vitest'
import { effectiveSidebarWidths } from './use-sidebar-resize'

describe('effectiveSidebarWidths', () => {
  it('honors both preferences when the viewport has room', () => {
    expect(effectiveSidebarWidths(1600, 480, 480)).toEqual({ workspace: 480, context: 480 })
    expect(effectiveSidebarWidths(1024, 260, 320)).toEqual({ workspace: 260, context: 320 })
  })

  it('does not budget space for the hidden workspace rail', () => {
    expect(effectiveSidebarWidths(1024, 480, 480)).toEqual({ workspace: 480, context: 480 })
  })

  it('keeps the context rail at its preferred width in narrower windows with room', () => {
    expect(effectiveSidebarWidths(1000, 480, 400)).toEqual({ workspace: 480, context: 400 })
  })

  it('never shrinks a rail below its range minimum', () => {
    // A 500px window leaves a 140px budget; the context rail floors at its 240px
    // minimum and the editor gives way instead.
    expect(effectiveSidebarWidths(500, 480, 480)).toEqual({ workspace: 480, context: 240 })
  })

  it('clamps out-of-range preferences before budgeting', () => {
    expect(effectiveSidebarWidths(1600, 9000, 100)).toEqual({ workspace: 480, context: 240 })
  })
})
