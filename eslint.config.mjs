import nextConfig from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextConfig,
  { ignores: ['.next/*', '**/*-old.*', '**/*.backup'] },
];

export default config;
