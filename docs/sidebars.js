/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
module.exports = {
  docs: [
    'getting-started',
    {
      type: 'category',
      label: 'Components',
      collapsed: false,
      items: [
        'components/data-messenger',
        'components/dashboard',
        'components/data-alerts',
        'components/notification-icon',
        'components/notification-feed',
        'components/query-input',
        'components/query-output',
      ],
    },
  ],
}
