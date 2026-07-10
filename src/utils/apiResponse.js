export function ok(res, data, message = 'Success', status = 200) {
  const body = { success: true, data, message };
  if (data?.pagination) {
    body.pagination = data.pagination;
    body.data = data.items ?? data.rows ?? data;
  }
  return res.status(status).json(body);
}

export function fail(res, message, status = 400, errors = null) {
  return res.status(status).json({
    success: false,
    message,
    errors,
  });
}
