import React from 'react'

import './Spinner.scss'

function Spinner (props) {
  return (
    <div className="spinner-loader" data-test="chata-spinner" {...props}></div>
  )
}

export default Spinner
