const { expect } = require('chai');
const { spawnSync } = require('child_process');
const path = require('path');

describe('package entry points', () => {
  it('can be imported from ESM with named exports', () => {
    // Self-reference by package name so the "exports" map is what gets exercised.
    const code = "import { app, memoized, constants } from 'app-store-scraper-ts'; if (typeof app !== 'function' || !constants.collection) process.exit(2); memoized();";
    const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
    expect(res.stderr).to.equal('');
    expect(res.status).to.equal(0);
  });
});
