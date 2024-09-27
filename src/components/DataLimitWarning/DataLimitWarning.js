import React from 'react'
import PropTypes from 'prop-types'
import { MAX_CHART_ELEMENTS, MAX_DATA_PAGE_SIZE, dataFormattingDefault, getDataFormatting } from 'autoql-fe-utils'
import { DATASET_TOO_LARGE } from '../../js/Constants'

import { Icon } from '../Icon'
import { dataFormattingType } from '../../props/types'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

import './DataLimitWarning.scss'

function DataLimitWarning(props = {}) {
  const languageCode = getDataFormatting(props.dataFormatting).languageCode
  const rowLimitFormatted = new Intl.NumberFormat(languageCode, {}).format(props.rowLimit)
  const chartElementLimitFormatted = new Intl.NumberFormat(languageCode, {}).format(props.maxChartElements)

  return (
    <ErrorBoundary>
      <div
        className={`react-autoql-data-limit-warning ${props.className ?? ''}`}
        data-tooltip-html={
          props.tooltipContent ??
          `To optimize performance, the visualization is limited to the initial <em>${rowLimitFormatted}</em> rows of data or <em>${chartElementLimitFormatted}</em> chart elements - whichever occurs first.`
        }
        data-tooltip-id={props.tooltipID}
      >
        <Icon type='warning' />
        <span>
          <strong>Warning:</strong> {props.content}
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
  maxChartElements: PropTypes.number,
  tooltipContent: PropTypes.string,
  content: PropTypes.string,
}

DataLimitWarning.defaultProps = {
  rowLimit: MAX_DATA_PAGE_SIZE,
  dataFormatting: dataFormattingDefault,
  maxChartElements: MAX_CHART_ELEMENTS,
  content: DATASET_TOO_LARGE,
}

export default DataLimitWarning
