import type { ReactElement } from 'react'
import { dailyPath } from '@reflect/core'
import { ContextSidebarFrame } from './context-sidebar-frame'
import { DailyEventsSection } from './daily-events-section'
import { NoteActionsSection } from './note-actions-section'
import { PublishedUrlSection } from './published-url-section'
import { SimilarNotesSection } from './similar-notes-section'

interface DailyContextSidebarProps {
  /** The day the sidebar describes — a validated ISO date from the route. */
  date: string
}

/**
 * The daily note's contextual sidebar (modeled on the old app's note context
 * sidebar): the month calendar up top — itself the day-navigation surface,
 * with a jump-to-today button — then note actions, the day's calendar
 * events, and semantic neighbors. Inbound links live under the note itself
 * (the incoming-backlinks section), not here. Rendered in the AppShell's
 * right region on daily routes only.
 */
export function DailyContextSidebar({ date }: DailyContextSidebarProps): ReactElement {
  return (
    <ContextSidebarFrame selectedDate={date}>
      <NoteActionsSection path={dailyPath(date)} />
      <DailyEventsSection date={date} />
      <PublishedUrlSection path={dailyPath(date)} />
      <SimilarNotesSection path={dailyPath(date)} />
    </ContextSidebarFrame>
  )
}
