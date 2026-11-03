import React, { useState } from 'react'
import PropTypes from 'prop-types'

import { Icon } from '../../Icon'
import { Popover } from '../../Popover'
import { CustomScrollbars } from '../../CustomScrollbars'

export const SPLIT_SERIES_BUTTON_SIZE = 30
// Space the button takes on the right of the plot, including the gap on either side
export const SPLIT_SERIES_BUTTON_SPACE = SPLIT_SERIES_BUTTON_SIZE + 20

const ICON_SIZE = 20

// The "Split by" button for list query charts. It only starts a split: once the chart is split,
// the legend title takes over (see LegendSelector) and this button is not rendered.
// Styled with the Sankey control button classes so the chart buttons match.
const SplitSeriesButton = ({ splitBy, x, y, chartTooltipID }) => {
  const [isOpen, setIsOpen] = useState(false)

  if (!splitBy?.columns?.length || !splitBy.eligibleColumnIndices?.length) {
    return null
  }

  const iconOffset = (SPLIT_SERIES_BUTTON_SIZE - ICON_SIZE) / 2

  const renderContent = () => (
    <div
      className='legend-selector-container'
      data-test='split-series-selector'
      onClick={(e) => {
        e.stopPropagation()
      }}
    >
      <CustomScrollbars suppressScrollX>
        <ul className='axis-selector-content'>
          {splitBy.eligibleColumnIndices.map((columnIndex) => (
            <li
              className='legend-select-list-item'
              key={`split-series-column-${columnIndex}`}
              onClick={() => {
                setIsOpen(false)
                splitBy.onColumnChange(columnIndex)
              }}
            >
              {splitBy.columns[columnIndex]?.display_name}
            </li>
          ))}
        </ul>
      </CustomScrollbars>
    </div>
  )

  return (
    <g className='split-series-button' data-test='split-series-button'>
      <Popover
        isOpen={isOpen}
        onClickOutside={() => setIsOpen(false)}
        content={renderContent}
        positions={['left', 'bottom', 'top']}
        align='start'
        padding={5}
      >
        <g className='sankey-path-button' transform={`translate(${x}, ${y})`}>
          <rect
            className='sankey-path-button-rect'
            width={SPLIT_SERIES_BUTTON_SIZE}
            height={SPLIT_SERIES_BUTTON_SIZE}
            rx='4'
            strokeWidth='1'
            opacity={0} // CSS opacity: 1 !important keeps it visible in browser; opacity=0 hides it in PNG export
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(!isOpen)
            }}
            data-tooltip-id={chartTooltipID}
            data-tooltip-html='Split into a series for each value of a column'
            style={{ cursor: 'pointer' }}
          />
          <g
            transform={`translate(${iconOffset}, ${iconOffset})`}
            className='sankey-path-button-icon'
            opacity={0} // Hidden in PNG export, same as the rect
            style={{ pointerEvents: 'none' }}
          >
            <foreignObject width={ICON_SIZE} height={ICON_SIZE}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon type='split-series' />
              </div>
            </foreignObject>
          </g>
        </g>
      </Popover>
    </g>
  )
}

SplitSeriesButton.propTypes = {
  splitBy: PropTypes.shape({
    columns: PropTypes.arrayOf(PropTypes.shape({})),
    eligibleColumnIndices: PropTypes.arrayOf(PropTypes.number),
    onColumnChange: PropTypes.func,
  }),
  x: PropTypes.number,
  y: PropTypes.number,
  chartTooltipID: PropTypes.string,
}

SplitSeriesButton.defaultProps = {
  splitBy: undefined,
  x: 0,
  y: 0,
  chartTooltipID: undefined,
}

export default SplitSeriesButton
