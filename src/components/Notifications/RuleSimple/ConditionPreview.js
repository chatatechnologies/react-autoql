import React from 'react'
import PropTypes from 'prop-types'
import { DATA_ALERT_OPERATORS } from 'autoql-fe-utils'

const parseNumber = (v) => {
  if (v === undefined || v === null) return Number.NaN
  if (typeof v === 'number') return v
  const str = String(v).replaceAll(/[,\s]/g, '')
  if (str.endsWith('%')) {
    const p = Number.parseFloat(str.slice(0, -1))
    return Number.isNaN(p) ? Number.NaN : p / 100
  }
  const n = Number.parseFloat(str)
  return Number.isNaN(n) ? Number.NaN : n
}

const ConditionPreview = ({
  firstQueryResult,
  firstQuerySelectedColumns,
  secondTermType,
  secondInputValue,
  secondQueryResult,
  secondTermMultiplicationFactorType,
  secondTermMultiplicationFactorValue,
  selectedOperator,
}) => {
  const currentValueRaw =
    firstQueryResult?.data?.data?.rows?.[0]?.[firstQuerySelectedColumns?.[0]] ??
    firstQueryResult?.data?.data?.rows?.[0]?.[0]

  const currentValue = parseNumber(currentValueRaw)
  const stType = (secondTermType || '').toString().toLowerCase()
  const hasCurrent = !Number.isNaN(currentValue)

  const referenceRaw = secondQueryResult?.data?.data?.rows?.[0]?.[0] ?? currentValueRaw
  const reference = parseNumber(referenceRaw)

  let baseComparedValue
  if (stType === 'query') baseComparedValue = reference
  else if (stType === 'number' || stType === 'constant') {
    const trimmed = String(secondInputValue ?? '').trim()
    if (trimmed.endsWith('%')) {
      const p = parseNumber(trimmed)
      baseComparedValue = hasCurrent ? reference * p : Number.NaN
    } else baseComparedValue = parseNumber(trimmed)
  } else baseComparedValue = reference

  let threshold = Number.NaN
  if (!Number.isNaN(baseComparedValue)) {
    const op = secondTermMultiplicationFactorType
    const val = parseNumber(secondTermMultiplicationFactorValue)
    if (op === 'multiply-percent-higher') threshold = baseComparedValue * (1 + (Number.isNaN(val) ? 0 : val / 100))
    else if (op === 'multiply-percent-lower') threshold = baseComparedValue * (1 - (Number.isNaN(val) ? 0 : val / 100))
    else if (op === 'multiply') threshold = baseComparedValue * (Number.isNaN(val) ? 1 : val)
    else if (op === 'add') threshold = baseComparedValue + (Number.isNaN(val) ? 0 : val)
    else if (op === 'subtract') threshold = baseComparedValue - (Number.isNaN(val) ? 0 : val)
    else threshold = Number.isFinite(baseComparedValue) ? baseComparedValue : Number.NaN
  }

  const hasThreshold = !Number.isNaN(threshold)

  const maxVal = (() => {
    if (hasCurrent && hasThreshold) return Math.max(Math.abs(currentValue), Math.abs(threshold)) * 1.4
    if (hasCurrent) return Math.abs(currentValue) * 1.4 || 1
    if (hasThreshold) return Math.abs(threshold) * 1.4 || 1
    return 100
  })()

  const currentPct = hasCurrent ? Math.min(100, (Math.abs(currentValue) / maxVal) * 100) : 0
  const thresholdPct = hasThreshold ? Math.min(100, (Math.abs(threshold) / maxVal) * 100) : 0

  const referenceValue = parseNumber(referenceRaw)
  const hasReference = !Number.isNaN(referenceValue)
  const referencePct = hasReference ? Math.min(100, (Math.abs(referenceValue) / maxVal) * 100) : 0

  const NUM_TICKS = 6
  const ticks = Array.from({ length: NUM_TICKS + 1 }, (_, i) => {
    const v = (maxVal * i) / NUM_TICKS
    return { value: Math.round(v), pct: (i / NUM_TICKS) * 100 }
  })

  const operatorKey = (selectedOperator || '').toString()
  const operatorObj = DATA_ALERT_OPERATORS?.[operatorKey]
  const operatorLabel = (operatorObj?.conditionText || '').toString().toLowerCase()

  const keyUpper = operatorKey.toUpperCase()
  const hasEqual = keyUpper.includes('EQUAL') || operatorLabel.includes('equal')
  const hasGreater = keyUpper.includes('GREATER') || keyUpper.includes('GT') || operatorLabel.includes('greater')
  const hasLess = keyUpper.includes('LESS') || keyUpper.includes('LT') || operatorLabel.includes('less')

  const isNotKeyword = keyUpper.includes('NOT') || operatorLabel.includes('not')
  const isEqualOperator = hasEqual && !hasGreater && !hasLess && !isNotKeyword
  const isNotEqualOperator = isNotKeyword && hasEqual && !hasGreater && !hasLess

  const alertLeft = hasLess || operatorLabel.includes('lower')
  const alertRight = keyUpper && !alertLeft && !isEqualOperator && !isNotEqualOperator

  const getValueIfIsFinite = (value) => {
    return Number.isFinite(value) ? value : String(value)
  }

  // Render alert zone(s) and label based on operator semantics.
  const renderAlert = () => {
    if (!hasThreshold) return null

    // Equality: small centered band
    if (isEqualOperator) {
      const bandPct = 4
      let leftPct = Math.max(0, thresholdPct - bandPct / 2)
      if (leftPct + bandPct > 100) leftPct = 100 - bandPct
      return (
        <div className='condition-preview-alert-zone center' style={{ left: `${leftPct}%`, width: `${bandPct}%` }} />
      )
    }

    // Not-equal: full overlay (alarms everywhere)
    if (isNotEqualOperator) {
      return <div className='condition-preview-alert-zone' style={{ left: `0%`, width: `100%` }} />
    }

    // Less-than: alert to the left of threshold
    if (alertLeft) {
      return <div className='condition-preview-alert-zone left' style={{ left: `0%`, width: `${thresholdPct}%` }} />
    }

    // Greater-than: alert to the right of threshold
    return (
      <div
        className='condition-preview-alert-zone right'
        style={{ left: `${thresholdPct}%`, width: `${100 - thresholdPct}%` }}
      />
    )
  }

  return (
    <div className='condition-preview-container'>
      <div className='condition-preview-bar' aria-hidden>
        <div className='condition-preview-range' />

        {/* alert zone overlay */}
        {renderAlert()}

        <div
          className='condition-preview-threshold'
          style={{ left: `${thresholdPct}%` }}
          title={hasThreshold ? `Threshold: ${getValueIfIsFinite(threshold)}` : 'Threshold'}
        />

        <div
          className='condition-preview-current'
          style={{ left: `${currentPct}%` }}
          title={hasCurrent ? `Current: ${getValueIfIsFinite(currentValue)}` : 'Current'}
        />

        {/* reference diamond */}
        {hasReference && (
          <div
            className='condition-preview-reference'
            style={{ left: `${referencePct}%` }}
            title={`Reference X: ${referenceValue}`}
          />
        )}

        {/* ticks */}
        <div className='condition-preview-ticks'>
          {ticks.map((t) => (
            <div key={`tick-${t.value}-${t.pct}`} className='condition-preview-tick' style={{ left: `${t.pct}%` }}>
              <div className='tick-mark' />
              <div className='tick-label'>{t.value}</div>
            </div>
          ))}
        </div>

        {/* legend placed under the scale inside the bar so it's visually tied to ticks */}
        <div className='condition-preview-legend'>
          <span className='legend-item'>
            <span className='legend-swatch current' /> Current {hasCurrent ? `(${currentValue})` : ''}
          </span>
          <span className='legend-item'>
            <span className='legend-swatch threshold' /> Threshold {hasThreshold ? `(${threshold})` : ''}
          </span>
          {hasThreshold && (isEqualOperator || isNotEqualOperator || alertLeft || alertRight) && (
            <span className='legend-item'>
              <span className='legend-swatch alert' /> Alert Zone
            </span>
          )}
          {hasReference && (
            <span className='legend-item'>
              <span className='legend-swatch reference' /> Reference X {`(${referenceValue})`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

ConditionPreview.propTypes = {
  firstQueryResult: PropTypes.object,
  firstQuerySelectedColumns: PropTypes.array,
  secondTermType: PropTypes.string,
  secondInputValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  secondQueryResult: PropTypes.object,
  secondTermMultiplicationFactorType: PropTypes.string,
  secondTermMultiplicationFactorValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selectedOperator: PropTypes.string,
}

export default ConditionPreview
