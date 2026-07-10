import mongoose from 'mongoose';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  console.error(err);

  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  if (err.code === 11000) {
    return res.status(400).json({ message: 'A teacher with this email already exists' });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: 'Invalid teacher id' });
  }

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ message });
}
