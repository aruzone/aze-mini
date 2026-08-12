import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class TagService {
  constructor(private readonly databaseService: DatabaseService) {}

  create(createTagDto: CreateTagDto) {
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

  update(id: string, updateTagDto: UpdateTagDto) {
    return this.databaseService.tag.update({
      where: { id },
      data: updateTagDto,
    });
  }

  remove(id: string) {
    return this.databaseService.tag.delete({ where: { id } });
  }
}
