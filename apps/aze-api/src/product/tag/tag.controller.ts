import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { TagService } from './tag.service';
import { Prisma } from '../../../generated/prisma';
import { ApiKeyGuard } from '../../config/guards/api-key.guard';
import { AuthGuard } from '../../config/guards/auth.guard';

@Controller('tag')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @UseGuards(ApiKeyGuard, AuthGuard)
  @Post()
  create(@Body() createTagDto: Prisma.TagCreateInput) {
    return this.tagService.create(createTagDto);
  }

  @Get()
  findAll() {
    return this.tagService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tagService.findOne(id);
  }

  @UseGuards(ApiKeyGuard, AuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTagDto: Prisma.TagUpdateInput) {
    return this.tagService.update(id, updateTagDto);
  }

  @UseGuards(ApiKeyGuard, AuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tagService.remove(id);
  }
}
