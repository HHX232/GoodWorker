import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import { defineConfig, globalIgnores } from 'eslint/config'

const eslintConfig = defineConfig([
   ...nextVitals,
   ...nextTs,
   {
      rules: {
         'react-hooks/set-state-in-effect': 'off',
      },
   },
   globalIgnores([
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'src/generated/prisma/**',
      'test-results/**',
      'playwright-report/**',
   ]),
])

export default eslintConfig