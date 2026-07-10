import mongoose from 'mongoose';

export function tenantQuery(req, extra = {}) {
  const tenantId = req.tenantId;
  if (!tenantId) return extra;
  if (mongoose.Types.ObjectId.isValid(tenantId)) {
    return { ...extra, tenantId: new mongoose.Types.ObjectId(tenantId) };
  }
  return { ...extra, tenantId };
}
