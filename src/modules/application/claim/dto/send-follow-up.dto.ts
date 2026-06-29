import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min, Max } from 'class-validator';

export class SendFollowUpDto {
  @ApiProperty({
    example: 1,
    description:
      'The escalation level: 1 (Professional Reminder), 2 (Firm Notice), 3 (Final Notice)',
    enum: [1, 2, 3],
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(3)
  level: number;
}
