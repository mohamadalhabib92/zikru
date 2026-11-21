/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'watch',
  name: 'ZikruWatch',
  displayName: 'Zikru',
  bundleIdentifier: '.watchkitapp',
  deploymentTarget: '10.0',
  icon: '../../assets/icon.png',
  frameworks: ['SwiftUI', 'WatchKit', 'WatchConnectivity', 'UserNotifications', 'WidgetKit'],
  colors: {
    $accent: '#0E6B4F',
    ZikruGreen: '#0F3D30',
    ZikruGold: '#D9B65C',
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.com.vibecode.zikru-76mpdv'],
  },
});
