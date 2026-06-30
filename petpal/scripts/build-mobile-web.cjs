/**
 * Production web build with relative asset paths for Capacitor WebView.
 */
const { execSync } = require('child_process');
const path = require('path');

process.env.PUBLIC_URL = '.';
execSync('npm run build', {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
    PUBLIC_URL: '.',
    // GitHub Actions sets CI=true, which fails the build on ESLint warnings.
    CI: 'false',
    DISABLE_ESLINT_PLUGIN: 'true',
  },
});
