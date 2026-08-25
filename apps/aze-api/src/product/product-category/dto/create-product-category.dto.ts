import { CreateProductCategoryRequest } from '@aze-mini/demo-contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateProductCategoryDto implements CreateProductCategoryRequest {
  @ApiProperty({ example: 'Widgets' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
