const FailureOnlyPerBrowserReporter = require('testem-failure-only-reporter/grouped-by-browser');

const BrowserStackLaunchers = {
  BS_Safari_Current: {
    exe: 'node_modules/.bin/browserstack-launch',
    args: [
      '--os',
      'OS X',
      '--osv',
      'Mojave',
      '--b',
      'safari',
      '--bv',
      'latest',
      '-t',
      '1200',
      '--u',
      '<url>',
    ],
    protocol: 'browser',
  },
  BS_MS_Edge: {
    exe: 'node_modules/.bin/browserstack-launch',
    args: [
      '--os',
      'Windows',
      '--osv',
      '10',
      '--b',
      'edge',
      '--bv',
      'latest',
      '-t',
      '1200',
      '--u',
      '<url>',
    ],
    protocol: 'browser',
  },
};

module.exports = {
  test_page: 'dist/tests/index.html?hidepassed&hideskipped&timeout=60000',
  timeout: 1200,
  reporter: FailureOnlyPerBrowserReporter,
  browser_start_timeout: 2000,
  browser_disconnect_timeout: 120,
  parallel: 4,
  disable_watching: true,
  launchers: BrowserStackLaunchers,
  launch_in_dev: [],
  launch_in_ci: Object.keys(BrowserStackLaunchers),
};
