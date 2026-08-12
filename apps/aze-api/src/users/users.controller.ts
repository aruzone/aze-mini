import { Controller, Get, Req } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/token-claims';
import { UsersService } from './users.service';

// Accounts are created by POST /auth/register, which hashes the password, so
// this resource has no create route and never writes a password. It reads one
// User only — whoever the token identifies — so there is no path id to guess
// and no way to enumerate the rest.
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  findMe(@Req() request: { user: AuthenticatedUser }) {
    return this.usersService.findOne(request.user.userId);
  }
}
