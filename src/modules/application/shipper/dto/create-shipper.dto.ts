import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class CreateShipperDto {}

export class CreateShipperRatingDto {
  @ApiProperty({ example: 85, description: 'Rating score (0 to 100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  rate: number;
}
