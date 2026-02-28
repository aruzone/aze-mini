export const appConfig = () => ({
  port: parseInt(process.env.PORT || '3030', 10),
  jwtSecret: process.env.JWT_SECRET,
  environment: process.env.NODE_ENV || 'development',
});
