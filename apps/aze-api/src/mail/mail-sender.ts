import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { appConfig } from '../config/configuration';

/**
 * Outbound mail in one file and one method (ADR-0011).
 *
 * In production with `SMTP_URL` set, mail goes out over plain SMTP — providers
 * stay an Adopter choice, which is what clone-and-own (ADR-0004) demands.
 * Anywhere else — unset variable, non-production environment — Nodemailer's
 * jsonTransport writes the mail into the JSON log instead: local development
 * needs no SMTP server, and a fresh clone can run the whole email flow and
 * still read the tokens off the log.
 *
 * No template machinery, no provider SDKs. Three static emails did not need
 * either, and both were considered and rejected.
 */
@Injectable()
export class MailSender {
  private readonly logger = new Logger(MailSender.name);
  private readonly transport: Transporter;
  readonly usesLoggingTransport: boolean;

  constructor() {
    const config = appConfig();
    this.usesLoggingTransport = !(config.smtpUrl && config.environment === 'production');

    this.transport = this.usesLoggingTransport
      ? nodemailer.createTransport({ jsonTransport: true })
      : nodemailer.createTransport(config.smtpUrl as string);
  }

  async send(mail: { to: string; subject: string; text: string }): Promise<void> {
    const config = appConfig();
    const from = `no-reply@${new URL(config.appOrigin).host}`;

    const info = await this.transport.sendMail({ from, ...mail });

    // The logging transport delivers the mail as a JSON string. Printing it
    // here is what makes the local flow usable — the token the email carries
    // is on the console, not in an inbox that does not exist.
    if (this.usesLoggingTransport && typeof info.message === 'string') {
      this.logger.log(info.message);
    }
  }
}
