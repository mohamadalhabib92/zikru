/**
 * Modules retirés du lien natif Apple TV. Une seule liste, lue par le hook EAS,
 * le plugin Podfile et react-native.config.js. Inerte tant que EXPO_TV n’est pas 1.
 *
 * Pas de podspec tvOS, ou un podspec tvOS qui dépend d’un pod iOS seulement
 * (LiveKitExpoPlugin → livekit-react-native). expo-iap et expo-audio restent :
 * ils déclarent tvOS. expo-router est patché à part.
 */
const TV_AUTOLINK_EXCLUDE = [
  'react-native-ble-plx',
  'expo-location',
  'expo-notifications',
  'expo-haptics',
  'expo-image-picker',
  'expo-clipboard',
  'expo-speech',
  'expo-document-picker',
  'expo-widgets',
  'expo-app-intents',
  '@livekit/react-native',
  '@livekit/react-native-webrtc',
  '@livekit/react-native-expo-plugin',
  '@expo/dom-webview',
  '@bacons/apple-targets',
  'zikru-ocr',
  'zikru-watch',
  'zikru-quick-actions',
];

/** Les xcframework Maven sont le cœur iOS upstream, pas le fork tvOS. */
const TV_RN_CORE_FROM_SOURCE = '0';

module.exports = { TV_AUTOLINK_EXCLUDE, TV_RN_CORE_FROM_SOURCE };
