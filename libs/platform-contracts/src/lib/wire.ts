/**
 * A contract as it arrives over HTTP. JSON has no date type, so every `Date`
 * the API returns reaches a caller as the ISO string `JSON.stringify` wrote.
 * Declaring a shape once and reading it through `Wire` is what stops a client
 * redeclaring the same fields with different types, and it is why the contracts
 * here are written in the API's terms rather than the wire's.
 *
 * An array needs no case of its own: mapping every key of one maps its elements
 * and leaves it an array. `wire.spec.ts` is what holds that to be true.
 */
export type Wire<T> = T extends Date
  ? string
  : T extends object
    ? { [Field in keyof T]: Wire<T[Field]> }
    : T;
