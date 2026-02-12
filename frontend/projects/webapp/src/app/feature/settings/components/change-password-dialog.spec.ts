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
  let mockLogger: { error: Mock };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockAuthSession = {
      verifyPassword: vi.fn(),
      updatePassword: vi.fn(),
    };
    mockLogger = { error: vi.fn() };

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
    await component['onSubmit']();

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

    await component['onSubmit']();

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

    await component['onSubmit']();

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

    await component['onSubmit']();

    expect(mockAuthSession.verifyPassword).not.toHaveBeenCalled();
  });

  it('should display specific error message when old password is wrong', async () => {
    mockAuthSession.verifyPassword.mockResolvedValue({
      success: false,
      error: 'Email ou mot de passe incorrect — on réessaie ?',
    });

    component['passwordForm'].patchValue({
      currentPassword: 'wrongPassword',
      newPassword: 'newPass123',
      confirmPassword: 'newPass123',
    });

    await component['onSubmit']();

    expect(component['errorMessage']()).toBe(
      'Email ou mot de passe incorrect — on réessaie ?',
    );
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should show min length error when new password is less than 8 characters', () => {
    component['passwordForm'].get('newPassword')?.setValue('short');

    const errors = component['passwordForm'].get('newPassword')?.errors;

    expect(errors?.['minlength']).toBeTruthy();
  });

  it('should keep submit button disabled when passwords do not match', () => {
    component['passwordForm'].patchValue({
      currentPassword: 'currentPass123',
      newPassword: 'newPass123',
      confirmPassword: 'differentPass123',
    });

    expect(component['isFormValid']()).toBe(false);
  });

  it('should close dialog without recovery key modal after successful password change', async () => {
    mockAuthSession.verifyPassword.mockResolvedValue({ success: true });
    mockAuthSession.updatePassword.mockResolvedValue({ success: true });

    component['passwordForm'].patchValue({
      currentPassword: 'currentPass123',
      newPassword: 'newPass123',
      confirmPassword: 'newPass123',
    });

    await component['onSubmit']();

    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
  });
});
