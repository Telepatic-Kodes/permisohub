import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'node_modules/**',
    'public/sw.js',
    'test-results/**',
    'playwright-report/**',
  ]),
  {
    rules: {
      // El código existente usa apóstrofes sin escapar en JSX en español;
      // no aporta y genera cientos de falsos positivos.
      'react/no-unescaped-entities': 'off',
      // Reglas nuevas del compilador de React: el código existente las viola
      // en ~20 sitios sin bugs observables. Quedan como warning (deuda a
      // limpiar), no como bloqueo del lint.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
])

export default eslintConfig
