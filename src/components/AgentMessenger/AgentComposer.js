import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { isMobile } from 'react-device-detect'

import { Icon } from '../Icon'
import SpeechToTextButtonBrowser from '../SpeechToTextButton/SpeechToTextButtonBrowser'
import { authenticationType } from '../../props/types'

import ModelSelect from './ModelSelect'

import './AgentComposer.scss'

const MAX_HEIGHT_PX = 120

/**
 * The composer. Deliberately not QueryInput: there's no autocomplete, validation or
 * topics machinery in a session conversation, just text in and a model choice.
 */
const AgentComposer = forwardRef(
  (
    {
      authentication,
      placeholder,
      isSending,
      enableVoiceRecord,
      models,
      modelsStatus,
      llmModel,
      onModelChange,
      onSubmit,
      onCancel,
      popoverParentElement,
      tooltipID,
    },
    ref,
  ) => {
    const [value, setValue] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const textareaRef = useRef(null)

    const focus = useCallback(() => {
      textareaRef.current?.focus()
    }, [])

    useImperativeHandle(ref, () => ({ focus }), [focus])

    // Grow with the content up to MAX_HEIGHT_PX, then let the textarea scroll.
    const resize = useCallback(() => {
      const textarea = textareaRef.current
      if (!textarea) {
        return
      }

      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(MAX_HEIGHT_PX, textarea.scrollHeight)}px`
    }, [])

    useEffect(() => {
      resize()
    }, [value, resize])

    const submit = () => {
      const text = value.trim()

      if (!text || isSending) {
        return
      }

      setValue('')
      onSubmit(text)
    }

    const onKeyDown = (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        submit()
      }
    }

    const canSend = !!value.trim()

    return (
      <div className={`react-autoql-agent-composer${isSending ? ' is-sending' : ''}`}>
        <div
          className={`react-autoql-agent-composer-input-row${isFocused && !isSending ? ' is-focused' : ''}${
            isSending ? ' is-sending' : ''
          }`}
        >
          <textarea
            ref={textareaRef}
            className='react-autoql-agent-composer-input'
            rows={1}
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            aria-label={placeholder}
          />
          {!isMobile && enableVoiceRecord && !isSending && (
            <div className='react-autoql-agent-composer-microphone'>
              <SpeechToTextButtonBrowser
                authentication={authentication}
                onTranscriptChange={(transcript) => setValue(transcript)}
                onFinalTranscript={(transcript) => setValue(transcript)}
                tooltipID={tooltipID}
              />
            </div>
          )}
          {isSending ? (
            <button
              className='react-autoql-agent-composer-btn is-stop'
              onClick={onCancel}
              aria-label='Stop generating'
              data-tooltip-content='Stop'
              data-tooltip-id={tooltipID}
            >
              <span className='react-autoql-agent-stop-glyph' />
            </button>
          ) : (
            <button
              className={`react-autoql-agent-composer-btn is-send${canSend ? ' can-send' : ''}`}
              onClick={submit}
              disabled={!canSend}
              aria-label='Send message'
            >
              <Icon type='send' />
            </button>
          )}
        </div>

        <div className='react-autoql-agent-composer-toolbar'>
          <ModelSelect
            models={models}
            status={modelsStatus}
            value={llmModel}
            onChange={onModelChange}
            popoverParentElement={popoverParentElement}
            tooltipID={tooltipID}
            isDisabled={isSending}
          />
          <span className='react-autoql-agent-composer-hint'>{isSending ? 'Answering…' : '↵ to send'}</span>
        </div>
      </div>
    )
  },
)

AgentComposer.displayName = 'AgentComposer'

AgentComposer.propTypes = {
  authentication: authenticationType,
  placeholder: PropTypes.string,
  isSending: PropTypes.bool,
  enableVoiceRecord: PropTypes.bool,
  models: PropTypes.array,
  modelsStatus: PropTypes.string,
  llmModel: PropTypes.string,
  onModelChange: PropTypes.func,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  popoverParentElement: PropTypes.any,
  tooltipID: PropTypes.string,
}

AgentComposer.defaultProps = {
  authentication: undefined,
  placeholder: 'Ask a question…',
  isSending: false,
  enableVoiceRecord: false,
  models: [],
  modelsStatus: undefined,
  llmModel: undefined,
  onModelChange: () => {},
  onCancel: () => {},
  popoverParentElement: undefined,
  tooltipID: undefined,
}

export default AgentComposer
