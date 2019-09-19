import React, { Fragment } from 'react'

import styles from './LoadingDots.css'

function LoadingDots () {
  return (
    <Fragment>
      <style>{`${styles}`}</style>
      <div className="response-loading">
        <div />
        <div />
        <div />
        <div />
      </div>
    </Fragment>
  )
}

export default LoadingDots
