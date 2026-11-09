import assert from 'node:assert/strict';
import test from 'node:test';
import { createCourseRuntime } from '../assets/js/core/course-runtime.js';

test('course runtime can be imported and rejects missing Fetch support explicitly', async () => {
  assert.equal(typeof createCourseRuntime, 'function');
  await assert.rejects(createCourseRuntime({ fetchImpl: null }), /Fetch API is unavailable/);
});
