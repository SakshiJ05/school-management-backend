import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccess } from './config/permissions.js';
import { permit } from './middleware/rbac.middleware.js';

test('admin can create and manage teachers and students', () => {
  for (const resource of ['teachers', 'students']) {
    for (const action of ['create', 'read', 'update', 'delete']) {
      assert.equal(canAccess('admin', resource, action), true);
    }
  }
});

test('teacher can create and update students but cannot manage teachers', () => {
  assert.equal(canAccess('teacher', 'students', 'create'), true);
  assert.equal(canAccess('teacher', 'students', 'read'), true);
  assert.equal(canAccess('teacher', 'students', 'update'), true);
  assert.equal(canAccess('teacher', 'students', 'delete'), false);
  assert.equal(canAccess('teacher', 'teachers', 'read'), true);
  assert.equal(canAccess('teacher', 'teachers', 'create'), false);
  assert.equal(canAccess('teacher', 'teachers', 'update'), false);
  assert.equal(canAccess('teacher', 'teachers', 'delete'), false);
});

test('RBAC middleware blocks teacher creation for a teacher account', () => {
  const req = { user: { role: 'teacher' } };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;
  permit('teachers', 'create')(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { message: 'Forbidden: cannot create teachers' });
});
