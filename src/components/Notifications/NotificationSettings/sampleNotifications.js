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
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                term_type: 'query',
                condition: 'EXISTS',
                term_value: 'All bank transactions over 1000'
              }
            ]
          }
        ]
      }
    ],
    dataReturnQuery: 'All bank transactions over 1000 today'
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
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                term_type: 'query',
                condition: 'LESS_THAN',
                term_value: 'total bank balance'
              },
              {
                term_type: 'constant',
                condition: 'TERMINATOR',
                term_value: '50000'
              }
            ]
          }
        ]
      }
    ],
    dataReturnQuery: 'total bank balance'
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
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                term_type: 'query',
                condition: 'GREATER_THAN',
                term_value: 'Total credit card balance'
              },
              {
                term_type: 'query',
                condition: 'TERMINATOR',
                term_value: 'Credit card limit'
              }
            ]
          }
        ]
      }
    ],
    dataReturnQuery: 'Total credit card balance'
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
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                term_type: 'query',
                condition: 'GREATER_THAN',
                term_value: 'Total credit card balance'
              },
              {
                term_type: 'query',
                condition: 'TERMINATOR',
                term_value: '80% of Credit card limit'
              }
            ]
          }
        ]
      }
    ],
    dataReturnQuery: 'Total credit card balance'
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
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                term_type: 'query',
                condition: 'GREATER_THAN',
                term_value: 'total credits'
              },
              {
                term_type: 'query',
                condition: 'TERMINATOR',
                term_value: 'total debits'
              }
            ]
          }
        ]
      }
    ],
    dataReturnQuery: 'Total credits and total debits'
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
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                term_type: 'query',
                condition: 'GREATER_THAN',
                term_value: 'total debits'
              },
              {
                term_type: 'query',
                condition: 'TERMINATOR',
                term_value: '90% total credits'
              }
            ]
          }
        ]
      }
    ],
    dataReturnQuery: 'Total debits and total credits'
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
        term_type: 'group',
        condition: 'TERMINATOR',
        term_value: [
          {
            term_type: 'group',
            condition: 'TERMINATOR',
            term_value: [
              {
                term_type: 'query',
                condition: 'GREATER_THAN',
                term_value: 'total credits this month'
              },
              {
                term_type: 'query',
                condition: 'TERMINATOR',
                term_value: 'total credits last month'
              }
            ]
          }
        ]
      }
    ],
    dataReturnQuery: 'total credits this month vs total credits last month'
  }
]
