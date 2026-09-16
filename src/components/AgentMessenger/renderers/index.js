import TextItem from './TextItem'
import TableItem from './TableItem'
import StatusItem from './StatusItem'
import SessionEndedItem from './SessionEndedItem'

import './renderers.scss'

export const ITEM_RENDERERS = {
  text: TextItem,
  table: TableItem,
  error: StatusItem,
  status: StatusItem,
  info: StatusItem,
  session_ended: SessionEndedItem,
}

// Anything the API adds that we don't know about yet renders as a status item rather
// than disappearing, so a new response type degrades instead of breaking.
export const resolveRenderer = (type) => ITEM_RENDERERS[type] ?? StatusItem

export { TextItem, TableItem, StatusItem, SessionEndedItem }
