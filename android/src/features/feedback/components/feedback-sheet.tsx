import Constants from "expo-constants";
import { useMutation } from "@tanstack/react-query";
import type { FeedbackCreate } from "pulpe-shared";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  IconButton,
  List,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { useTranslation } from "@/core/i18n/locale-store";
import {
  captureFeedbackCancelled,
  captureFeedbackSubmitted,
  captureFeedbackViewed,
  type FeedbackSource,
} from "@/core/observability/product-events";
import { useSessionStore } from "@/core/auth/session-store";
import { FieldError } from "@/core/ui/field-error";
import { hapticSuccess } from "@/core/ui/haptics";
import { FormModal } from "@/core/ui/sheet";
import { SPACING } from "@/core/ui/theme";

import { submitFeedback } from "../feedback-api";
import { markFeedbackSubmitted } from "../feedback-prompt";

/** Same unit as the contract: Unicode code points, not UTF-16 units. */
const COMMENT_MAX_CODE_POINTS = 1_000;
const RATINGS = [1, 2, 3, 4, 5] as const;
const AREAS = [
  "onboarding",
  "budgetClarity",
  "currentMonth",
  "futurePlanning",
  "homeClarity",
] as const;

type Area = (typeof AREAS)[number];
type Rating = (typeof RATINGS)[number];

function RatingStars({
  value,
  onChange,
  context,
}: {
  value: Rating | null;
  onChange: (rating: Rating) => void;
  context?: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={styles.stars}>
      {RATINGS.map((rating) => (
        <IconButton
          key={rating}
          icon={value !== null && rating <= value ? "star" : "star-outline"}
          iconColor={
            value !== null && rating <= value
              ? theme.colors.primary
              : theme.colors.onSurfaceVariant
          }
          size={32}
          onPress={() => onChange(rating)}
          selected={value === rating}
          accessibilityLabel={[
            context,
            t(`settings.feedback.ratings.${rating}`),
          ]
            .filter(Boolean)
            .join(", ")}
          accessibilityState={{ selected: value === rating }}
        />
      ))}
    </View>
  );
}

/**
 * Private feedback: an overall rating, optionally per-area ratings and a
 * comment. Mirrors `FeedbackSheet` on iOS. Mount it only while open — its
 * state starts empty and its `viewed` event fires on mount.
 */
export function FeedbackSheet({
  onDismiss,
  source,
}: {
  onDismiss: () => void;
  source: FeedbackSource;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const userId = useSessionStore((state) => state.user?.id);
  const [overall, setOverall] = useState<Rating | null>(null);
  const [areas, setAreas] = useState<Partial<Record<Area, Rating>>>({});
  const [comment, setComment] = useState("");
  const [showsDetails, setShowsDetails] = useState(false);
  const send = useMutation({ mutationFn: submitFeedback });

  useEffect(() => {
    captureFeedbackViewed(source);
    // Once per opening: `source` is fixed for the lifetime of the mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trimmedComment = comment.trim();
  const canSubmit = overall !== null && !send.isPending;

  function close() {
    if (!send.isSuccess) captureFeedbackCancelled(source);
    onDismiss();
  }

  function submit() {
    if (overall === null || !canSubmit) return;
    const feedback: FeedbackCreate = {
      overallRating: overall,
      ...areas,
      comment: trimmedComment.length > 0 ? trimmedComment : undefined,
      appVersion: Constants.expoConfig?.version ?? "0",
      // The contract knows no Android platform yet; `web` is the only value
      // that needs no iOS version.
      platform: "web",
    };
    send.mutate(feedback, {
      onSuccess: () => {
        hapticSuccess();
        if (userId !== undefined) markFeedbackSubmitted(userId);
        captureFeedbackSubmitted(source, {
          rating: overall,
          hasComment: trimmedComment.length > 0,
          hasDetails: Object.keys(areas).length > 0,
        });
      },
    });
  }

  return (
    <FormModal
      isVisible
      onDismiss={close}
      isBusy={send.isPending}
      title={t("settings.feedback.title")}
      subtitle={send.isSuccess ? undefined : t("settings.feedback.privacy")}
      footer={
        send.isSuccess ? (
          <Button mode="contained" onPress={close}>
            {t("common.close")}
          </Button>
        ) : (
          <>
            {send.isError && (
              <FieldError visible>{t("settings.feedback.error")}</FieldError>
            )}
            <Button
              mode="contained"
              onPress={submit}
              disabled={!canSubmit}
              loading={send.isPending}
            >
              {t("settings.feedback.send")}
            </Button>
            <Button mode="text" onPress={close} disabled={send.isPending}>
              {t("settings.feedback.later")}
            </Button>
          </>
        )
      }
    >
      {send.isSuccess ? (
        <Text variant="titleMedium" style={styles.centered}>
          {t("settings.feedback.thanks")}
        </Text>
      ) : (
        <>
          <Text variant="titleMedium" style={styles.centered}>
            {t("settings.feedback.overallQuestion")}
          </Text>
          <RatingStars value={overall} onChange={setOverall} />
          {overall !== null && (
            <Text
              variant="labelLarge"
              style={[styles.centered, { color: theme.colors.primary }]}
            >
              {t(`settings.feedback.ratings.${overall}`)}
            </Text>
          )}

          <List.Item
            title={t("settings.feedback.detailsTitle")}
            description={t("settings.feedback.detailsDescription", {
              count: AREAS.length,
            })}
            left={(props) => (
              <List.Icon
                {...props}
                icon={
                  showsDetails ? "minus-circle-outline" : "plus-circle-outline"
                }
              />
            )}
            onPress={() => setShowsDetails((open) => !open)}
            accessibilityState={{ expanded: showsDetails }}
          />

          {showsDetails && (
            <View style={styles.details}>
              {AREAS.map((area) => (
                <View key={area} style={styles.area}>
                  <Text variant="bodyLarge">
                    {t(`settings.feedback.areas.${area}`)}
                  </Text>
                  <RatingStars
                    value={areas[area] ?? null}
                    onChange={(rating) =>
                      setAreas((current) => ({ ...current, [area]: rating }))
                    }
                    context={t(`settings.feedback.areas.${area}`)}
                  />
                </View>
              ))}
              <TextInput
                mode="outlined"
                label={t("settings.feedback.commentLabel")}
                accessibilityLabel={t("settings.feedback.commentLabel")}
                placeholder={t("settings.feedback.commentPlaceholder")}
                value={comment}
                onChangeText={(value) =>
                  setComment(
                    Array.from(value)
                      .slice(0, COMMENT_MAX_CODE_POINTS)
                      .join(""),
                  )
                }
                multiline
                numberOfLines={4}
              />
            </View>
          )}
        </>
      )}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: "center" },
  stars: { flexDirection: "row", justifyContent: "center" },
  details: { gap: SPACING.md },
  area: { gap: SPACING.xs },
});
