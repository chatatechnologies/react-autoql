import React, { Component } from 'react'
import { ChatDrawer } from 'chata-ai'

class App extends Component {
  state = {
    isVisible: false
  }

  render = () => {
    return (
      <ChatDrawer
        isVisible={this.state.isVisible}
        onHandleClick={() =>
          this.setState({ isVisible: !this.state.isVisible })
        }
        placement="right"
        // maskClosable
        // showMask
        // onVisibleChange={() => {
        //   console.log('on visible change triggered')
        // }}
        // showHandle
        // width="100px"
        // handleStyles={{ left: '25px' }}
        // customHandle={
        //   <div style={{ width: '100px', height: '100px', background: 'red' }}>
        //     HANDLE
        //   </div>
        // }
      />
    )
  }
}

export default App
