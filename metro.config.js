const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable the new architecture
config.resolver.sourceExts.push('cjs');

module.exports = config; 