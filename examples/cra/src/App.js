import React, { Component } from 'react'
import { ChatDrawer } from 'chata-ai'

class App extends Component {
  state = {
    isVisible: false
  }

  render = () => {
    return (
      <ChatDrawer
        placement="bottom"
        // maskClosable
        // showMask
        // onVisibleChange={() => {
        //   console.log('on visible change triggered')
        // }}
        isVisible={this.state.isVisible}
        onHandleClick={() =>
          this.setState({ isVisible: !this.state.isVisible })
        }
        // showHandle
        // width="100px"
        // customHandle={
        //   <div style={{ width: '100px', height: '100px', background: 'red' }}>
        //     HANDLE
        //   </div>
        // }
        handleStyles={{ left: '25px' }}
      />
    )
  }
}

export default App
