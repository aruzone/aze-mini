import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class TagService {
  constructor(private readonly databaseService: DatabaseService) {}

  create(createTagDto: CreateTagDto) {
    const { productIds, ...tag } = createTagDto;
    return this.databaseService.tag.create({
      data: {
        ...tag,
        ...(productIds && { products: { connect: productIds.map((id) => ({ id })) } }),
      },
    });
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
    const { productIds, ...tag } = updateTagDto;
    return this.databaseService.tag.update({
      where: { id },
      data: {
        ...tag,
        ...(productIds && { products: { set: productIds.map((pid) => ({ id: pid })) } }),
      },
    });
  }

  remove(id: string) {
    return this.databaseService.tag.delete({ where: { id } });
  }
}
