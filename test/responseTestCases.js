export default [
  // empty response
  { data: {} },
  // only display type returned, nothing else
  { data: { display_type: 'table' } },
  {
    // no data and no display type
    data: {
      columns: [],
      display_type: null,
      interpretation: 'all invoices for invoice of this month ',
      query_id: 'q_VzB9irC-RpKY-13XwgHrrw',
      rows: null,
    },
    message: '',
    referenceId: '1.1.0',
  },
  {
    // valid pivot data response
    data: {
      columns: [
        {
          type: 'DATE',
          groupable: true,
          active: false,
          name: 'sale__transaction_date__month',
        },
        {
          active: false,
          groupable: false,
          name: 'sale__line_item___sum',
          type: 'DOLLAR_AMT',
        },
      ],
      display_type: 'date_pivot',
      interpretation: 'total sales by line item by transaction month',
      query_id: 'q_y4sWT0IAStWnLeM7COEsSQ',
      rows: [
        [1483142400, 12500],
        [1488240000, 8742.68],
        [1490918400, 11723.36],
        [1493510400, 3243.12],
        [1496188800, 14642.19],
      ],
    },
    message: '',
    referenceId: '1.1.0',
  },
  {
    // valid help response
    data: {
      columns: [
        { type: 'STRING', groupable: false, active: false, name: 'Help Link' },
      ],

      active: false,
      groupable: false,
      name: 'Help Link',
      type: 'STRING',
      display_type: 'help',
      interpretation: 'help on bar-chart',
      query_id: 'q_t_LufuRpQsGh71LE51qYnA',
      rows: [['http://chata.ai/userguide/#bar-chart-2']],
    },
    message: '',
    referenceId: '1.1.0',
  },
  {
    // valid suggestion response
    data: {
      columns: [
        {
          type: 'STRING',
          groupable: false,
          active: false,
          name: 'query_suggestion',
        },
      ],
      display_type: 'suggestion',
      interpretation: '',
      query_id: 'q_3Kh8CIxGS5SYwmIt4aqeuQ',
      rows: [
        ['All invoices in this year'],
        ['All expenses in this year'],
        ['Show me all invoices in this month'],
        ['List all customers'],
        ['None of these'],
      ],
    },
    message: '',
    referenceId: '1.1.0',
  },
  {
    // valid safetynet response single suggestion
    full_suggestion: [
      {
        start: 10,
        suggestion_list: [
          { text: 'Jane Johnson', value_label: 'customer name' },
        ],
        end: 14,
      },
    ],
    query: 'sales for john',
  },
  {
    // display type that we dont understand
    data: {
      columns: [
        {
          type: 'DATE',
          groupable: true,
          active: false,
          name: 'sale__transaction_date__month',
        },
        {
          active: false,
          groupable: false,
          name: 'sale__line_item___sum',
          type: 'DOLLAR_AMT',
        },
      ],
      display_type: 'unknown_type',
      interpretation: 'total sales by line item by transaction month',
      query_id: 'q_y4sWT0IAStWnLeM7COEsSQ',
      rows: [
        [1483142400, 12500],
        [1488240000, 8742.68],
        [1490918400, 11723.36],
        [1493510400, 3243.12],
        [1496188800, 14642.19],
      ],
    },
    message: '',
    referenceId: '1.1.0',
  },
  {
    data: {
      columns: [
        {
          display_name: 'Security Name',
          groupable: true,
          is_visible: true,
          name: 'hldSecurity.SecurityDescription',
          type: 'STRING',
        },
        {
          display_name: 'Market Value',
          groupable: false,
          is_visible: true,
          name: 'sum(hldHolding.MVwithAccruedLocal)',
          type: 'DOLLAR_AMT',
        },
      ],
      display_type: 'data',
      interpretation:
        'Security Name and Market Value, by Security Name, UNKNOWN COMPARISON',
      query_id: 'q_sASrCuQzTtGwAS6TNf7eyA',
      rows: [
        [null, 0],
        ['American Equity ETF', 29040],
        ['Asian Equity ETF', 80002],
        ['Balanced Foundation ETF', 122000],
        ['Balanced Foundation ETF Ii', 85960],
        ['Black Diamond ETF', 190820],
        ['Bond ETF', 1428885],
        ['Canadian Dollar', 172202725],
        ['Canadian Small Cap ETF', 512320],
        ['Emerging Markets ETF', 23712.5],
        ['European Equity ETF', 49600],
        ['Focus Canadian Equity ETF', 412650],
        ['Global Equity Sri ETF', 56055],
        ["Partners' Bond ETF", 4928],
        ["Partners' Global ETF", 382700],
        ["Partners' Opportunities ETF", 17452.5],
        ['Purefacts Canadian Equity Fund', 3485],
        ['Purefacts Money Market Fund', 0],
        ['Total Return Bond ETF', 1100763],
        ['U.S. Mid Cap ETF', 1379040],
      ],
      sql: [
        "select hldSecurity.SecurityDescription, sum(hldHolding.MVwithAccruedLocal) from hldHolding join hldSecurity on hldSecurity.ID = hldHolding.SecurityID and hldSecurity.SponsorID = hldHolding.SponsorID where hldHolding.ValuationDate = cast('31-DEC-2018' as DATETIME) group by hldSecurity.SecurityDescription",
      ],
    },
  },
]
