import { ApiErrorResponse as ApiErrorResponseContract } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';

/**
 * The envelope `ApiExceptionFilter` writes, as the document describes it. It is
 * declared once and every refusal in the document is a reference to it — see
 * `documentRefusals` in src/config/docs.ts — so a caller reads one shape
 * whatever the status, exactly as the filter writes one.
 */
export class ApiErrorResponse implements ApiErrorResponseContract {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ format: 'date-time', example: '2026-08-26T09:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/api/products/0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f' })
  path: string;

  @ApiProperty({
    description: 'A string for a single failure, an array of strings for a field list',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Product with ID 0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f not found',
  })
  message: string | string[];
}
