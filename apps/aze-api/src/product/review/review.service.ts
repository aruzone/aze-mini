import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ReviewService {
  constructor(private readonly databaseService: DatabaseService) {}

  create(createReviewDto: Prisma.ReviewCreateInput) {
    return this.databaseService.review.create({ data: createReviewDto });
  }

  findAll() {
    return this.databaseService.review.findMany();
  }

  async findOne(id: string) {
    const review = await this.databaseService.review.findUnique({
      where: { id },
    });
    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }
    return review;
  }

  update(id: string, updateReviewDto: Prisma.ReviewUpdateInput) {
    return this.databaseService.review.update({
      where: { id },
      data: updateReviewDto,
    });
  }

  remove(id: string) {
    return this.databaseService.review.delete({ where: { id } });
  }
}
