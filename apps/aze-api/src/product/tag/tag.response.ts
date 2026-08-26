import { Tag as TagContract } from '@aze-mini/demo-contracts';
import { Wire } from '@aze-mini/platform-contracts';
import { ApiProperty } from '@nestjs/swagger';

export class Tag implements Wire<TagContract> {
  @ApiProperty({ example: '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'seasonal' })
  name: string;
}
