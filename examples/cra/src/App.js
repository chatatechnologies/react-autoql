import React, { Component } from 'react'
import { ChatDrawer } from 'chata-ai'

export default class App extends Component {
  state = {
    isVisible: false
  }

  render = () => {
    return (
      <div>
        JLEWKFJLEWFKJEW:FLKEJF
        <ChatDrawer
          isVisible={this.state.isVisible}
          onHandleClick={() =>
            this.setState({ isVisible: !this.state.isVisible })
          }
          placement="bottom"
          showMask
          width="700px"
          handleStyles={{ right: '25px' }}
        />
      </div>
    )
  }
}
