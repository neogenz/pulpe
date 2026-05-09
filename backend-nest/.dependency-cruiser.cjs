module.exports = {
  forbidden: [
    {
      name: 'no-domain-to-application',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: { path: '^src/modules/[^/]+/application' },
    },
    {
      name: 'no-domain-to-infrastructure',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: { path: '^src/modules/[^/]+/infrastructure' },
    },
    {
      name: 'no-application-to-infrastructure',
      severity: 'error',
      comment:
        'Single PERMANENT carve-out: encryption/infrastructure/crypto. The encryption module IS the crypto layer; its use cases need access to AES/HKDF/wrap-unwrap primitives that are intentionally NOT exposed on the public ENCRYPTION_PORT (read-only for cross-module consumers).',
      from: {
        path: '^src/modules/[^/]+/application',
        pathNot: '\\.spec\\.ts$',
      },
      to: {
        path: '^src/modules/[^/]+/infrastructure',
        pathNot: '^src/modules/encryption/infrastructure/crypto',
      },
    },
    {
      name: 'no-domain-to-nestjs',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: { path: 'node_modules/@nestjs' },
    },
    {
      name: 'no-domain-to-supabase',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: { path: 'node_modules/@supabase' },
    },
    {
      name: 'no-domain-to-zod',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: { path: 'node_modules/zod' },
    },
    {
      name: 'no-cross-module-direct',
      comment:
        'Modules MUST communicate via ports/tokens, not direct application/infrastructure imports. See ADR-0002.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)' },
      to: {
        path: '^src/modules/(?!\\1)([^/]+)/(application|infrastructure)',
        pathNot: 'tokens|ports',
      },
    },
    {
      name: 'no-encryption-internal-leak',
      comment:
        'CR-03 regression guard: ONLY the encryption module may import from encryption/application/* or encryption/infrastructure/*. External modules must consume ENCRYPTION_PORT via @modules/encryption/domain/ports/encryption.port. Direct imports of AesGcmCryptoService or any internal encryption file expose wrap/unwrap/recovery primitives the port intentionally hides. See ADR-0008.',
      severity: 'error',
      from: {
        path: '^src/modules/(?!encryption/)',
      },
      to: {
        path: '^src/modules/encryption/(application|infrastructure)/',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: './tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      mainFields: ['main', 'types'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
