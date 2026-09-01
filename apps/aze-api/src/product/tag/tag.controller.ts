import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { TagService } from './tag.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tag } from './tag.response';
import { ApiRefusal } from '../../config/decorators/api-refusal.decorator';
import { CurrentUser } from '../../config/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/token-claims';

@Controller('tag')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @ApiCreatedResponse({ description: 'The created Tag', type: Tag })
  @ApiRefusal(HttpStatus.NOT_FOUND, 'No Product with one of those productIds')
  @ApiRefusal(HttpStatus.CONFLICT, 'That name is already taken')
  @Post()
  create(
    @Body() createTagDto: CreateTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tagService.create(createTagDto, user.userId);
  }

  @ApiOkResponse({ description: 'Every Tag', type: [Tag] })
  @Get()
  findAll() {
    return this.tagService.findAll();
  }

  @ApiOkResponse({ description: 'One Tag', type: Tag })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tagService.findOne(id);
  }

  @ApiOkResponse({ description: 'The updated Tag', type: Tag })
  @ApiRefusal(HttpStatus.NOT_FOUND, 'No Product with one of those productIds')
  @ApiRefusal(HttpStatus.CONFLICT, 'That name is already taken')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateTagDto: UpdateTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tagService.update(id, updateTagDto, user.userId);
  }

  @ApiOkResponse({ description: 'The deleted Tag', type: Tag })
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tagService.remove(id, user.userId);
  }
}
