import { UserProfile } from '@aze-mini/platform-contracts';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/** Not a request body: AuthService builds this, password already hashed. */
type NewUser = {
  email: string;
  name?: string;
  password: string;
};

// Every read but findUserByEmail drops the password, so no route can leak a
// hash by returning a User straight from Prisma.
const withoutPassword = { password: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  /** `password` must already be hashed — AuthService.register is the only caller. */
  async create(newUser: NewUser) {
    return this.databaseService.user.create({
      data: newUser,
      omit: withoutPassword,
    });
  }

  async findOne(id: string): Promise<UserProfile | null> {
    return this.databaseService.user.findUnique({
      where: { id },
      omit: withoutPassword,
    });
  }

  async findUserByEmail(email: string) {
    return this.databaseService.user.findUnique({ where: { email } });
  }

}
