import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Divider,
  IconButton,
  Text,
  ThemeProvider,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "@/core/i18n/locale-store";

import { revealOffset, sheetBox, useKeyboardHeight } from "./keyboard-inset";
import { useRipple } from "./ripple";
import { useSheetColors } from "./scheme-colors";
import { RADIUS, SPACING } from "./theme";

const RevealContext = createContext<(target: View | null) => void>(
  () => undefined,
);

/**
 * Keeps a whole block of the sheet on screen while it holds the focus, not just
 * its text field. Android's ScrollView only scrolls the focused input itself
 * into view, so whatever a field shows right under it — the tags that match
 * what is being typed — stays under the keyboard. Pass the block on focus and
 * `null` on blur; the sheet scrolls it back into view each time the keyboard
 * or the content resizes the body.
 */
export function useRevealInSheet() {
  return useContext(RevealContext);
}

interface FormModalProps {
  isVisible: boolean;
  onDismiss: () => void;
  isBusy?: boolean;
  title: string;
  /** Sits under the title, for the one line of context a form sometimes needs. */
  subtitle?: string;
  /**
   * Pinned below the body rather than scrolled with it. A form long enough to
   * scroll — a dozen tags is enough — otherwise pushes its own submit button
   * off the bottom of the screen, which is exactly where it must never be.
   */
  footer?: ReactNode;
  /**
   * Where the Android back action goes in a form of several steps: one step
   * back, not out. The scrim and the close button still dismiss — a tap
   * outside must never quietly change the step under the user's eyes.
   */
  onBack?: () => void;
  children?: ReactNode;
}

/**
 * The one shape every form modal in the app takes: a card anchored to the
 * bottom edge, a scrolling body, and actions that stay put. It slides up and
 * rounds its top corners like a Material bottom sheet, and stops there: no
 * drag handle, no swipe, no sheet library — `android/DESIGN.md` says why.
 *
 * Getting out of the keyboard's way is this component's job alone, which is why
 * no call site owns a `KeyboardAvoidingView`: eleven of the seventeen sheets
 * hold both a text field and a pinned footer, and a submit button under the
 * keys is the one place it must never be. `sheetBox` says how, and why the
 * window's own height cannot be asked.
 */
export function FormModal({
  isVisible,
  onDismiss,
  isBusy = false,
  title,
  subtitle,
  footer,
  onBack,
  children,
}: FormModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight();
  const ripple = useRipple();
  const sheet = useSheetColors();
  const { bottom } = useSafeAreaInsets();
  const box = sheetBox({
    windowHeight: height,
    keyboardHeight,
    safeBottom: bottom,
  });
  const scrollRef = useRef<ScrollView>(null);
  const contentRef = useRef<View>(null);
  const revealed = useRef<View | null>(null);
  const viewport = useRef({ visible: 0, offset: 0 });

  function reveal() {
    const scroll = scrollRef.current;
    const content = contentRef.current;
    if (revealed.current === null || scroll == null || content == null) return;
    revealed.current.measureLayout(content, (_x, top, _width, height) => {
      const y = revealOffset({ top, height, ...viewport.current });
      if (y !== undefined) scroll.scrollTo({ y });
    });
  }

  function setRevealed(target: View | null) {
    revealed.current = target;
    reveal();
  }

  return (
    <Modal
      testID="form-modal"
      visible={isVisible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={isBusy ? () => undefined : (onBack ?? onDismiss)}
    >
      <View
        style={[styles.backdrop, { backgroundColor: theme.colors.backdrop }]}
      >
        <Pressable
          testID="form-modal-backdrop"
          style={StyleSheet.absoluteFill}
          onPress={isBusy ? undefined : onDismiss}
          android_ripple={ripple}
          accessible={!isBusy}
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: sheet.background }, box]}
        >
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text variant="titleLarge">{title}</Text>
              {subtitle !== undefined && (
                <Text
                  variant="labelMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {subtitle}
                </Text>
              )}
            </View>
            <IconButton
              icon="close"
              disabled={isBusy}
              onPress={onDismiss}
              accessibilityLabel={t("common.close")}
              style={styles.close}
            />
          </View>

          {/* Paper paints an outlined field's notch in `background`; inside the
              sheet that has to be the sheet's own surface, or every label cuts a
              sage slot out of the warm one. */}
          <ThemeProvider
            theme={{
              ...theme,
              colors: { ...theme.colors, background: sheet.background },
            }}
          >
            <ScrollView
              ref={scrollRef}
              // The typings want a ref that is never null; the runtime sets null on unmount.
              innerViewRef={contentRef as RefObject<View>}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(event) => {
                viewport.current.offset = event.nativeEvent.contentOffset.y;
              }}
              onLayout={(event) => {
                viewport.current.visible = event.nativeEvent.layout.height;
                reveal();
              }}
              onContentSizeChange={reveal}
            >
              <RevealContext.Provider value={setRevealed}>
                {children}
              </RevealContext.Provider>
            </ScrollView>
          </ThemeProvider>

          {footer !== undefined && (
            <>
              <Divider />
              <View style={styles.footer}>{footer}</View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: RADIUS.zone,
    borderTopRightRadius: RADIUS.zone,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingLeft: SPACING.lg,
    paddingRight: SPACING.sm,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  heading: { flex: 1, gap: SPACING.xxs },
  close: { margin: 0 },
  body: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  footer: { padding: SPACING.lg, gap: SPACING.sm },
});
