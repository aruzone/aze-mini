import { ApiResponse } from '@nestjs/swagger';
import { ApiErrorResponse } from '../filter/api-error.response';

/**
 * A refusal only the route knows about — a name already taken, rows still
 * pointing at what is being deleted, an id in the body that matches nothing.
 * The perimeter's own refusals are not written here: `documentRefusals` in
 * src/config/docs.ts derives those from what each operation already declares.
 *
 * Either way the body is the one envelope, referenced rather than restated.
 */
export const ApiRefusal = (status: number, description: string) =>
  ApiResponse({ status, description, type: ApiErrorResponse });
