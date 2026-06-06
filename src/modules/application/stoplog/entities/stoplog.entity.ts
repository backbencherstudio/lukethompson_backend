import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LogStopStep } from '../dto/create-stoplog.dto';

export class StopLog {
  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  id: string;

  @ApiProperty({ example: '2023-10-27T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2023-10-27T10:00:00.000Z' })
  updated_at: Date;

  @ApiProperty({ example: '2023-10-27T10:00:00.000Z' })
  arrived_at: Date;

  @ApiPropertyOptional({ example: '2023-10-27T10:30:00.000Z' })
  docked_at?: Date;

  @ApiPropertyOptional({ example: '2023-10-27T11:00:00.000Z' })
  completed_at?: Date;

  @ApiPropertyOptional({ example: '2023-10-27T11:30:00.000Z' })
  departed_at?: Date;

  @ApiProperty({ enum: LogStopStep, example: LogStopStep.ARRIVAL_TIME })
  current_step: LogStopStep;

  @ApiProperty({ example: 'user_id_123' })
  user_id: string;
}
