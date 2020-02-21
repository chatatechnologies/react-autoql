import React from 'react'
import { storiesOf } from '@storybook/react'
import { Button } from '@storybook/react/demo'
import { DataMessenger } from '../src'

storiesOf('Chat Components', module)
  .add('Chat Drawer', () => <DataMessenger isVisible />)
  .add('Chat Embedded', () => <div />)
