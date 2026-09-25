import React from 'react'
import { BLOCK_INFO, BLOCK_TYPES, RB } from '../constants'
import { STRINGS } from '../strings'
import { Icon } from './icons'

// Clicking a block type opens its details layer; nothing is inserted until the author says so there.
export const Palette = ({ openType, onOpen, types = BLOCK_TYPES, note = STRINGS.paletteNote }) => (
  <aside className={`${RB}-palette`} aria-label={STRINGS.addBlock}>
    <div className={`${RB}-section-label`}>{STRINGS.addBlock}</div>
    <div className={`${RB}-palette-list`}>
      {types.map((type) => (
        <button
          key={type}
          type='button'
          className={`${RB}-palette-item`}
          data-type={type}
          data-selected={openType === type || undefined}
          aria-expanded={openType === type}
          aria-haspopup='dialog'
          onClick={(e) => onOpen(type, e.currentTarget)}
        >
          <Icon name={type} />
          {BLOCK_INFO[type].label}
        </button>
      ))}
    </div>
    <p className={`${RB}-hint`}>{STRINGS.paletteHint}</p>
    <p className={`${RB}-hint`}>{note}</p>
  </aside>
)
