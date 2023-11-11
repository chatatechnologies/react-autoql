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

  return (
    <ErrorBoundary>
      <div
        className={`react-autoql-data-limit-warning ${props.className ?? ''}`}
        data-tooltip-content={`This chart has reached its data limit of ${rowLimitFormatted} rows. Despite appearances, extensive data has been used for calculations by grouping similar categories. To visualize all your data, try narrowing down the time-frame in your query.`}
        data-tooltip-id={props.tooltipID}
      >
        <Icon type='warning' />
        <span>
          <strong>Warning:</strong> Data limit reached! To optimize performance, the visualization is currently limited
          to the initial <em>{rowLimitFormatted}</em> rows of data.
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
