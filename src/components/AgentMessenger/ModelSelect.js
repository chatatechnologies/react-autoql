import React, { useState } from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../Icon'
import { Popover } from '../Popover'
import { ModelsStatuses } from './threadsReducer'

/**
 * LLM model picker.
 *
 * Built on the shared Popover rather than the shared Select: Select's trigger is a
 * bordered/underlined form control sized for settings panels, and overriding it into
 * a small inline pill meant fighting more of its CSS than writing the pill outright.
 * The menu keeps Select's shape - a name, a one-line description, and a check on the
 * current choice.
 */
const ModelSelect = ({ models, status, value, onChange, popoverParentElement, isDisabled }) => {
  const [isOpen, setIsOpen] = useState(false)

  // Only absent when there is genuinely nothing to show - the hook falls back to a
  // built-in list when the endpoint is missing, so this is the empty-prop case.
  if (!models.length) {
    return null
  }

  const selected = models.find((model) => model.id === value)
  const label = selected?.label ?? value ?? 'Model'

  const content = (
    <div className='react-autoql-agent-model-menu'>
      {models.map((model) => (
        <div
          key={model.id}
          role='menuitem'
          tabIndex={0}
          className={`react-autoql-agent-model-row${model.id === value ? ' is-active' : ''}`}
          onClick={() => {
            onChange(model.id)
            setIsOpen(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              onChange(model.id)
              setIsOpen(false)
            }
          }}
        >
          <div className='react-autoql-agent-model-row-head'>
            <span className='react-autoql-agent-model-row-name'>{model.label}</span>
            {model.id === value && <Icon type='check' className='react-autoql-agent-model-check' />}
          </div>
          {!!model.description && <span className='react-autoql-agent-model-row-desc'>{model.description}</span>}
        </div>
      ))}
    </div>
  )

  return (
    <Popover
      isOpen={isOpen}
      content={content}
      // Opens upward: the composer sits at the bottom of the drawer.
      positions={['top', 'bottom', 'right', 'left']}
      align='start'
      padding={6}
      parentElement={popoverParentElement}
      onClickOutside={() => setIsOpen(false)}
    >
      <button
        className={`react-autoql-agent-model-pill${isOpen ? ' is-open' : ''}`}
        onClick={() => !isDisabled && setIsOpen((open) => !open)}
        disabled={isDisabled || status === ModelsStatuses.LOADING}
        aria-haspopup='menu'
        aria-expanded={isOpen}
      >
        <span className='react-autoql-agent-model-pill-label'>
          {status === ModelsStatuses.LOADING ? 'Loading models…' : label}
        </span>
        <Icon type={isOpen ? 'caret-up' : 'caret-down'} className='react-autoql-agent-model-pill-caret' />
      </button>
    </Popover>
  )
}

ModelSelect.propTypes = {
  models: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, label: PropTypes.string })),
  status: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  popoverParentElement: PropTypes.any,
  isDisabled: PropTypes.bool,
}

ModelSelect.defaultProps = {
  models: [],
  status: ModelsStatuses.IDLE,
  value: undefined,
  onChange: () => {},
  popoverParentElement: undefined,
  isDisabled: false,
}

export default ModelSelect
