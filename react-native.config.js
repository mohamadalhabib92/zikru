/**
 * Sans EXPO_TV, aucune exclusion : l’iPhone et la montre lient comme avant.
 * Avec EXPO_TV=1 (pod install du build cloud), les modules sans tvOS ne sont
 * pas proposés à use_native_modules. use_expo_modules reçoit la même liste
 * dans le Podfile généré.
 */
const { TV_AUTOLINK_EXCLUDE } = require('./scripts/tv-native.cjs');

if (process.env.EXPO_TV !== '1') {
  module.exports = {};
} else {
  const off = { platforms: { ios: null, tvos: null } };
  const dependencies = {};
  for (const name of TV_AUTOLINK_EXCLUDE) dependencies[name] = off;
  module.exports = { dependencies };
}
