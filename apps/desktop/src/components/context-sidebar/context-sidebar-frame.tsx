import type { ReactElement, ReactNode } from 'react'
import { useToday } from '@/lib/use-today'
import { cn } from '@/lib/utils'
import { hasMacosTitleBarOverlay } from '@/lib/window-chrome'
import { DayCalendar } from './day-calendar'

interface ContextSidebarFrameProps {
  /** Day highlighted by the calendar. */
  selectedDate: string
  children: ReactNode
}

/** Shared calendar header and section spacing for note context sidebars. */
export function ContextSidebarFrame({
  selectedDate,
  children,
}: ContextSidebarFrameProps): ReactElement {
  const today = useToday()

  return (
    <div
      className={cn(
        'flex flex-col text-text',
        // Calendar controls must clear the WindowDragRegion strip when the
        // macOS title bar is overlaid.
        hasMacosTitleBarOverlay ? 'pt-0' : 'pt-2',
      )}
    >
      <DayCalendar selectedDate={selectedDate} today={today} />
      <div className="my-4 space-y-4 pb-4">{children}</div>
    </div>
  )
}
