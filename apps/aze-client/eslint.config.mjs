// eslint-config-next ships native flat config, so the eslintrc compatibility
// layer is not needed. It was also the source of a hard failure: FlatCompat
// loads @eslint/eslintrc, which could not parse the modern shareable config.
// `core-web-vitals` is a superset of the base `next` config.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

const config = [
  ...nextCoreWebVitals,
  ...baseConfig,
  ...nx.configs['flat/react-typescript'],
  {
    ignores: ['.next/**/*'],
  },
];

export default config;
