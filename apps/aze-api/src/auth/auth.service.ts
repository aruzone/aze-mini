import { AuthResponse, AuthNotice } from '@aze-mini/platform-contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import {
  UNIQUE_CONSTRAINT_FAILED,
  isPrismaError,
} from '../database/prisma-errors';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginAttempts } from './login-attempts';
import { MAX_PASSWORD_BYTES, hashPassword } from './password';
import { TokenClaims } from './token-claims';
import { RefreshSessions } from './refresh-sessions';
import { SESSION_REFUSED } from './refresh-cookie';
import { EmailTokens } from './email-tokens';
import { MailSender } from '../mail/mail-sender';
import { appConfig } from '../config/configuration';

// Emails are compared as raw strings by the unique index and by login, so both
// paths have to agree on one canonical form or the same mailbox gets two
// accounts and only one spelling can log in.
function normalizeEmail(email: unknown): string {
  if (typeof email !== 'string' || email.trim() === '') {
    throw new BadRequestException('An email is required');
  }
  return email.trim().toLowerCase();
}

function requirePassword(password: unknown): string {
  if (typeof password !== 'string' || password === '') {
    throw new BadRequestException('A password is required');
  }
  return password;
}

/** Not a response: what login signs a token from, before there is a token. */
type SignInData = {
  userId: string;
  email: string;
  verifiedAt: Date | null;
};

