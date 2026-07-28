import type { ReactElement } from 'react'
import { Lock } from 'lucide-react'
import { PinIcon } from '@/components/icons/pin-icon'
import { useNoteRow } from '@/hooks/use-note-row'
import { usePinnedNotes } from '@/hooks/use-pinned-notes'
import { toggleNotePinned } from '@/lib/note-pin'
import { toggleNotePrivate } from '@/lib/note-private'
import { useOptimisticPinToggle } from '@/lib/notes/use-optimistic-pin-toggle'
import { NoteTrashAction } from './note-trash-action'
import { NoteToggleAction } from './note-toggle-action'
import { SidebarSection } from './sidebar-section'

interface NoteActionsSectionProps {
  /** Graph-relative path of the note the actions operate on. */
  path: string
  /** Whether this context can offer deleting the note. Daily sidebars leave this off. */
  showTrash?: boolean
}

/**
 * "Note actions" as a context-sidebar section: mouse-reachable counterparts
 * to the note-scoped commands — pin/unpin and the `private` flag. Shared by
 * the daily and note context sidebars; dailies are valid targets for both.
 * Each action reflects the index's state (the pin from the same query as the
 * sidebar's Pinned section, privacy from the note's own row), bridged by the
 * last toggle's result while the watcher catches up.
 */
export function NoteActionsSection({
  path,
  showTrash = false,
}: NoteActionsSectionProps): ReactElement {
  const isPinned = usePinnedNotes().some((note) => note.path === path)
  const noteRow = useNoteRow(path)
  const isPrivate = noteRow?.isPrivate ?? false
  const { applyOptimisticPin, invalidateOptimisticPin } = useOptimisticPinToggle(path, noteRow)

  return (
    <SidebarSection storageKey="note-actions" title="Note actions">
      <NoteToggleAction
        path={path}
        indexActive={isPinned}
        toggle={toggleNotePinned}
        icon={<PinIcon width={20} height={20} />}
        labels={{ active: 'Un-pin this note', inactive: 'Pin this note' }}
        failureLabel="Updating pin"
        applyOptimistic={applyOptimisticPin}
        onFailure={invalidateOptimisticPin}
      />
      <NoteToggleAction
        path={path}
        indexActive={isPrivate}
        toggle={toggleNotePrivate}
        icon={<Lock size={14} aria-hidden />}
        labels={{
          active: 'Unlock note',
          inactive: 'Lock note',
        }}
        failureLabel="Updating privacy"
        tooltip="Locks this note out of AI. Backup and sync still include it."
      />
      {showTrash ? <NoteTrashAction path={path} /> : null}
    </SidebarSection>
  )
}
