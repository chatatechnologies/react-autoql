export default [
  {
    id: 1,
    title: 'Large Transaction',
    message: 'We detected a transaction over $1000',
    expanded: false,
    enabled: true,
    history: [],
    logic: [
      {
        id: 11,
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            id: 111,
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                id: 111,
                term_type: 'query',
                condition: 'EXISTS',
                term_value: 'All bank transactions over 1000'
              }
            ]
          }
        ]
      }
    ],
    data_return_query: 'All bank transactions over 1000 today',
    notification_type: 'SCHEDULED',
    reset_period: null,
    cycle: 'YEAR',
    month_number: [7],
    day_number: [1],
    run_times: ['9:00']
  },
  {
    id: 2,
    title: 'Low Balance',
    message: 'Your bank balance fell below $50,000',
    expanded: false,
    enabled: true,
    // last_triggered: '2020-01-10T16:40:56.520Z',
    history: [],
    logic: [
      {
        id: 22,
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            id: 222,
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                id: 2221,
                term_type: 'query',
                condition: 'LESS_THAN',
                term_value: 'total bank balance'
              },
              {
                id: 2222,
                term_type: 'constant',
                condition: 'TERMINATOR',
                term_value: '50000'
              }
            ]
          }
        ]
      }
    ],
    data_return_query: 'total bank balance',
    notification_type: 'SCHEDULED',
    reset_period: null,
    cycle: 'MONTH',
    day_number: [15, -1],
    run_times: ['9:00']
  },
  {
    id: 3,
    title: 'Credit Card Limit Exceeded',
    message: 'Your credit card balance has exceeded the limit',
    expanded: false,
    enabled: false,
    // last_triggered: '2020-01-02T12:10:56.520Z',
    history: [],
    logic: [
      {
        id: 33,
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            id: 333,
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                id: 3331,
                term_type: 'query',
                condition: 'GREATER_THAN',
                term_value: 'Total credit card balance'
              },
              {
                id: 3332,
                term_type: 'query',
                condition: 'TERMINATOR',
                term_value: 'Credit card limit'
              }
            ]
          }
        ]
      }
    ],
    data_return_query: 'Total credit card balance',
    notification_type: 'SINGLE_EVENT',
    reset_period: 'MONTH',
    cycle: 'WEEK',
    day_number: [0, 1, 2, 3, 4, 5, 6],
    run_times: []
  },
  {
    id: 4,
    title: 'High Credit Card Balance',
    message: 'Your credit card balance has reached 80% of the limit',
    expanded: false,
    enabled: false,
    // last_triggered: '2020-01-02T12:10:56.520Z',
    history: [],
    logic: [
      {
        id: 44,
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            id: 444,
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                id: 4441,
                term_type: 'query',
                condition: 'GREATER_THAN',
                term_value: 'Total credit card balance'
              },
              {
                id: 4442,
                term_type: 'query',
                condition: 'TERMINATOR',
                term_value: '80% of Credit card limit'
              }
            ]
          }
        ]
      }
    ],
    data_return_query: 'Total credit card balance',
    notification_type: 'REPEAT_EVENT',
    reset_period: null,
    cycle: 'WEEK',
    day_number: [1, 2, 3, 4, 5],
    run_times: []
  },
  {
    id: 5,
    title: 'Over Spending',
    message: 'You spent more than you made this month',
    expanded: false,
    enabled: false,
    // last_triggered: '2020-01-02T12:10:56.520Z',
    history: [],
    logic: [
      {
        id: 55,
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            id: 555,
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                id: 5551,
                term_type: 'query',
                condition: 'GREATER_THAN',
                term_value: 'total credits'
              },
              {
                id: 5552,
                term_type: 'query',
                condition: 'TERMINATOR',
                term_value: 'total debits'
              }
            ]
          }
        ]
      }
    ],
    data_return_query: 'Total credits and total debits',
    notification_type: 'REPEAT_EVENT',
    reset_period: null,
    cycle: 'WEEK',
    day_number: [1, 2, 3, 4, 5],
    run_times: []
  },
  {
    id: 6,
    title: 'Savings Goal Not Met',
    message: "You didn't meet your savings goal of 10% this month",
    expanded: false,
    enabled: false,
    // last_triggered: '2020-01-02T12:10:56.520Z',
    history: [],
    logic: [
      {
        id: 66,
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            id: 666,
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                id: 6661,
                term_type: 'query',
                condition: 'GREATER_THAN',
                term_value: 'total debits'
              },
              {
                id: 6662,
                term_type: 'query',
                condition: 'TERMINATOR',
                term_value: '90% total credits'
              }
            ]
          }
        ]
      }
    ],
    data_return_query: 'Total debits and total credits',
    notification_type: 'REPEAT_EVENT',
    reset_period: null,
    cycle: 'WEEK',
    day_number: [1, 2, 3, 4, 5],
    run_times: []
  },
  {
    id: 7,
    title: 'Increased Spending',
    message: 'You spent more this month than you did last month',
    expanded: false,
    enabled: false,
    // last_triggered: '2020-01-02T12:10:56.520Z',
    history: [],
    logic: [
      {
        id: 77,
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            i: 777,
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                id: 7771,
                term_type: 'query',
                condition: 'GREATER_THAN',
                term_value: 'total credits this month'
              },
              {
                id: 7772,
                term_type: 'query',
                condition: 'TERMINATOR',
                term_value: 'total credits last month'
              }
            ]
          }
        ]
      }
    ],
    data_return_query: 'total credits this month vs total credits last month',
    notification_type: 'REPEAT_EVENT',
    reset_period: null,
    cycle: 'WEEK',
    day_number: [1, 2, 3, 4, 5],
    run_times: []
  }
]
