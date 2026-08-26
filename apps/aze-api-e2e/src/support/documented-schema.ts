/**
 * Holds a real response to the schema the document publishes for it. A schema
 * that describes fields the API does not send — or misses fields it does — is
 * as wrong as one that is absent, and neither shows up in a test that only
 * reads the document. Both directions are checked here: every documented
 * property against the value, and every property of the value against the
 * document.
 */
export type Schema = {
  $ref?: string;
  type?: string;
  format?: string;
  nullable?: boolean;
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  oneOf?: Schema[];
};

export type Components = Record<string, Schema>;

const REF_PREFIX = '#/components/schemas/';

function resolve(schema: Schema, components: Components): Schema {
  if (!schema.$ref) return schema;
  const name = schema.$ref.slice(REF_PREFIX.length);
  const target = components[name];
  if (!target) throw new Error(`The document references ${schema.$ref}, which is absent`);
  return resolve(target, components);
}

const typeOf = (value: unknown) =>
  value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;

/** Every way `value` and `schema` disagree, named so a failure says which field. */
export function schemaProblems(
  value: unknown,
  documented: Schema,
  components: Components,
  at = 'body',
): string[] {
  const schema = resolve(documented, components);

  if (schema.oneOf) {
    const matched = schema.oneOf.some(
      (branch) => schemaProblems(value, branch, components, at).length === 0,
    );
    return matched ? [] : [`${at}: ${typeOf(value)} matches none of the documented shapes`];
  }

  if (value === null) {
    return schema.nullable ? [] : [`${at}: null, which the document does not allow`];
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) return [`${at}: ${typeOf(value)}, documented as an array`];
    return value.flatMap((entry, index) =>
      schemaProblems(entry, schema.items ?? {}, components, `${at}[${index}]`),
    );
  }

  if (schema.type === 'object' || schema.properties) {
    if (typeOf(value) !== 'object') return [`${at}: ${typeOf(value)}, documented as an object`];
    const properties = schema.properties ?? {};
    const body = value as Record<string, unknown>;

    return [
      ...(schema.required ?? [])
        .filter((name) => !(name in body))
        .map((name) => `${at}.${name}: documented as required and absent`),
      ...Object.keys(body)
        .filter((name) => !(name in properties))
        .map((name) => `${at}.${name}: answered and not documented`),
      ...Object.entries(properties)
        .filter(([name]) => name in body)
        .flatMap(([name, property]) =>
          schemaProblems(body[name], property, components, `${at}.${name}`),
        ),
    ];
  }

  const expected =
    schema.type === 'integer' ? 'number' : schema.type === undefined ? typeOf(value) : schema.type;
  if (typeOf(value) !== expected) {
    return [`${at}: ${typeOf(value)}, documented as ${schema.type}`];
  }

  if (schema.format === 'date-time' && Number.isNaN(Date.parse(value as string))) {
    return [`${at}: ${String(value)}, documented as a date-time`];
  }

  return [];
}
