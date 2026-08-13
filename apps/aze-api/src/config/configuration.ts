export const appConfig = () => {
  const environment = process.env.NODE_ENV || 'development';

  return {
    port: parseInt(process.env.PORT || '3030', 10),
    jwtSecret: process.env.JWT_SECRET,
    environment,
    // The docs describe every route and the shape of every body, which is a map
    // an Adopter may not want to publish. Off in production unless asked for,
    // on everywhere else unless refused.
    docsEnabled:
      process.env.API_DOCS === undefined
        ? environment !== 'production'
        : process.env.API_DOCS === 'true',
  };
};
