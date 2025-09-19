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

  async findOne(id: number) {
    const review = await this.databaseService.review.findUnique({
      where: { id: id.toString() },
    });
    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }
    return review;
  }

  update(id: number, updateReviewDto: Prisma.ReviewUpdateInput) {
    return this.databaseService.review.update({
      where: { id: id.toString() },
      data: updateReviewDto,
    });
  }

  remove(id: number) {
    return this.databaseService.review.delete({ where: { id: id.toString() } });
  }
}
