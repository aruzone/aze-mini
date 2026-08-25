import { UpdateReviewRequest } from '@aze-mini/demo-contracts';
import { PartialType } from '@nestjs/swagger';
import { CreateReviewDto } from './create-review.dto';

export class UpdateReviewDto
  extends PartialType(CreateReviewDto)
  implements UpdateReviewRequest {}
