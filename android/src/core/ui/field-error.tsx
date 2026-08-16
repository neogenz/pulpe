import type { ComponentProps } from "react";
import { HelperText } from "react-native-paper";

type HelperTextProps = ComponentProps<typeof HelperText>;

/**
 * The line under a field saying why it was refused.
 *
 * It is a component and not a prop because of what it carries: TalkBack reads
 * a region when that region changes and says nothing otherwise, and a form
 * error is the one thing on screen that appears without the user having moved
 * focus to it. Five of the twenty-eight had `accessibilityLiveRegion`; the
 * other twenty-three announced nothing, so a refused submit produced silence
 * and the same form, which reads exactly like a submit that never fired.
 *
 * `type` is not in the public props: an error that could be told to render as
 * an info hint is the same repeated decision this replaces.
 */
export function FieldError({
  children,
  ...rest
}: Omit<HelperTextProps, "type" | "accessibilityLiveRegion">) {
  return (
    <HelperText {...rest} type="error" accessibilityLiveRegion="polite">
      {children}
    </HelperText>
  );
}
