import { Controller, Get, Body, Patch, Param, Delete } from '@nestjs/common';
import { UsersService } from './users.service';
import { Prisma } from '../../generated/prisma';

// Accounts are created by POST /auth/register, which hashes the password, so
// this resource has no create route and never writes a password. It says
// nothing about who may call it — these routes are still reachable
// anonymously until the global guard of ADR-0002 lands (#5).
type UpdateUserDto = Omit<Prisma.UserUpdateInput, 'password'>;

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const safeUpdate: UpdateUserDto = { ...updateUserDto };
    delete (safeUpdate as { password?: unknown }).password;
    return this.usersService.update(id, safeUpdate);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
