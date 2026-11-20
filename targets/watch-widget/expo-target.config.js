/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch-widget',
  name: 'ZikruWatchWidget',
  displayName: 'Zikru',
  // com.vibecode.zikru-76mpdv.watchkitapp.widget
  bundleIdentifier: '.watchkitapp.widget',
  deploymentTarget: '10.0',
  colors: {
    $accent: '#F7F4EE',
    $widgetBackground: '#181818',
  },
  entitlements: {
    'com.apple.security.application-groups': [`group.${config.ios.bundleIdentifier}.watch`],
  },
});
