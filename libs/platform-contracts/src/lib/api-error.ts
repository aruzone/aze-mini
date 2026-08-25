/**
 * The one envelope every refusal arrives in, whatever the status and whatever
 * raised it. `message` is a string for a single failure and an array of strings
 * for a field list — the validation pipe reports one entry per failing field —
 * so a caller reading it has to accept both.
 */
export type ApiErrorResponse = {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
};
