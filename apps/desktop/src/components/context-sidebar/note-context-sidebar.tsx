import type { ReactElement } from 'react'
import { useToday } from '@/lib/use-today'
import { ContextSidebarFrame } from './context-sidebar-frame'
import { NoteActionsSection } from './note-actions-section'
import { PublishedUrlSection } from './published-url-section'
import { SimilarNotesSection } from './similar-notes-section'

interface NoteContextSidebarProps {
  /** Graph-relative path of the open note the sidebar describes. */
  path: string
}

/**
 * An ordinary note's contextual sidebar: today's calendar, note actions, then
 * the note's semantic neighbors — the only place similar notes appear.
 * Inbound links live under the note itself (the incoming-backlinks panel), not
 * here. Rendered in the AppShell's right region on `note` routes.
 */
export function NoteContextSidebar({ path }: NoteContextSidebarProps): ReactElement {
  const today = useToday()

  return (
    <ContextSidebarFrame selectedDate={today}>
      <NoteActionsSection path={path} showTrash />
      <PublishedUrlSection path={path} />
      <SimilarNotesSection path={path} />
    </ContextSidebarFrame>
  )
}
