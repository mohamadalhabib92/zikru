/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'watch',
  name: 'ZikruWatch',
  displayName: 'Zikru',
  // com.vibecode.zikru-76mpdv.watchkitapp
  bundleIdentifier: '.watchkitapp',
  deploymentTarget: '10.0',
  icon: '../../assets/icon.png',
  frameworks: ['SwiftUI', 'WatchConnectivity', 'WidgetKit'],
  colors: {
    // crème #F7F4EE sur le fond #181818
    $accent: '#F7F4EE',
  },
  entitlements: {
    'com.apple.security.application-groups': [`group.${config.ios.bundleIdentifier}.watch`],
  },
});
