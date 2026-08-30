import { MailSender } from './mail-sender';

const ORIGINAL_ENV = process.env;

describe('MailSender', () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.restoreAllMocks();
  });

  const makeSender = () => {
    const sender = new MailSender();
    // Replace whatever transport was chosen with a spy that records the mail.
    const sent: Array<Record<string, unknown>> = [];
    (sender as unknown as { transport: { sendMail: unknown } }).transport = {
      sendMail: async (mail: Record<string, unknown>) => {
        sent.push(mail);
        return { messageId: 'test-1' };
      },
    };
    return { sender, sent };
  };

  it('sends the subject, recipient and text it is given', async () => {
    const { sender, sent } = makeSender();

    await sender.send({ to: 'ada@example.com', subject: 'Verify your email', text: 'Hello' });

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: 'ada@example.com',
      subject: 'Verify your email',
      text: 'Hello',
    });
  });

  it('picks the logging transport when SMTP_URL is unset', () => {
    delete process.env.SMTP_URL;
    const sender = new MailSender();

    expect(sender.usesLoggingTransport).toBe(true);
  });

  it('picks the logging transport outside production even with SMTP_URL', () => {
    process.env = { ...ORIGINAL_ENV, SMTP_URL: 'smtp://mail.example.com', NODE_ENV: 'development' };
    const sender = new MailSender();

    expect(sender.usesLoggingTransport).toBe(true);
  });

  it('picks the SMTP transport in production with SMTP_URL set', () => {
    process.env = { ...ORIGINAL_ENV, SMTP_URL: 'smtp://mail.example.com', NODE_ENV: 'production' };
    const sender = new MailSender();

    expect(sender.usesLoggingTransport).toBe(false);
  });

  it('logs the mail locally instead of failing when the transport is the logger', async () => {
    delete process.env.SMTP_URL;
    const sender = new MailSender();
    expect(sender.usesLoggingTransport).toBe(true);
    const logger = (sender as unknown as { logger: { log: jest.Mock } }).logger;
    logger.log = jest.fn();

    await sender.send({ to: 'ada@example.com', subject: 'Reset your password', text: 'Link' });

    const logged = logger.log.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
    expect(logged).toContain('Reset your password');
    expect(logged).toContain('ada@example.com');
  });
});
