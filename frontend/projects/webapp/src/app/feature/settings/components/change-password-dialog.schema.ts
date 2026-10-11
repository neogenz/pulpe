import * as z from 'zod';
import { PASSWORD_MIN_LENGTH } from '@core/auth';

export const changePasswordFormSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH),
});

export type ChangePasswordFormValue = z.input<typeof changePasswordFormSchema>;
