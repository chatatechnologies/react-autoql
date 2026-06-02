import React from 'react'
import PropTypes from 'prop-types'
import { dataFormattingDefault } from 'autoql-fe-utils'
import { dataFormattingType } from '../../props/types'
import { Icon } from '../Icon'
import SimpleTable from '../SimpleTable/SimpleTable'

import './FollowOnResult.scss'

export default function FollowOnResult({ columns, rows, dataFormatting, question }) {
  return (
    <div className='follow-on-result'>
      <div className='follow-on-result-label'>
        <Icon type='reply' />
        {question || 'Follow-on result'}
      </div>
      <SimpleTable columns={columns} rows={rows} dataFormatting={dataFormatting} />
    </div>
  )
}

FollowOnResult.propTypes = {
  columns: PropTypes.array,
  rows: PropTypes.array,
  dataFormatting: dataFormattingType,
  question: PropTypes.string,
}

FollowOnResult.defaultProps = {
  columns: [],
  rows: [],
  dataFormatting: dataFormattingDefault,
  question: '',
}
