import React from 'react'
import { DataExplorerTypes } from 'autoql-fe-utils'

import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

export const SubjectName = ({ subject } = {}) => {
  if (!subject) {
    return null
  }

  var iconType = null
  if (subject.type === DataExplorerTypes.SUBJECT_TYPE) {
    iconType = 'book'
  } else if (subject.type === DataExplorerTypes.VL_TYPE) {
    iconType = 'bookmark'
  }

  let suffix = ''
  if (subject.type === DataExplorerTypes.VL_TYPE && subject.formattedType) {
    suffix = ` (${subject.formattedType})`
  }

  return (
    <ErrorBoundary>
      <span>
        <Icon className='data-explorer-topic-icon' type={iconType} />
        {subject.displayName}
        {suffix}
      </span>
    </ErrorBoundary>
  )
}
