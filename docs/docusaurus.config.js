// @ts-check
const { themes } = require('prism-react-renderer')

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'react-autoql',
  tagline: 'React components for AutoQL',
  favicon: 'img/autoql-logo.png',

  // GitHub Pages: https://chatatechnologies.github.io/react-autoql/
  url: 'https://chatatechnologies.github.io',
  baseUrl: '/react-autoql/',
  organizationName: 'chatatechnologies',
  projectName: 'react-autoql',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          path: 'content',
          routeBasePath: '/',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/chatatechnologies/react-autoql/edit/develop/docs/',
        },
        blog: false,
        theme: { customCss: require.resolve('./src/css/custom.css') },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'react-autoql',
        items: [
          { type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs' },
          { href: 'https://www.npmjs.com/package/react-autoql', label: 'npm', position: 'right' },
          { href: 'https://github.com/chatatechnologies/react-autoql', label: 'GitHub', position: 'right' },
        ],
      },
      footer: {
        style: 'light',
        copyright: `Copyright © ${new Date().getFullYear()} Chata Technologies Inc.`,
      },
      prism: { theme: themes.github, darkTheme: themes.dracula },
    }),
}

module.exports = config
