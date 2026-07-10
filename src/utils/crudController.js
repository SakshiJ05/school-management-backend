import { ok, fail } from './apiResponse.js';
import { mapBody, serializeRow, serializeRows } from './serializer.js';

export function makeCrudController(Model, options = {}) {
  const {
    schoolScoped = true,
    include = [],
    order = [['id', 'DESC']],
    beforeCreate,
    beforeUpdate,
    scopeWhere,
  } = options;

  function tenantId(req) {
    return req.tenant?.schoolId;
  }

  function baseWhere(req) {
    const where = {};
    if (schoolScoped && tenantId(req)) {
      where.school_id = tenantId(req);
    }
    if (scopeWhere) {
      Object.assign(where, scopeWhere(req));
    }
    return where;
  }

  async function assertOwnership(req, id) {
    return Model.findOne({ where: { id, ...baseWhere(req) } });
  }

  return {
    async list(req, res) {
      try {
        const rows = await Model.findAll({ where: baseWhere(req), include, order });
        return ok(res, serializeRows(rows));
      } catch (err) {
        return fail(res, err.message, 500);
      }
    },

    async get(req, res) {
      try {
        const row = await assertOwnership(req, req.params.id);
        if (!row) return fail(res, 'Not found', 404);
        return ok(res, serializeRow(row));
      } catch (err) {
        return fail(res, err.message, 500);
      }
    },

    async create(req, res) {
      try {
        let payload = mapBody(req.body, schoolScoped ? tenantId(req) : null);
        if (beforeCreate) payload = await beforeCreate(payload, req);
        const row = await Model.create(payload);
        return ok(res, serializeRow(row), 'Created', 201);
      } catch (err) {
        return fail(res, err.message, 400);
      }
    },

    async update(req, res) {
      try {
        const row = await assertOwnership(req, req.params.id);
        if (!row) return fail(res, 'Not found', 404);
        let patch = mapBody(req.body, null);
        delete patch.school_id;
        delete patch.id;
        if (beforeUpdate) patch = await beforeUpdate(patch, row, req);
        await row.update(patch);
        return ok(res, serializeRow(row));
      } catch (err) {
        return fail(res, err.message, 400);
      }
    },

    async remove(req, res) {
      try {
        const row = await assertOwnership(req, req.params.id);
        if (!row) return fail(res, 'Not found', 404);
        await row.destroy();
        return ok(res, { id: Number(req.params.id) }, 'Deleted');
      } catch (err) {
        return fail(res, err.message, 400);
      }
    },
  };
}
