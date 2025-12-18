module.exports = {
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    databaseUrl: process.env.DATABASE_URL || null,
    nodeEnv: process.env.NODE_ENV || 'development'
  };
  