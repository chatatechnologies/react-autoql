import React from 'react'
import PropTypes from 'prop-types'
import { MAX_DATA_PAGE_SIZE, dataFormattingDefault, getDataFormatting } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import { dataFormattingType } from '../../props/types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './DataLimitWarning.scss'

function DataLimitWarning(props = {}) {
  const languageCode = getDataFormatting(props.dataFormatting).languageCode
  const rowLimitFormatted = new Intl.NumberFormat(languageCode, {}).format(props.rowLimit)
  const maxChartElements = 300

  return (
    <ErrorBoundary>
      <div
        className={`react-autoql-data-limit-warning ${props.className ?? ''}`}
        data-tooltip-content={`To optimize performance, the visualization is limited to the initial <em>${rowLimitFormatted}</em> rows of data or ${maxChartElements} chart elements - whichever occurs first.`}
        data-tooltip-id={props.tooltipID}
      >
        <Icon type='warning' />
        <span>
          <strong>Warning:</strong> Data limit reached!
        </span>
      </div>
    </ErrorBoundary>
  )
}

DataLimitWarning.propTypes = {
  className: PropTypes.string,
  rowLimit: PropTypes.number,
  tooltipID: PropTypes.string,
  dataFormatting: dataFormattingType,
}

DataLimitWarning.defaultProps = {
  rowLimit: MAX_DATA_PAGE_SIZE,
  dataFormatting: dataFormattingDefault,
}

export default DataLimitWarning
