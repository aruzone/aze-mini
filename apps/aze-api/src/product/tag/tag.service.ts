import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class TagService {
  constructor(private readonly databaseService: DatabaseService) {}

  create(createTagDto: Prisma.TagCreateInput) {
    return this.databaseService.tag.create({ data: createTagDto });
  }

  findAll() {
    return this.databaseService.tag.findMany();
  }

  async findOne(id: string) {
    const tag = await this.databaseService.tag.findUnique({
      where: { id },
    });
    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }
    return tag;
  }

  update(id: string, updateTagDto: Prisma.TagUpdateInput) {
    return this.databaseService.tag.update({
      where: { id },
      data: updateTagDto,
    });
  }

  remove(id: string) {
    return this.databaseService.tag.delete({ where: { id } });
  }
}
