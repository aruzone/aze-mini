import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';

export const IS_MACHINE_TO_MACHINE = 'isMachineToMachine';

/**
 * Marks a route authenticated by API key rather than by a User's token: the
 * global JWT guard stands down and ApiKeyGuard takes over. Stacking the two
 * would demand a token from a caller that has no User to log in as.
 */
export const MachineToMachine = () =>
  applyDecorators(SetMetadata(IS_MACHINE_TO_MACHINE, true), UseGuards(ApiKeyGuard));
