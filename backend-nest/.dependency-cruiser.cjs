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
      from: {
        path: '^src/modules/[^/]+/application',
        pathNot: '\\.spec\\.ts$',
      },
      to: { path: '^src/modules/[^/]+/infrastructure' },
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
        'Modules should communicate via ports/tokens, not direct service imports',
      severity: 'warn',
      from: { path: '^src/modules/([^/]+)' },
      to: {
        path: '^src/modules/(?!\\1)([^/]+)/(application|infrastructure)',
        pathNot: 'tokens|ports',
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
