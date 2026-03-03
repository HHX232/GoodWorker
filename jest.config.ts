/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  '\\.(css|scss|sass)$': '<rootDir>/src/features/tests/__mocks__/styleMock.js',
  '^swiper/css$': '<rootDir>/src/features/tests/__mocks__/styleMock.js',     
  '^swiper/css/(.*)$': '<rootDir>/src/features/tests/__mocks__/styleMock.js',  
  // '^swiper(.*)$': '<rootDir>/src/features/tests/__mocks__/swiperMock.js',  
  '^auth$': '<rootDir>/src/__mocks__/auth.ts',
  },
  testMatch: [
    '**/src/features/tests/unit/**/*.test.ts',
    '**/src/features/tests/components/**/*.test.tsx',
    '**/src/shared/tests/unit/**/*.test.ts',
    '**/src/shared/tests/components/**/*.test.tsx'
  ],
  setupFilesAfterFramework: ['@testing-library/jest-dom'],
  transformIgnorePatterns: ['node_modules/(?!(next-intl|use-intl|swiper)/)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.types.ts',
    '!src/**/index.ts',
    '!src/**/__mocks__/**',
    '!src/app/**',
    '!src/shared/ui/shadcn/**',
    '!src/_pages/**',
    '!src/widgets/**',
    '!src/entities/**',
    '!src/shared/api/**',
    '!src/shared/i18n/**',
    '!src/shared/lib/prisma/**',
    '!src/features/**/{api,hooks}/**'
  ]
}

module.exports = config
