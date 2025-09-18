import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

type AuthInput = {
  username: string;
  password: string;
};

type SignInData = {
  userId: string;
  username: string;
};

type AuthResult = {
  userId: string;
  username: string;
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
    const user = await this.usersService.findUserByName(authInput.username);

    if (user && user.password === authInput.password) {
      return { userId: user.userId.toString(), username: user.username };
    }

    return null;
  }

  async login(user: SignInData): Promise<AuthResult> {
    const payload = { username: user.username, sub: user.userId };
    return {
      accessToken: this.jwtService.sign(payload),
      userId: user.userId,
      username: user.username,
    };
  }
}
