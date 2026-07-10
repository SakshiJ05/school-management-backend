export const jwtConfig = {
  accessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'scholify-access-dev',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'scholify-refresh-dev',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  cookieName: 'scholify_refresh',
};
