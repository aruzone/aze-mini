import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma';

@Injectable()
export class ReviewService {
  create(createReviewDto: Prisma.ReviewCreateInput) {
    return 'This action adds a new review';
  }

  findAll() {
    return `This action returns all review`;
  }

  findOne(id: number) {
    return `This action returns a #${id} review`;
  }

  update(id: number, updateReviewDto: Prisma.ReviewUpdateInput) {
    return `This action updates a #${id} review`;
  }

  remove(id: number) {
    return `This action removes a #${id} review`;
  }
}
