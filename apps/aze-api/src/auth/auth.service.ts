import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaClientKnownRequestError } from '../../generated/prisma/runtime/library';
import { UsersService } from '../users/users.service';
import { TokenClaims } from './token-claims';

const SALT_ROUNDS = 10;

// bcrypt reads only the first 72 bytes, so without a cap a longer password
// would be interchangeable with any other sharing its first 72 bytes.
const MAX_PASSWORD_BYTES = 72;

const UNIQUE_CONSTRAINT_FAILED = 'P2002';

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

type AuthInput = {
  email: string;
  password: string;
};

type RegisterInput = AuthInput & {
  name?: string;
};

type SignInData = {
  userId: string;
  email: string;
};

type AuthResult = {
  userId: string;
  email: string;
  accessToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerInput: RegisterInput): Promise<AuthResult> {
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
        password: await hash(password, SALT_ROUNDS),
      });

      return this.login({ userId: user.id, email: user.email });
    } catch (error) {
      // The check above loses a race between two registrations of the same
      // email; the unique index is what actually settles it.
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_FAILED
      ) {
        throw new ConflictException('That email is already registered');
      }
      throw error;
    }
  }

  async authenticate(authInput: AuthInput): Promise<AuthResult | null> {
    const user = await this.validateUser(authInput);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.login(user);
  }

  async validateUser(authInput: AuthInput): Promise<SignInData | null> {
    // Validate before the lookup: bcrypt throws on a non-string password, and a
    // 500 for registered emails against a 401 for the rest would say which is
    // which.
    const email = normalizeEmail(authInput.email);
    const password = requirePassword(authInput.password);

    const user = await this.usersService.findUserByEmail(email);

    if (user && (await compare(password, user.password))) {
      return { userId: user.id, email: user.email };
    }

    return null;
  }

  async login(user: SignInData): Promise<AuthResult> {
    const payload: TokenClaims = { email: user.email, sub: user.userId };
    return {
      accessToken: this.jwtService.sign(payload),
      userId: user.userId,
      email: user.email,
    };
  }
}
