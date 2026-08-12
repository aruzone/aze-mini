import { ValidationPipe } from '@nestjs/common';

/**
 * Applied globally in main.ts. `forbidNonWhitelisted` is what turns an unknown
 * property into a refusal rather than a silent drop: a caller who sends a
 * column name that is not part of the contract is told so.
 */
export const validationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
