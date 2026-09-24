import React from 'react'
import { BLOCK_INFO, HEADING_LEVELS, RB } from '../constants'
import { STRINGS } from '../strings'
import { Icon } from './icons'
import { SectionLabel, SelectField } from './controls'

// The details layer (Figma Assets' "Details" pattern): what the block is, a preview, the properties it
// can be inserted with, and an explicit Insert. The draft chosen here is what the new block starts as.

const SAMPLE_BARS = [62, 49, 41, 37, 33, 14]

const SampleChart = () => (
  <svg className={`${RB}-sample-chart`} viewBox='0 0 180 70' role='img' aria-label='Sample column chart'>
    <line x1='8' y1='62' x2='176' y2='62' stroke='currentColor' strokeOpacity='0.25' />
    {SAMPLE_BARS.map((value, i) => (
      <rect key={i} x={14 + i * 27} y={62 - value} width='18' height={value} rx='1.5' fill='#26A7E9' />
    ))}
  </svg>
)

const Sample = ({ type, draft }) => {
  switch (type) {
    case 'heading':
      return (
        <div className={`${RB}-heading`} data-level={draft.level}>
          Revenue performance
        </div>
      )
    case 'text':
      return (
        <p className={`${RB}-text`}>
          Revenue grew in five of six regions this quarter. South led at $1.42M, up 18% on Q2.
        </p>
      )
    case 'data':
      return (
        <div className={`${RB}-data`}>
          <div className={`${RB}-data-title`}>Revenue by region</div>
          <SampleChart />
        </div>
      )
    case 'pagebreak':
      return (
        <div className={`${RB}-page-break`} role='separator'>
          <span>{STRINGS.pageBreak}</span>
        </div>
      )
    default:
      return null
  }
}

export const defaultDraft = (type) => (type === 'heading' ? { level: 2 } : {})

// Escape is handled by the builder root, which also uses it to clear the selection.
export class BlockDetails extends React.Component {
  insertRef = React.createRef()

  componentDidMount() {
    this.insertRef.current?.focus?.()
  }

  componentDidUpdate(prevProps) {
    if (prevProps.type !== this.props.type) {
      this.insertRef.current?.focus?.()
    }
  }

  render() {
    const { type, draft, position, onDraftChange, onInsert, onClose } = this.props
    const info = BLOCK_INFO[type]
    const nameId = `${RB}-details-name-${type}`
    return (
      <>
        <div className={`${RB}-details-backdrop`} onMouseDown={onClose} />
        <div
          className={`${RB}-details`}
          role='dialog'
          aria-modal='true'
          aria-labelledby={nameId}
          style={position ? { top: position.top, left: position.left } : undefined}
          data-test='report-builder-details'
        >
          <div className={`${RB}-details-header`}>
            <Icon name={type} size={16} />
            <div className={`${RB}-details-heading`}>
              <b>{STRINGS.details}</b>
              <span>{STRINGS.detailsSub}</span>
            </div>
            <button type='button' className={`${RB}-icon-button`} aria-label={STRINGS.close} onClick={onClose}>
              <Icon name='close' />
            </button>
          </div>
          <div className={`${RB}-details-preview`}>
            <div className={`${RB}-details-caption`}>{STRINGS.previewSample}</div>
            <div className={`${RB}-paper ${RB}-details-paper`} aria-hidden='true'>
              <Sample type={type} draft={draft} />
            </div>
          </div>
          <div className={`${RB}-details-body`}>
            <div className={`${RB}-details-name`} id={nameId}>
              {info.label}
            </div>
            <p className={`${RB}-details-what`}>{info.what}</p>
            <button
              ref={this.insertRef}
              type='button'
              className={`${RB}-button`}
              data-variant='primary'
              data-test='report-builder-insert'
              onClick={onInsert}
            >
              {STRINGS.insert}
            </button>
            {type === 'heading' ? (
              <div className={`${RB}-details-props`}>
                <SectionLabel>{STRINGS.properties}</SectionLabel>
                <SelectField
                  label={STRINGS.panel.level}
                  value={draft.level}
                  options={HEADING_LEVELS}
                  onChange={(level) => onDraftChange({ ...draft, level })}
                />
              </div>
            ) : null}
            <p className={`${RB}-note`}>{info.note}</p>
          </div>
        </div>
      </>
    )
  }
}
