import { tracked } from '..';

QUnit.module('Tracked');

QUnit.test('Basic tracked properties', assert => {
  assert.ok(tracked === 'nope');
});
