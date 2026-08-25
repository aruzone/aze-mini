import { UpdateProductRequest } from '@aze-mini/demo-contracts';
import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto
  extends PartialType(CreateProductDto)
  implements UpdateProductRequest {}
