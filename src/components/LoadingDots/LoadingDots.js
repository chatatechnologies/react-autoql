import React from 'react'
import { withTheme } from '../../theme'

import './LoadingDots.scss'

function LoadingDots() {
  return (
    <div className="response-loading" data-test="loading-dots">
      <div />
      <div />
      <div />
      <div />
    </div>
  )
}

export default withTheme(LoadingDots)
