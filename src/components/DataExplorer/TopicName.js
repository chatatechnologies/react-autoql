import React from 'react'
import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'
import { DataExplorerTypes } from 'autoql-fe-utils'

export const TopicName = ({ topic } = {}) => {
  if (!topic) {
    return null
  }

  var iconType = null
  if (topic.type === DataExplorerTypes.SUBJECT_TYPE) {
    iconType = 'book'
  } else if (topic.type === DataExplorerTypes.VL_TYPE) {
    iconType = 'bookmark'
  }

  return (
    <ErrorBoundary>
      <span>
        <Icon className='data-explorer-topic-icon' type={iconType} />
        {topic.display_name}
      </span>
    </ErrorBoundary>
  )
}
