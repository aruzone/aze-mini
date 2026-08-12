import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { DatabaseService } from '../database/database.service';

// Every read but findUserByEmail drops the password, so no route can leak a
// hash by returning a User straight from Prisma.
const withoutPassword = { password: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  /** `password` must already be hashed — AuthService.register is the only caller. */
  async create(createUserDto: Prisma.UserCreateInput) {
    return this.databaseService.user.create({
      data: createUserDto,
      omit: withoutPassword,
    });
  }

  async findOne(id: string) {
    return this.databaseService.user.findUnique({
      where: { id },
      omit: withoutPassword,
    });
  }

  async findUserByEmail(email: string) {
    return this.databaseService.user.findUnique({ where: { email } });
  }

}
