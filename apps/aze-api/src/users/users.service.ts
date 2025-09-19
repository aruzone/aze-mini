import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaClient } from '../../generated/prisma';

@Injectable()
export class UsersService {
  private prisma = new PrismaClient();

  async create(createUserDto: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data: createUserDto });
  }

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: number) {
    return this.prisma.user.findUnique({ where: { id: String(id) } });
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: number, updateUserDto: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id: String(id) },
      data: updateUserDto,
    });
  }

  async remove(id: number) {
    return this.prisma.user.delete({ where: { id: String(id) } });
  }
}
