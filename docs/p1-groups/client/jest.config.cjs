// Configuration jest autonome pour docs/p1-groups/client (n'affecte pas l'app).
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { strict: true, target: 'ES2022', module: 'commonjs', esModuleInterop: true } }] },
};
