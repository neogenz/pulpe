// Stamps a debug id into the bundle and its source map, so the map PostHog
// receives resolves the exact build a JavaScript crash came from.
const { getPostHogExpoConfig } = require("posthog-react-native/metro");

module.exports = getPostHogExpoConfig(__dirname);
