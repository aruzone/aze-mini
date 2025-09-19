import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma';

@Injectable()
export class TagService {
  create(createTagDto: Prisma.TagCreateInput) {
    return 'This action adds a new tag';
  }

  findAll() {
    return `This action returns all tag`;
  }

  findOne(id: number) {
    return `This action returns a #${id} tag`;
  }

  update(id: number, updateTagDto: Prisma.TagUpdateInput) {
    return `This action updates a #${id} tag`;
  }

  remove(id: number) {
    return `This action removes a #${id} tag`;
  }
}
