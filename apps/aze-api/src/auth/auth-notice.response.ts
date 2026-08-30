import { AuthNotice as AuthNoticeContract, Wire } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';

/**
 * What the email-flow routes answer with. The wording is deliberately neutral:
 * the same message goes out whether or not the address is registered, so the
 * response itself cannot be used to enumerate accounts (ADR-0011).
 */
export class AuthNoticeResponse implements Wire<AuthNoticeContract> {
  @ApiProperty({ example: 'If that address is registered, a reset link is on its way.' })
  message: string;
}
