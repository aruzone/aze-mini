import { appConfig } from './configuration';

describe('appConfig', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
    delete process.env.NODE_ENV;
    delete process.env.API_DOCS;
  });

  afterAll(() => {
    process.env = original;
  });

  describe('docsEnabled', () => {
    it('serves the docs in development', () => {
      expect(appConfig().docsEnabled).toBe(true);
    });

    // An Adopter who deploys without thinking about it does not publish a map
    // of every route and body shape.
    it('withholds them in production by default', () => {
      process.env.NODE_ENV = 'production';

      expect(appConfig().docsEnabled).toBe(false);
    });

    it('serves them in production when asked to', () => {
      process.env.NODE_ENV = 'production';
      process.env.API_DOCS = 'true';

      expect(appConfig().docsEnabled).toBe(true);
    });

    it('withholds them anywhere when refused', () => {
      process.env.NODE_ENV = 'development';
      process.env.API_DOCS = 'false';

      expect(appConfig().docsEnabled).toBe(false);
    });

    it('treats any value other than true as a refusal', () => {
      process.env.API_DOCS = 'yes';

      expect(appConfig().docsEnabled).toBe(false);
    });
  });
});
