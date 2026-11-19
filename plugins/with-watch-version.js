const { withXcodeProject } = require('expo/config-plugins');

/**
 * @bacons/apple-targets écrit MARKETING_VERSION = 1.0 sur les cibles watchOS.
 * On aligne cette version sur celle de l’app (app.json) après la génération du projet.
 * CURRENT_PROJECT_VERSION, lui, suit déjà ios.buildNumber.
 */
module.exports = function withWatchMarketingVersion(config) {
  const version = config.version || '1.0.0';
  return withXcodeProject(config, (cfg) => {
    const section = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(section)) {
      const entry = section[key];
      if (!entry || typeof entry !== 'object' || !entry.buildSettings) continue;
      const sdk = String(entry.buildSettings.SDKROOT || '').replace(/"/g, '');
      if (sdk === 'watchos') entry.buildSettings.MARKETING_VERSION = version;
    }
    return cfg;
  });
};
