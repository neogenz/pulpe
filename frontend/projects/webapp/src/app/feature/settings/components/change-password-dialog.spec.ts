import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { ChangePasswordDialog } from './change-password-dialog';
import { Logger } from '@core/logging/logger';
import { AuthSessionService } from '@core/auth';

describe('ChangePasswordDialog', () => {
  let component: ChangePasswordDialog;
  let mockDialogRef: { close: Mock };
  let mockAuthSession: {
    verifyPassword: Mock;
    updatePassword: Mock;
  };
  let mockLogger: { debug: Mock; info: Mock; warn: Mock; error: Mock };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockAuthSession = {
      verifyPassword: vi.fn(),
      updatePassword: vi.fn(),
    };
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ChangePasswordDialog,
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: AuthSessionService, useValue: mockAuthSession },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    component = TestBed.inject(ChangePasswordDialog);
  });

  it('should have invalid form when empty', () => {
    expect(component['passwordForm'].valid).toBe(false);
  });

  it('should have valid form when all fields filled and passwords match', () => {
    component['passwordForm'].patchValue({
      currentPassword: 'currentPass123',
      newPassword: 'newPass123',
      confirmPassword: 'newPass123',
    });
    expect(component['passwordForm'].valid).toBe(true);
  });

  it('should show error when current password verification fails', async () => {
    mockAuthSession.verifyPassword.mockResolvedValue({
      success: false,
      error: 'Mot de passe actuel incorrect',
    });

    component['passwordForm'].patchValue({
      currentPassword: 'wrongPassword',
      newPassword: 'newPass123',
      confirmPassword: 'newPass123',
    });

    // Access protected method via bracket notation for testing
    await (
      component as unknown as { onSubmit: () => Promise<void> }
    ).onSubmit();

    expect(component['errorMessage']()).toBe('Mot de passe actuel incorrect');
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should show error when password update fails', async () => {
    mockAuthSession.verifyPassword.mockResolvedValue({ success: true });
    mockAuthSession.updatePassword.mockResolvedValue({
      success: false,
      error: 'Échec de la mise à jour',
    });

    component['passwordForm'].patchValue({
      currentPassword: 'currentPass123',
      newPassword: 'newPass123',
      confirmPassword: 'newPass123',
    });

    await (
      component as unknown as { onSubmit: () => Promise<void> }
    ).onSubmit();

    expect(component['errorMessage']()).toBe('Échec de la mise à jour');
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should close dialog on successful password change', async () => {
    mockAuthSession.verifyPassword.mockResolvedValue({ success: true });
    mockAuthSession.updatePassword.mockResolvedValue({ success: true });

    component['passwordForm'].patchValue({
      currentPassword: 'currentPass123',
      newPassword: 'newPass123',
      confirmPassword: 'newPass123',
    });

    await (
      component as unknown as { onSubmit: () => Promise<void> }
    ).onSubmit();

    expect(mockAuthSession.verifyPassword).toHaveBeenCalledWith(
      'currentPass123',
    );
    expect(mockAuthSession.updatePassword).toHaveBeenCalledWith('newPass123');
    // Password change is purely Supabase auth - no encryption APIs should be called
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should not submit when already submitting', async () => {
    component['isSubmitting'].set(true);

    component['passwordForm'].patchValue({
      currentPassword: 'currentPass123',
      newPassword: 'newPass123',
      confirmPassword: 'newPass123',
    });

    await (
      component as unknown as { onSubmit: () => Promise<void> }
    ).onSubmit();

    expect(mockAuthSession.verifyPassword).not.toHaveBeenCalled();
  });

  /**
   * Password change should NOT interact with encryption at all.
   *
   * The vault code (code coffre-fort) is different from the account password.
   * When changing password:
   * - Only Supabase auth is involved
   * - The vault code stays the same
   * - Therefore the client key stays the same
   * - No encryption APIs should be called
   */
  it('should not call any encryption APIs during password change', async () => {
    mockAuthSession.verifyPassword.mockResolvedValue({ success: true });
    mockAuthSession.updatePassword.mockResolvedValue({ success: true });

    component['passwordForm'].patchValue({
      currentPassword: 'currentPass123',
      newPassword: 'newPass123',
      confirmPassword: 'newPass123',
    });

    await (
      component as unknown as { onSubmit: () => Promise<void> }
    ).onSubmit();

    // Password change is purely Supabase auth
    expect(mockAuthSession.verifyPassword).toHaveBeenCalledWith(
      'currentPass123',
    );
    expect(mockAuthSession.updatePassword).toHaveBeenCalledWith('newPass123');
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);

    // No encryption-related calls should happen
    // (verified by the fact that no encryption mocks are configured)
  });
});
