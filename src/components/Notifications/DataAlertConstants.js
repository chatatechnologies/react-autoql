import React from 'react'

export const CUSTOM_TYPE = 'CUSTOM'
export const PROJECT_TYPE = 'PROJECT'
export const PERIODIC_FREQUENCY = 'PERIODIC'
export const CONTINUOUS_FREQUENCY = 'CONTINUOUS'
export const SCHEDULE_FREQUENCY = 'SCHEDULE'
export const COMPARE_TYPE = 'COMPARE'
export const EXISTS_TYPE = 'EXISTS'
export const NUMBER_TERM_TYPE = 'constant'
export const QUERY_TERM_TYPE = 'query'
export const GROUP_TERM_TYPE = 'group'

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
}

export const DATA_ALERT_CONDITION_TYPES = {
  COMPARE: {
    displayName: 'When a specific condition is met',
  },
  EXISTS: {
    displayName: 'If new data is detected',
  },
}

export const DATA_ALERT_FREQUENCY_TYPE_OPTIONS = {
  PERIODIC: {
    label: 'at the following times:',
    listLabel: 'at the following times',
  },
  CONTINUOUS: {
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
  },
  WEEK: {
    displayName: (
      <span>
        Every <strong>week</strong>
      </span>
    ),
  },
  MONTH: {
    displayName: (
      <span>
        Every <strong>month</strong>
      </span>
    ),
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
