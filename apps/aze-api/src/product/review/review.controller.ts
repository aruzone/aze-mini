import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ReviewService } from './review.service';
import { Prisma } from '../../../generated/prisma';
import { ApiKeyGuard } from '../../config/guards/api-key.guard';
import { AuthGuard } from '../../config/guards/auth.guard';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @UseGuards(ApiKeyGuard, AuthGuard)
  @Post()
  create(@Body() createReviewDto: Prisma.ReviewCreateInput) {
    return this.reviewService.create(createReviewDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewService.findOne(id);
  }

  @UseGuards(ApiKeyGuard, AuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateReviewDto: Prisma.ReviewUpdateInput) {
    return this.reviewService.update(id, updateReviewDto);
  }

  @UseGuards(ApiKeyGuard, AuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reviewService.remove(id);
  }
}
