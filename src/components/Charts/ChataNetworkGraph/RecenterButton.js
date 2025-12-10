import React from 'react'
import PropTypes from 'prop-types'
import { MdOutlineFitScreen } from 'react-icons/md'

const RecenterButton = (props) => {
  const { onRecenter, chartTooltipID, chartWidth, buttonX, buttonY } = props

  return (
    <g className='recenter-button' transform={`translate(${buttonX}, ${buttonY})`}>
      <rect
        className='recenter-button-rect'
        width='30'
        height='30'
        rx='4'
        strokeWidth='1'
        opacity={0} // Use opacity 0 so it doesnt show in the exported PNG
        onClick={onRecenter}
        data-tooltip-id={chartTooltipID}
        data-tooltip-html='Fit to screen'
      />
      <g transform='translate(5, 5)'>
        {/* Use opacity 0 so it doesnt show in the exported PNG */}
        <MdOutlineFitScreen className='recenter-button-icon' size={20} style={{ opacity: 0 }} />
      </g>
    </g>
  )
}

RecenterButton.propTypes = {
  onRecenter: PropTypes.func.isRequired,
  chartTooltipID: PropTypes.string.isRequired,
  chartWidth: PropTypes.number.isRequired,
  buttonX: PropTypes.number.isRequired,
  buttonY: PropTypes.number.isRequired,
}

export default RecenterButton

