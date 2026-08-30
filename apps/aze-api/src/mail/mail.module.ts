import { Module } from '@nestjs/common';
import { MailSender } from './mail-sender';

/** One provider, exported for the auth module. That is the whole module. */
@Module({
  providers: [MailSender],
  exports: [MailSender],
})
export class MailModule {}
