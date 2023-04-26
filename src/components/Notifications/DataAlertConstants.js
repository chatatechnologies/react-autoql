import React from 'react'
import { getDayLocalStartDate, getMonthLocalStartDate, getWeekLocalStartDate } from './helpers'

export const CUSTOM_TYPE = 'CUSTOM'
export const PROJECT_TYPE = 'PROJECT'
export const PERIODIC_TYPE = 'PERIODIC'
export const CONTINUOUS_TYPE = 'CONTINUOUS'
export const SCHEDULED_TYPE = 'SCHEDULED'
export const COMPARE_TYPE = 'COMPARE'
export const EXISTS_TYPE = 'EXISTS'
export const NUMBER_TERM_TYPE = 'CONSTANT'
export const QUERY_TERM_TYPE = 'QUERY'
export const GROUP_TERM_TYPE = 'GROUP'
export const DEFAULT_CHECK_FREQUENCY = 5

export const DATA_ALERT_OPERATORS = {
  GREATER_THAN: {
    displayName: (
      <span>
        Is <strong>greater</strong> than
      </span>
    ),
    symbol: '>',
    conditionText: 'exceeds',
    conditionTextPast: 'exceeded',
  },
  GREATER_THAN_EQUAL_TO: {
    displayName: (
      <span>
        Is <strong>greater</strong> than <strong>or equal</strong> to
      </span>
    ),
    symbol: '>=',
    conditionText: 'is equal to or exceeds',
    conditionTextPast: 'was equal to or exceeded',
  },
  LESS_THAN: {
    displayName: (
      <span>
        Is <strong>less</strong> than
      </span>
    ),
    symbol: '<',
    conditionText: 'falls below',
    conditionTextPast: 'fell below',
  },
  LESS_THAN_EQUAL_TO: {
    displayName: (
      <span>
        Is <strong>less</strong> than <strong>or equal</strong> to
      </span>
    ),
    symbol: '<=',
    conditionText: 'is equal to or falls below',
    conditionTextPast: 'was equal to or fell below',
  },
  EQUAL_TO: {
    displayName: (
      <span>
        Is <strong>equal</strong> to
      </span>
    ),
    symbol: '=',
    conditionText: 'equals',
    conditionTextPast: 'was equal to',
  },
  // Keep these for reference
  // NOT_EQUAL_TO: {},
  // NOT_EXISTS: {},
  // AND: {},
  // OR: {},
  // TERMINATOR: {}
}

export const DATA_ALERT_CONDITION_TYPES = {
  [COMPARE_TYPE]: {
    displayName: 'When a specific condition is met',
  },
  [EXISTS_TYPE]: {
    displayName: 'If new data is detected',
  },
}

export const DATA_ALERT_FREQUENCY_TYPE_OPTIONS = {
  [SCHEDULED_TYPE]: {
    label: 'at the following times:',
    listLabel: 'at the following times',
  },
  [CONTINUOUS_TYPE]: {
    label: 'right away.',
    listLabel: 'right away',
  },
}

export const SCHEDULE_INTERVAL_OPTIONS = {
  DAY: {
    displayName: (
      <span>
        Every <strong>day</strong>
      </span>
    ),
    getLocalStartDate: getDayLocalStartDate,
  },
  WEEK: {
    displayName: (
      <span>
        Every <strong>week</strong>
      </span>
    ),
    getLocalStartDate: getWeekLocalStartDate,
  },
  MONTH: {
    displayName: (
      <span>
        Every <strong>month</strong>
      </span>
    ),
    getLocalStartDate: getMonthLocalStartDate,
  },
  // Not supporting for now
  // YEAR: {
  //   displayName: (
  //     <span>
  //       Every <strong>year</strong>
  //     </span>
  //   ),
  // },
}

export const RESET_PERIOD_OPTIONS = {
  DAY: {
    displayName: (
      <span>
        At most once <strong>every 24 hours</strong>
      </span>
    ),
  },
  WEEK: {
    displayName: (
      <span>
        At most <strong>once a week</strong>
      </span>
    ),
  },
  MONTH: {
    displayName: (
      <span>
        At most <strong>once a month</strong>
      </span>
    ),
  },
  // Not supporting for now
  // YEAR: {
  //   displayName: (
  //     <span>
  //       At most <strong>once a year</strong>
  //     </span>
  //   ),
  // },
  NONE: {
    displayName: (
      <span>
        <strong>Every time</strong> it happens
      </span>
    ),
  },
}

export const MONTH_DAY_SELECT_OPTIONS = {
  FIRST: (
    <span>
      on the <strong>first day</strong>
    </span>
  ),
  LAST: (
    <span>
      on the <strong>last day</strong>
    </span>
  ),
}

export const CHECK_FREQUENCY_OPTIONS = [1, 2, 3, 5, 10, 30, 60]
