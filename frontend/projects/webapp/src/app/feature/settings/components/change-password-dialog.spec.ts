import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ChangePasswordDialog } from './change-password-dialog';
import { Logger } from '@core/logging/logger';
import { AuthSessionService } from '@core/auth';
import { EncryptionApi, ClientKeyService } from '@core/encryption';

const { deriveClientKeyMock } = vi.hoisted(() => ({
  deriveClientKeyMock: vi.fn(),
}));

vi.mock('@core/encryption', async () => {
  const actual = await vi.importActual('@core/encryption');
  return {
    ...actual,
    deriveClientKey: deriveClientKeyMock,
  };
});

describe('ChangePasswordDialog', () => {
  let component: ChangePasswordDialog;
  let mockDialogRef: { close: Mock };
  let mockAuthSession: {
    verifyPassword: Mock;
    updatePassword: Mock;
  };
  let mockEncryptionApi: {
    getSalt$: Mock;
    notifyPasswordChange$: Mock;
  };
  let mockClientKeyService: { setDirectKey: Mock };
  let mockLogger: { error: Mock };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockAuthSession = {
      verifyPassword: vi.fn(),
      updatePassword: vi.fn(),
    };
    mockEncryptionApi = {
      getSalt$: vi.fn(),
      notifyPasswordChange$: vi.fn(),
    };
    mockClientKeyService = { setDirectKey: vi.fn() };
    mockLogger = { error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ChangePasswordDialog,
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: AuthSessionService, useValue: mockAuthSession },
        { provide: EncryptionApi, useValue: mockEncryptionApi },
        { provide: ClientKeyService, useValue: mockClientKeyService },
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
    mockEncryptionApi.getSalt$.mockReturnValue(
      of({ salt: 'test-salt', kdfIterations: 100000 }),
    );
    deriveClientKeyMock.mockResolvedValue('new-client-key-hex');
    mockEncryptionApi.notifyPasswordChange$.mockReturnValue(
      of({ success: true }),
    );

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
    expect(mockClientKeyService.setDirectKey).toHaveBeenCalledWith(
      'new-client-key-hex',
    );
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
});
