/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'watch-widget',
  name: 'ZikruWatchWidget',
  displayName: 'Prochaine prière',
  bundleIdentifier: '.watchkitapp.widget',
  deploymentTarget: '10.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: {
    $accent: '#0E6B4F',
    $widgetBackground: '#0F3D30',
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.com.vibecode.zikru-76mpdv'],
  },
});
