import { UpdateTagRequest } from '@aze-mini/demo-contracts';
import { PartialType } from '@nestjs/swagger';
import { CreateTagDto } from './create-tag.dto';

export class UpdateTagDto
  extends PartialType(CreateTagDto)
  implements UpdateTagRequest {}
