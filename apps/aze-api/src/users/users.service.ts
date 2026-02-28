import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createUserDto: Prisma.UserCreateInput) {
    return this.databaseService.user.create({ data: createUserDto });
  }

  async findAll() {
    return this.databaseService.user.findMany();
  }

  async findOne(id: number) {
    return this.databaseService.user.findUnique({ where: { id: String(id) } });
  }

  async findUserByEmail(email: string) {
    return this.databaseService.user.findUnique({ where: { email } });
  }

  async update(id: number, updateUserDto: Prisma.UserUpdateInput) {
    return this.databaseService.user.update({
      where: { id: String(id) },
      data: updateUserDto,
    });
  }

  async remove(id: number) {
    return this.databaseService.user.delete({ where: { id: String(id) } });
  }
}
