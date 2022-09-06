import React from 'react'
import { Icon } from '../Icon'
import ErrorBoundary from '../../containers/ErrorHOC/ErrorHOC'

export const TopicName = ({ topic } = {}) => {
  const SUBJECT_TYPE = 'subject'
  const VL_TYPE = 'VL'

  if (!topic) {
    return null
  }

  var iconType = null
  if (topic.type === SUBJECT_TYPE) {
    iconType = 'book'
  } else if (topic.type === VL_TYPE) {
    iconType = 'bookmark'
  }

  return (
    <ErrorBoundary>
      <span>
        <Icon className="data-explorer-topic-icon" type={iconType} />
        {topic.name}
      </span>
    </ErrorBoundary>
  )
}
