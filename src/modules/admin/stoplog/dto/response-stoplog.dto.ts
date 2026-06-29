import { ApiProperty } from '@nestjs/swagger';

// --- List User Stop Logs Response ---
export class AdminStopLogItemDto {
  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  id: string;

  @ApiProperty({ example: 'Acme Warehouse', required: false, nullable: true })
  address?: string;

  @ApiProperty({ example: '2026-06-28T05:27:41Z' })
  arrived_at: string;

  @ApiProperty({
    example: '2026-06-28T05:27:41Z',
    required: false,
    nullable: true,
  })
  docked_at?: string;

  @ApiProperty({
    example: '2026-06-28T05:27:41Z',
    required: false,
    nullable: true,
  })
  completed_at?: string;

  @ApiProperty({
    example: '2026-06-28T05:27:41Z',
    required: false,
    nullable: true,
  })
  departed_at?: string;

  @ApiProperty({ example: '200.00' })
  detention: string;
}

export class AdminStopLogMetaDto {
  @ApiProperty({
    example: 'cl0a1b2c3d4e5f6g7h8i9j0k',
    required: false,
    nullable: true,
  })
  next_cursor?: string;

  @ApiProperty({ example: 10 })
  limit: number;
}

export class AdminStopLogListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'User stop logs fetched successfully' })
  message: string;

  @ApiProperty({ type: [AdminStopLogItemDto] })
  data: AdminStopLogItemDto[];

  @ApiProperty({ type: AdminStopLogMetaDto })
  meta_data: AdminStopLogMetaDto;
}

// --- Placeholder Endpoint Response ---
export class AdminStopLogPlaceholderResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}
