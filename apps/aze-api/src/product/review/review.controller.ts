import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review } from './review.response';
import { ApiRefusal } from '../../config/decorators/api-refusal.decorator';
import { CurrentUser } from '../../config/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/token-claims';

@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @ApiCreatedResponse({ description: 'The created Review', type: Review })
  @ApiRefusal(HttpStatus.NOT_FOUND, 'No Product with that productId')
  @Post()
  create(
    @Body() createReviewDto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewService.create(createReviewDto, user.userId);
  }

  @ApiOkResponse({ description: 'One Review', type: Review })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewService.findOne(id);
  }

  @ApiOkResponse({ description: 'The updated Review', type: Review })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewService.update(id, updateReviewDto, user.userId);
  }

  @ApiOkResponse({ description: 'The deleted Review', type: Review })
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reviewService.remove(id, user.userId);
  }
}
