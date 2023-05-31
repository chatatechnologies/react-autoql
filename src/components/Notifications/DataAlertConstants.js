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
export const DEFAULT_EVALUATION_FREQUENCY = 5

export const DATA_ALERT_STATUSES = {
  ACTIVE: '', // currently running
  RETRY: '', // currently being retried because of an error, no action required yet
  WAITING: '', // active but triggered already and waiting for the reset period to end
  INACTIVE: '', // either not running OR it is a prototype (can not be run)
  EVALUATION_ERROR: '', // expression evaluation resulted in an error
  DATA_RETURN_ERROR: '', // expression evaluation was successful, but data return query failed
  GENERAL_ERROR: '', // every thing else that doesnt fall into a category above
}

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
  /* Not using this for now. Uncomment to enable later if desired
  NOT_EQUAL_TO: {
    displayName: (
      <span>
        Is <strong>not equal</strong> to
      </span>
    ),
    symbol: '!=',
    conditionText: 'does not equal',
    conditionTextPast: 'was not equal to',
  }, */

  /* These are additions term condition values
     They can be used to create more complex condition groups
  EXISTS: {},
  NOT_EXISTS: {},
  AND: {},
  OR: {},
  TERMINATOR: {} */
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
  //   displayText: 'Scheduled yearly',
  // },
}

export const SCHEDULE_FREQUENCY_OPTIONS = {
  DAY: {
    displayText: 'Scheduled daily',
  },
  WEEK: {
    displayText: 'Scheduled weekly',
  },
  MONTH: {
    displayText: 'Scheduled for the 1st of every month',
  },
  MONTH_LAST_DAY: {
    displayText: 'Scheduled for the end of every month',
  },
  YEAR: {
    displayText: 'Scheduled yearly',
  },
}

export const RESET_PERIOD_OPTIONS = {
  DAY: {
    displayName: (
      <span>
        At most <strong>once a day</strong>
      </span>
    ),
    displayText: 'At most once a day',
  },
  WEEK: {
    displayName: (
      <span>
        At most <strong>once a week</strong>
      </span>
    ),
    displayText: 'At most once a week',
  },
  MONTH: {
    displayName: (
      <span>
        At most <strong>once a month</strong>
      </span>
    ),
    displayText: 'At most once a month',
  },
  // Not supporting for now
  // YEAR: {
  //   displayName: (
  //     <span>
  //       At most <strong>once a year</strong>
  //     </span>
  //   ),
  //  displayText: 'At most once a year'
  // },
  NONE: {
    displayName: (
      <span>
        <strong>Every time</strong> new data is detected
      </span>
    ),
    displayText: 'Continuous',
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

export const EVALUATION_FREQUENCY_OPTIONS = {
  1: {
    value: 1,
    label: '1 min',
  },
  2: {
    value: 2,
    label: '2 mins',
  },
  3: {
    value: 3,
    label: '3 mins',
  },
  5: {
    value: 5,
    label: '5 mins',
    listLabel: (
      <span>
        5 mins <em>(Recommended)</em>
      </span>
    ),
  },
  10: {
    value: 10,
    label: '10 mins',
  },
  30: {
    value: 30,
    label: '30 mins',
  },
  60: {
    value: 60,
    label: '60 mins',
  },
}
