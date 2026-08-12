import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ReviewService {
  constructor(private readonly databaseService: DatabaseService) {}

  create(createReviewDto: CreateReviewDto) {
    const { productId, ...review } = createReviewDto;
    return this.databaseService.review.create({
      data: { ...review, product: { connect: { id: productId } } },
    });
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

  update(id: string, updateReviewDto: UpdateReviewDto) {
    const { productId, ...review } = updateReviewDto;
    return this.databaseService.review.update({
      where: { id },
      data: productId === undefined
        ? review
        : { ...review, product: { connect: { id: productId } } },
    });
  }

  remove(id: string) {
    return this.databaseService.review.delete({ where: { id } });
  }
}
