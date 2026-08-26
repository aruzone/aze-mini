import { schemaProblems } from './documented-schema';

const components = {
  UserProfile: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
    required: ['id', 'name', 'createdAt'],
  },
  ApiErrorResponse: {
    type: 'object',
    properties: {
      statusCode: { type: 'number' },
      message: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
    },
    required: ['statusCode', 'message'],
  },
};

const profile = {
  id: '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f',
  name: null,
  createdAt: '2026-08-26T09:00:00.000Z',
};

const ref = { $ref: '#/components/schemas/UserProfile' };

// The specs above read real responses against the published document. That is
// only worth anything while a mismatch fails, which is what these hold.
describe('reading a response against the schema documented for it', () => {
  it('accepts a body the document describes', () => {
    expect(schemaProblems(profile, ref, components)).toEqual([]);
  });

  it('names a field the API answered with and the document never mentions', () => {
    expect(schemaProblems({ ...profile, password: 'hash' }, ref, components)).toEqual([
      'body.password: answered and not documented',
    ]);
  });

  it('names a documented field the API did not send', () => {
    const { createdAt: _absent, ...without } = profile;

    expect(schemaProblems(without, ref, components)).toEqual([
      'body.createdAt: documented as required and absent',
    ]);
  });

  it('names a field whose type is not the documented one', () => {
    expect(schemaProblems({ ...profile, id: 7 }, ref, components)).toEqual([
      'body.id: number, documented as string',
    ]);
  });

  it('names a date that is not one', () => {
    expect(schemaProblems({ ...profile, createdAt: 'yesterday' }, ref, components)).toEqual([
      'body.createdAt: yesterday, documented as a date-time',
    ]);
  });

  it('allows null only where the document allows it', () => {
    expect(schemaProblems({ ...profile, name: null }, ref, components)).toEqual([]);
    expect(schemaProblems({ ...profile, id: null }, ref, components)).toEqual([
      'body.id: null, which the document does not allow',
    ]);
  });

  it('reads into the rows of a list', () => {
    const list = { type: 'array', items: ref };

    expect(schemaProblems([profile, { ...profile, id: 7 }], list, components)).toEqual([
      'body[1].id: number, documented as string',
    ]);
  });

  // The envelope's message, which is a string for one failure and a list for a
  // field list — the case a single example would never exercise.
  it('accepts either shape the envelope documents for a message', () => {
    const envelope = { $ref: '#/components/schemas/ApiErrorResponse' };

    expect(schemaProblems({ statusCode: 401, message: 'Unauthorized' }, envelope, components)).toEqual([]);
    expect(schemaProblems({ statusCode: 400, message: ['email must be an email'] }, envelope, components)).toEqual([]);
    expect(schemaProblems({ statusCode: 400, message: 7 }, envelope, components)).toEqual([
      'body.message: number matches none of the documented shapes',
    ]);
  });
});
