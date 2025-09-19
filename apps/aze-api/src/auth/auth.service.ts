import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

type AuthInput = {
  email: string;
  password: string;
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

  async authenticate(authInput: AuthInput): Promise<AuthResult | null> {
    const user = await this.validateUser(authInput);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.login(user);
  }

  async validateUser(authInput: AuthInput): Promise<SignInData | null> {
    const user = await this.usersService.findUserByEmail(authInput.email);

    if (user && user.password === authInput.password) {
      return { userId: user.id.toString(), email: user.email };
    }

    return null;
  }

  async login(user: SignInData): Promise<AuthResult> {
    const payload = { email: user.email, sub: user.userId };
    return {
      accessToken: this.jwtService.sign(payload),
      userId: user.userId,
      email: user.email,
    };
  }
}
