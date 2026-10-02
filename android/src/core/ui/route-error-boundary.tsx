import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { PaperProvider } from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import { captureException } from "@/core/observability/analytics";

import { PlaceholderScreen } from "./placeholder-screen";
import { pulpeDarkTheme, pulpeLightTheme } from "./theme";

/**
 * What a screen that throws while rendering turns into, instead of the app
 * closing under the user — which is what an uncaught render error does in a
 * release build.
 *
 * Exported as `ErrorBoundary` by the root layout and by `(main)`: expo-router
 * wraps each route that exports one, so a screen's failure stays inside the
 * signed-in area and "Réessayer" renders it again. The theme is provided here
 * rather than borrowed, because the root boundary renders in place of the
 * layout that would have provided it.
 *
 * The error is reported through the diagnostics preference like any other
 * handled incident; the user is told their data is untouched, which is true —
 * a render error happens after the server has answered.
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  useEffect(() => {
    captureException(error, { source: "route_error_boundary" });
  }, [error]);

  return (
    <PaperProvider
      theme={colorScheme === "dark" ? pulpeDarkTheme : pulpeLightTheme}
    >
      <PlaceholderScreen
        icon="alert-circle-outline"
        title={t("common.screenError.title")}
        hint={t("common.screenError.hint")}
        action={{ label: t("common.retry"), onPress: () => void retry() }}
      />
    </PaperProvider>
  );
}
