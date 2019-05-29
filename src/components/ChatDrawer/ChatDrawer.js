import React, { Fragment } from 'react'

import PropTypes from 'prop-types'

import styles from './ChatDrawer.css'

class ChatDrawer extends React.Component {
  static propTypes = {
    config: PropTypes.shape({})
  }

  static defaultProps = {
    config: {}
  }

  render = () => {
    return (
      <Fragment>
        <style>{`${styles}`}</style>
        <div className="test">
          <span>Drawer</span>
        </div>
      </Fragment>
    )
  }
}

export default ChatDrawer
