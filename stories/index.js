import React from 'react'
import { storiesOf } from '@storybook/react'
import { Button } from '@storybook/react/demo'
import { ChatDrawer } from '../src'

storiesOf('Chat Components', module)
  .add('Chat Drawer', () => <ChatDrawer />)
  .add('Chat Embedded', () => <div />)
