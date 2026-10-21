import React from 'react'
import { Icon } from '../components/icons'
import { RS } from './constants'
import { REPORTS_STRINGS } from './strings'

// Where the open report stands, so it's clear when it's safe to leave: one control in the builder's toolbar (its
// toolbarStatus), quiet while the report is saved or saving, and a button to press once it needs you. Edits save
// themselves after a short pause and when you leave; pressing it (or ⌘S / Ctrl+S) saves at once, and tries again
// after a save failed. When the report was changed in another tab or window too, saving stops and it reloads the
// stored copy instead.
//
// Props: state ('saved', 'saving', 'failed' or 'conflict'), savedAt (when the report was last stored, as ISO, for
// the tooltip), onSave, and onReload (for 'conflict': open the stored copy instead).

const S = REPORTS_STRINGS.saveStatus

const STATES = ['saved', 'saving', 'failed', 'conflict']

const ICON_SIZE = 14

// When it was stored, as "3:42 PM"; null without a time that can be read.
const timeOf = (iso) => {
  if (!iso) {
    return null
  }
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Each state's icon, words and tooltip.
const looks = (state, time) => {
  switch (state) {
    case 'saving':
      return {
        icon: (
          <span className={`${RS}-spin`}>
            <Icon name='spinner' size={ICON_SIZE} />
          </span>
        ),
        label: S.saving,
        title: S.saveNow,
      }
    case 'failed':
      return { icon: <Icon name='alert' size={ICON_SIZE} />, label: S.failed, title: S.tryAgain }
    case 'conflict':
      return { icon: <Icon name='refresh' size={ICON_SIZE} />, label: S.conflict, title: S.reload }
    default:
      return {
        icon: <Icon name='check' size={ICON_SIZE} />,
        label: S.saved,
        title: time ? S.savedAt(time) : S.allSaved,
      }
  }
}

export const SaveStatus = ({ state, savedAt, onSave, onReload }) => {
  // A state it doesn't know shows as saved, rather than taking the toolbar down with it.
  const known = STATES.includes(state) ? state : 'saved'
  const { icon, label, title } = looks(known, timeOf(savedAt))
  return (
    <span className={`${RS}-save-status`} role='status' aria-live='polite'>
      <button
        type='button'
        className={`${RS}-save-button`}
        title={title}
        data-state={known}
        data-test='reports-save-status'
        onClick={() => (known === 'conflict' ? onReload?.() : onSave?.())}
      >
        {icon}
        {label}
      </button>
    </span>
  )
}
