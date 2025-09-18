export const appConfig = () => {
  console.log('Loading configuration...');
  console.log(parseInt(process.env.PORT || '3000', 10));
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    jwtSecret: process.env.JWT_SECRET || 'defaultSecret',
    environment: process.env.NODE_ENV || 'development',
    // database: {
    //   host: process.env.DATABASE_HOST,
    //   port: parseInt(process.env.DATABASE_PORT || '5432', 10)
    // }
  }
};
