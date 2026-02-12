import React from 'react'
import PropTypes from 'prop-types'
import { DATA_ALERT_OPERATORS } from 'autoql-fe-utils'

const parseNumber = (v) => {
  if (v === undefined || v === null) return NaN
  if (typeof v === 'number') return v
  const str = String(v).replace(/[,\s]/g, '')
  if (str.endsWith('%')) {
    const p = parseFloat(str.slice(0, -1))
    return isNaN(p) ? NaN : p / 100
  }
  const n = parseFloat(str)
  return isNaN(n) ? NaN : n
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
  const hasCurrent = !isNaN(currentValue)

  const referenceRaw = secondQueryResult?.data?.data?.rows?.[0]?.[0] ?? currentValueRaw
  const reference = parseNumber(referenceRaw)

  let baseComparedValue = NaN
  if (stType === 'query') baseComparedValue = reference
  else if (stType === 'number') {
    const trimmed = String(secondInputValue ?? '').trim()
    if (trimmed.endsWith('%')) {
      const p = parseNumber(trimmed)
      baseComparedValue = hasCurrent ? reference * p : NaN
    } else baseComparedValue = parseNumber(trimmed)
  } else baseComparedValue = reference

  let threshold = NaN
  if (!isNaN(baseComparedValue)) {
    const op = secondTermMultiplicationFactorType
    const val = parseNumber(secondTermMultiplicationFactorValue)
    if (op === 'multiply-percent-higher') threshold = baseComparedValue * (1 + (isNaN(val) ? 0 : val / 100))
    else if (op === 'multiply-percent-lower') threshold = baseComparedValue * (1 - (isNaN(val) ? 0 : val / 100))
    else if (op === 'multiply') threshold = baseComparedValue * (isNaN(val) ? 1 : val)
    else if (op === 'add') threshold = baseComparedValue + (isNaN(val) ? 0 : val)
    else if (op === 'subtract') threshold = baseComparedValue - (isNaN(val) ? 0 : val)
    else threshold = !isNaN(baseComparedValue) ? baseComparedValue : NaN
  }

  const hasThreshold = !isNaN(threshold)

  const maxVal = (() => {
    if (hasCurrent && hasThreshold) return Math.max(Math.abs(currentValue), Math.abs(threshold)) * 1.4
    if (hasCurrent) return Math.abs(currentValue) * 1.4 || 1
    if (hasThreshold) return Math.abs(threshold) * 1.4 || 1
    return 100
  })()

  const currentPct = hasCurrent ? Math.min(100, (Math.abs(currentValue) / maxVal) * 100) : 0
  const thresholdPct = hasThreshold ? Math.min(100, (Math.abs(threshold) / maxVal) * 100) : 0

  const referenceValue = parseNumber(referenceRaw)
  const hasReference = !isNaN(referenceValue)
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

  const isEqualOperator = hasEqual && !hasGreater && !hasLess
  const isNotEqualOperator = keyUpper.includes('NOT') && hasEqual && !hasGreater && !hasLess

  const alertLeft = hasLess || operatorLabel.includes('lower')
  const alertRight = keyUpper && !alertLeft && !isEqualOperator && !isNotEqualOperator

  // Precompute alert zone elements to simplify JSX
  const alertZoneElements = []
  const alertLabelElement = (() => {
    if (!hasThreshold) return null
    if (isEqualOperator) {
      const bandPct = 6
      let leftPct = Math.max(0, thresholdPct - bandPct / 2)
      if (leftPct + bandPct > 100) leftPct = 100 - bandPct
      const center = leftPct + bandPct / 2
      return (
        <div className='condition-preview-alert-label' style={{ left: `${center}%`, transform: 'translateX(-50%)' }}>
          Alert Zone
        </div>
      )
    }
    if (isNotEqualOperator)
      return (
        <div className='condition-preview-alert-label' style={{ left: `100%`, transform: 'translateX(-100%)' }}>
          Alert Zone
        </div>
      )
    if (alertLeft)
      return (
        <div className='condition-preview-alert-label' style={{ left: `0%`, transform: 'translateX(0%)' }}>
          Alert Zone
        </div>
      )
    return (
      <div className='condition-preview-alert-label' style={{ left: `100%`, transform: 'translateX(-100%)' }}>
        Alert Zone
      </div>
    )
  })()

  if (hasThreshold && isEqualOperator) {
    const bandPct = 6
    let leftPct = Math.max(0, thresholdPct - bandPct / 2)
    if (leftPct + bandPct > 100) leftPct = 100 - bandPct
    alertZoneElements.push(
      <div
        key='alert-center'
        className='condition-preview-alert-zone center'
        style={{ left: `${leftPct}%`, width: `${bandPct}%` }}
        title='Alert zone'
      />,
    )
  } else if (hasThreshold && isNotEqualOperator) {
    const neutralPct = 6
    const leftWidth = Math.max(0, Math.max(0, thresholdPct - neutralPct / 2))
    const rightLeft = Math.min(100, thresholdPct + neutralPct / 2)
    const rightWidth = Math.max(0, 100 - rightLeft)
    if (leftWidth > 0)
      alertZoneElements.push(
        <div
          key='alert-left'
          className='condition-preview-alert-zone left'
          style={{ left: `0%`, width: `${leftWidth}%` }}
          title='Alert zone'
        />,
      )
    if (rightWidth > 0)
      alertZoneElements.push(
        <div
          key='alert-right'
          className='condition-preview-alert-zone right'
          style={{ left: `${rightLeft}%`, width: `${rightWidth}%` }}
          title='Alert zone'
        />,
      )
  } else if (hasThreshold && !isEqualOperator && !isNotEqualOperator && alertLeft) {
    alertZoneElements.push(
      <div
        key='alert-left-full'
        className='condition-preview-alert-zone left'
        style={{ left: `0%`, width: `${thresholdPct}%` }}
        title='Alert zone'
      />,
    )
  } else if (hasThreshold && !isEqualOperator && !isNotEqualOperator && alertRight) {
    alertZoneElements.push(
      <div
        key='alert-right-full'
        className='condition-preview-alert-zone right'
        style={{ left: `${thresholdPct}%`, width: `${100 - thresholdPct}%` }}
        title='Alert zone'
      />,
    )
  }

  return (
    <div className='condition-preview-container'>
      <div className='condition-preview-bar' aria-hidden>
        <div className='condition-preview-range' />

        {/* alert zone overlay */}
        {hasThreshold &&
          isEqualOperator &&
          (() => {
            // center a small band around the threshold for equality
            const bandPct = 6 // percent of full width to highlight for equality
            let leftPct = Math.max(0, thresholdPct - bandPct / 2)
            if (leftPct + bandPct > 100) leftPct = 100 - bandPct
            return (
              <div
                className='condition-preview-alert-zone center'
                style={{ left: `${leftPct}%`, width: `${bandPct}%` }}
                title='Alert zone'
              />
            )
          })()}

        {hasThreshold &&
          isNotEqualOperator &&
          (() => {
            // shade both sides outside a small neutral band around threshold
            const neutralPct = 6
            const leftWidth = Math.max(0, Math.max(0, thresholdPct - neutralPct / 2))
            const rightLeft = Math.min(100, thresholdPct + neutralPct / 2)
            const rightWidth = Math.max(0, 100 - rightLeft)
            return (
              <>
                {leftWidth > 0 && (
                  <div
                    className='condition-preview-alert-zone left'
                    style={{ left: `0%`, width: `${leftWidth}%` }}
                    title='Alert zone'
                  />
                )}
                {rightWidth > 0 && (
                  <div
                    className='condition-preview-alert-zone right'
                    style={{ left: `${rightLeft}%`, width: `${rightWidth}%` }}
                    title='Alert zone'
                  />
                )}
              </>
            )
          })()}

        {hasThreshold && !isEqualOperator && !isNotEqualOperator && alertLeft && (
          <div
            className='condition-preview-alert-zone left'
            style={{ left: `0%`, width: `${thresholdPct}%` }}
            title='Alert zone'
          />
        )}
        {/* alert label */}
        {hasThreshold &&
          (isEqualOperator || isNotEqualOperator || alertRight || alertLeft) &&
          (() => {
            if (isEqualOperator) {
              // center label above band
              const bandPct = 6
              let leftPct = Math.max(0, thresholdPct - bandPct / 2)
              if (leftPct + bandPct > 100) leftPct = 100 - bandPct
              const center = leftPct + bandPct / 2
              return (
                <div
                  className='condition-preview-alert-label'
                  style={{ left: `${center}%`, transform: 'translateX(-50%)' }}
                >
                  Alert Zone
                </div>
              )
            }

            if (isNotEqualOperator) {
              // place label near right edge
              return (
                <div className='condition-preview-alert-label' style={{ left: `100%`, transform: 'translateX(-100%)' }}>
                  Alert Zone
                </div>
              )
            }

            if (alertLeft) {
              return (
                <div className='condition-preview-alert-label' style={{ left: `0%`, transform: 'translateX(0%)' }}>
                  Alert Zone
                </div>
              )
            }

            // default to right
            return (
              <div className='condition-preview-alert-label' style={{ left: `100%`, transform: 'translateX(-100%)' }}>
                Alert Zone
              </div>
            )
          })()}
        {hasThreshold && !isEqualOperator && !isNotEqualOperator && alertRight && (
          <div
            className='condition-preview-alert-zone right'
            style={{ left: `${thresholdPct}%`, width: `${100 - thresholdPct}%` }}
            title='Alert zone'
          />
        )}

        <div
          className='condition-preview-threshold'
          style={{ left: `${thresholdPct}%` }}
          title={
            hasThreshold ? `Threshold: ${Number.isFinite(threshold) ? threshold : String(threshold)}` : 'Threshold'
          }
        />

        <div
          className='condition-preview-current'
          style={{ left: `${currentPct}%` }}
          title={
            hasCurrent ? `Current: ${Number.isFinite(currentValue) ? currentValue : String(currentValue)}` : 'Current'
          }
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
          {ticks.map((t, i) => (
            <div key={`tick-${i}`} className='condition-preview-tick' style={{ left: `${t.pct}%` }}>
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