/** What login returns before the controller turns the refresh token into a cookie. */
type LoginResult = {
  auth: AuthResponse;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly attempts: LoginAttempts,
    private readonly refreshSessions: RefreshSessions,
    private readonly emailTokens: EmailTokens,
    private readonly mailSender: MailSender,
  ) {}

  async register(registerInput: RegisterDto): Promise<LoginResult> {
    const email = normalizeEmail(registerInput.email);
    const password = requirePassword(registerInput.password);

    if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
      throw new BadRequestException(
        `A password may be at most ${MAX_PASSWORD_BYTES} bytes long`,
      );
    }

    const existing = await this.usersService.findUserByEmail(email);
    if (existing) {
      throw new ConflictException('That email is already registered');
    }

    try {
      const user = await this.usersService.create({
        email,
        name: registerInput.name,
        password: await hashPassword(password),
      });

      // Unverified Users may still sign in (ADR-0011); the verification email
      // is a courtesy, not a gate. Its failure must never fail the
      // registration that triggered it.
      await this.sendVerificationEmail(user.id, user.email).catch(() => undefined);

      return this.login({ userId: user.id, email: user.email, verifiedAt: user.verifiedAt });
    } catch (error) {
      // The check above loses a race between two registrations of the same
      // email; the unique index is what actually settles it. The filter answers
      // P2002 with a 409 too, but only in terms of the column that collided —
      // this stays because registration can say it in the caller's terms.
      if (isPrismaError(error, UNIQUE_CONSTRAINT_FAILED)) {
        throw new ConflictException('That email is already registered');
      }
      throw error;
    }
  }

  /**
   * `source` is who is asking — the caller's address. Guessing a password is
   * cheap and unlimited otherwise, and nothing else here would notice.
   */
  async authenticate(authInput: LoginDto, source: string): Promise<LoginResult> {
    // Normalized first, so the count follows the User rather than the spelling
    // — otherwise five guesses at ADA@ and five more at ada@ are ten.
    const email = normalizeEmail(authInput.email);
    // All three are Redis round-trips now (ADR-0010), so each is awaited: an
    // unawaited refusal would escape as an unhandled rejection instead of a
    // 429, and an unawaited failure would not be counted at all.
    await this.attempts.refuseIfExhausted(source, email);

    const user = await this.validateUser(authInput);
    if (!user) {
      await this.attempts.recordFailure(source, email);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.attempts.succeeded(source, email);
    return this.login(user);
  }

  async validateUser(authInput: LoginDto): Promise<SignInData | null> {
    // Validate before the lookup: bcrypt throws on a non-string password, and a
    // 500 for registered emails against a 401 for the rest would say which is
    // which.
    const email = normalizeEmail(authInput.email);
    const password = requirePassword(authInput.password);

    const user = await this.usersService.findUserByEmail(email);

    if (user && (await compare(password, user.password))) {
      return { userId: user.id, email: user.email, verifiedAt: user.verifiedAt };
    }

    return null;
  }

  async login(user: SignInData): Promise<LoginResult> {
    const payload: TokenClaims = {
      email: user.email,
      sub: user.userId,
      // verifiedAt rides in the claims so an Adopter can gate logins on it
      // later without touching the schema (ADR-0011).
      verified: user.verifiedAt !== null,
    };
    const auth: AuthResponse = {
      accessToken: this.jwtService.sign(payload),
      userId: user.userId,
      email: user.email,
    };
    const refreshToken = await this.refreshSessions.issue(user.userId);
    return { auth, refreshToken };
  }

  /** Signs a fresh access token for a User the refresh session already verified. */
  async issueAccessTokenFor(userId: string): Promise<AuthResponse> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException(SESSION_REFUSED);
    }

    const payload: TokenClaims = {
      email: user.email,
      sub: user.id,
      verified: user.verifiedAt !== null,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      userId: user.id,
      email: user.email,
    };
  }
  /**
   * Enumeration-safe end to end (ADR-0011): the answer is identical in wording
   * and timing whether or not the address is registered.
   *
   * The timing half is a bcrypt both branches pay, not one. Spending it only
   * on the miss made the two paths differ by a whole hash in the other
   * direction — a registered address answered faster, which says just as much
   * as answering slower. What is left is the token write, microseconds beside
   * it. The send is deliberately not awaited for the same reason: an SMTP
   * round trip is seconds no dummy work can match.
   */
  async forgotPassword(email: string): Promise<AuthNotice> {
    const normalized = normalizeEmail(email);
    const user = await this.usersService.findUserByEmail(normalized);

    // The cost floor, paid before the branch so the branch cannot be timed.
    await hashPassword('timing equalizer');

    if (user) {
      const token = await this.emailTokens.issue(user.id, 'RESET');
      const resetUrl = `${appConfig().appOrigin}/reset?token=${token}`;
      void this.mailSender
        .send({
          to: user.email,
          subject: 'Reset your password',
          text: `Someone asked to reset your password. Open this link to choose a new one:\n\n${resetUrl}\n\nThe link works for one hour. If it was not you, ignore this email.`,
        })
        .catch(() => undefined);
    }

    return {
      message: 'If that address is registered, a reset link is on its way.',
    };
  }

  /**
   * The reset writes the new hash, notifies the User, never auto-logs in, and
   * — per ADR-0009 — revokes every refresh family the User has, so a stolen
   * session does not survive the new password.
   */
  async resetPassword(token: string, password: string): Promise<AuthNotice> {
    if (typeof password !== 'string' || password === '') {
      throw new BadRequestException('A password is required');
    }
    if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
      throw new BadRequestException(
        `A password may be at most ${MAX_PASSWORD_BYTES} bytes long`,
      );
    }

    const userId = await this.emailTokens.consume(token, 'RESET');
    if (!userId) {
      throw new BadRequestException('This reset link is invalid or has expired.');
    }

    const user = await this.usersService.updatePassword(userId, await hashPassword(password));

    await this.refreshSessions.revokeAllFor(userId);
    await this.mailSender.send({
      to: user.email,
      subject: 'Your password was changed',
      text: 'Your password was just reset. All signed-in sessions were revoked. If it was not you, contact support immediately.',
    }).catch(() => undefined);

    return { message: 'Your password has been reset. You can sign in with the new one.' };
  }

  async verifyEmail(token: string): Promise<AuthNotice> {
    const userId = await this.emailTokens.consume(token, 'VERIFICATION');
    if (!userId) {
      throw new BadRequestException('This verification link is invalid or has expired.');
    }

    const user = await this.usersService.markVerified(userId);
    return { message: `Your email ${user.email} is now verified.` };
  }

  private async sendVerificationEmail(userId: string, email: string): Promise<void> {
    const token = await this.emailTokens.issue(userId, 'VERIFICATION');
    const verifyUrl = `${appConfig().appOrigin}/verify?token=${token}`;
    await this.mailSender.send({
      to: email,
      subject: 'Verify your email',
      text: `Welcome! Confirm your email address by opening this link:\n\n${verifyUrl}\n\nThe link works for 24 hours.`,
    });
  }
}
