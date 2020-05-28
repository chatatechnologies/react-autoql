export default {
  spira: [
    {
      topic: 'Revenue',
      queries: [
        'Total revenue this year',
        'Total revenue by month for the last six months',
        'Total revenue by area last year',
        'Total revenue by customer for the last six months',
        'Average revenue by area last year',
        'Average revenue by ticket type for the last six months',
      ],
    },
    {
      topic: 'Estimates',
      queries: [
        'Total estimates by area last year',
        'Total estimates by ticket type last year',
        'Number of estimates by customer this year',
        'Number of estimates by job type last year',
        'Average estimates by ticket type last year',
        'Average estimates by month last year',
      ],
    },
    {
      topic: 'Utilization',
      queries: [
        'Total utilization on resources last month',
        'Total resource hours by area last month ',
        'Total hours utilized for personnel last month',
        'Total hours utilization by job last month',
        'Total hours utilization on equipment last year',
        'Average hours utilization by job type last month',
      ],
    },
    {
      topic: 'Jobs',
      queries: [
        'All jobs scheduled to start this year',
        'All active jobs scheduled to end last year',
        'All jobs still open from last year',
        'All jobs in bid state',
        'Number of scheduled jobs by area',
        'Number of open jobs by customer',
      ],
    },
    {
      topic: 'Tickets',
      queries: [
        'Total tickets by month last year',
        'Total tickets by customer this year',
        'Average ticket by area last year',
        'All void tickets over 10000',
        'Average ticket by ticket type last year',
        'Total tickets by type by month for the last six months',
      ],
    },
  ],
  locate: [
    {
      topic: 'Sales',
      queries: [
        'Total sales by state last year',
        'Average sales by month last year',
        'Total sales by customer this year',
      ],
    },
    {
      topic: 'Purchase Orders',
      queries: [
        'Last purchase order over 10000',
        'Total purchase orders by vendor this year',
        'All unissued purchase orders from last year',
      ],
    },
    {
      topic: 'Parts',
      queries: [
        'Top 5 parts by sales order',
        'Show me all parts expiring this year',
        'All parts priced below last cost',
      ],
    },
    {
      topic: 'Margins',
      queries: [
        'Gross margin by part this year',
        'Gross margin by customer last year',
        'Gross margin by invoice this year',
      ],
    },
  ],
  demo: [
    {
      topic: 'Sales',
      queries: [
        'Total sales last month',
        'Top 5 customers by sales this year',
        'Total sales by revenue account last year',
        'Total sales by item from services last year',
        'Average sales per month last year',
      ],
    },
    {
      topic: 'Items',
      queries: [
        'Top 5 items by sales',
        'Which items were sold the least last year',
        'Average items sold per month last year',
        'Total profit per item last month',
        'Total items sold for services last month',
      ],
    },
    {
      topic: 'Expenses',
      queries: [
        'All expenses last month',
        'Monthly expenses by vendor last year',
        'Total expenses by account last quarter',
        'Total expenses by quarter last year',
        'Show me expenses last year over 10000',
      ],
    },
    {
      topic: 'Purchase Orders',
      queries: [
        'All purchases over 10000 this year',
        'All open purchase orders',
        'Total purchase orders by vendor this year',
        'Total purchase orders by quarter last year',
        'Top 5 vendors by purchase orders',
      ],
    },
  ],
  lefort: [
    {
      topic: 'Ingresos',
      queries: [
        'ingresos el año pasado',
        'ingresos totales por mes 2017',
        'promedio de las facturas de ingresos por mes 2017',
        'cuántos facturas de ingresos hay por mes 2017',
      ],
    },
    {
      topic: 'Egresos',
      queries: [
        'egresos para MXN',
        'egresos totales para MXN',
        'promedio de las facturas de egresos por mes 2017',
        'cuántos facturas de egresos hay por mes 2017',
      ],
    },
    {
      topic: 'Pagos',
      queries: [
        'pagos el año pasado',
        'promedio de pagos por año',
        'pagos totales 2017',
        'pagos totales por autorizado por tipo',
      ],
    },
    {
      topic: 'Nómina',
      queries: [
        'nóminas',
        'nómina total por año',
        'promedio de nómina por año',
        'cuántas nóminas hay por mes',
      ],
    },
  ],
  vitruvi: [
    {
      topic: 'Tickets',
      queries: [
        'All open tickets due this year',
        'All tickets created last year',
        'Number of tickets by status',
      ],
    },
    {
      topic: 'Work Package',
      queries: [
        'All work packages created this year',
        'how many work packages for each manager this year',
        'how many work packages by type last year',
      ],
    },
    {
      topic: 'Work Order',
      queries: [
        'List all work orders created this year',
        'Number of working orders in progress by region this year',
        'Number of work orders by program this year',
      ],
    },
  ],
  bluelink: [
    {
      topic: 'Sales orders',
      queries: [
        'All open sales orders from last year',
        'Total sales orders by customer last year',
        'Total sales orders by month last year',
      ],
    },
    {
      topic: 'Products',
      queries: [
        'All products sold at a loss last year',
        'Top 5 average sales orders by product last year',
        'Total sales by product by month last year',
      ],
    },
    {
      topic: 'Gross margin',
      queries: [
        'Total gross margin by country last year',
        'Total gross margin by customer last year',
        'Total gross margin by product last year',
      ],
    },
  ],
}
