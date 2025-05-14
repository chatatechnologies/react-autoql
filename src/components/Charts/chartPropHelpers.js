import PropTypes from 'prop-types'
import { dataFormattingDefault } from 'autoql-fe-utils'

import { dataFormattingType } from '../../props/types'

export const chartContainerPropTypes = {
  dataFormatting: dataFormattingType,

  data: PropTypes.arrayOf(PropTypes.array).isRequired,
  columns: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  numberColumnIndices: PropTypes.arrayOf(PropTypes.number).isRequired,
  stringColumnIndices: PropTypes.arrayOf(PropTypes.number).isRequired,
  stringColumnIndex: PropTypes.number,
  numberColumnIndex: PropTypes.number,
  legendColumnIndex: PropTypes.number,
  enableDynamicCharting: PropTypes.bool,
  legendLocation: PropTypes.string,
  isResizing: PropTypes.bool,
  onLegendClick: PropTypes.func,
  onLabelChange: PropTypes.func,
  onXAxisClick: PropTypes.func,
  onYAxisClick: PropTypes.func,
}

export const chartContainerDefaultProps = {
  dataFormatting: dataFormattingDefault,

  enableDynamicCharting: true,
  legendColumnIndex: undefined,
  isResizing: false,
  onLegendClick: () => {},
  onXAxisClick: () => {},
  onYAxisClick: () => {},
  onLabelChange: () => {},
}

export const chartPropTypes = {
  ...chartContainerPropTypes,
  visibleSeriesIndices: PropTypes.arrayOf(PropTypes.number).isRequired,
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  deltaX: PropTypes.number,
  deltaY: PropTypes.number,
}

export const chartDefaultProps = {
  ...chartContainerDefaultProps,
  deltaX: 0,
  deltaY: 0,
}

export const axesPropTypes = {
  ...chartPropTypes,
  xScale: PropTypes.func.isRequired,
  yScale: PropTypes.func.isRequired,
  innerHeight: PropTypes.number,
  innerWidth: PropTypes.number,
  onLabelRotation: PropTypes.func,
}

export const axesDefaultProps = {
  ...chartDefaultProps,
  innerHeight: 0,
  innerWidth: 0,
  onLabelRotation: () => {},
}

export const chartElementPropTypes = {
  ...chartPropTypes,
  xScale: PropTypes.func.isRequired,
  yScale: PropTypes.func.isRequired,
}

export const chartElementDefaultProps = {
  activeKey: undefined,
  onChartClick: () => {},
}
