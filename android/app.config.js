// Only builds that report to PostHog upload their symbols. The upload runs
// inside the release Gradle build and fails it without `POSTHOG_CLI_*`
// credentials, so preview APKs and the CI smoke build stay out of it.
module.exports = ({ config }) =>
  process.env.EXPO_PUBLIC_POSTHOG_ENABLED === "true"
    ? {
        ...config,
        plugins: [
          ...config.plugins,
          [
            "posthog-react-native/expo",
            { uploadNativeSymbols: true, skipOnConflict: true },
          ],
        ],
      }
    : config;
