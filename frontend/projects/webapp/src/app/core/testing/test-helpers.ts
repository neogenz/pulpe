import { TestBed, TestModuleMetadata } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

/**
 * Configure TestBed for zoneless testing
 * This helper ensures all tests run in zoneless mode, matching the application configuration
 */
export function configureTestingModuleForZoneless(
  moduleDef: TestModuleMetadata,
): TestModuleMetadata {
  const providers = moduleDef.providers || [];

  // Add zoneless change detection provider if not already present
  const hasZonelessProvider = providers.some(
    (provider) =>
      provider === provideZonelessChangeDetection ||
      (typeof provider === 'object' &&
        'provide' in provider &&
        provider.provide === provideZonelessChangeDetection),
  );

  if (!hasZonelessProvider) {
    return {
      ...moduleDef,
      providers: [provideZonelessChangeDetection(), ...providers],
    };
  }

  return moduleDef;
}

/**
 * Wrapper around TestBed.configureTestingModule that automatically adds zoneless configuration
 */
export function configureZonelessTestingModule(
  moduleDef: TestModuleMetadata,
): TestBed {
  return TestBed.configureTestingModule(
    configureTestingModuleForZoneless(moduleDef),
  );
}
