import { ApiProperty } from '@nestjs/swagger';

// --- User Entity DTO ---
export class AdminUserDto {
  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: 'avatar-12345.png', required: false, nullable: true })
  avatar?: string;

  @ApiProperty({ example: '+1234567890', required: false, nullable: true })
  phone_number?: string;

  @ApiProperty({ example: 'user' })
  type: string;

  @ApiProperty({
    example: '2026-06-28T05:27:41Z',
    required: false,
    nullable: true,
  })
  approved_at?: string;

  @ApiProperty({ example: '2026-06-28T05:27:41Z' })
  created_at: string;

  @ApiProperty({ example: '2026-06-28T05:27:41Z' })
  updated_at: string;

  @ApiProperty({ example: 'cus_123456789', required: false, nullable: true })
  billing_id?: string;

  @ApiProperty({
    example: 'http://localhost:2004/storage/avatar/avatar-12345.png',
    required: false,
    nullable: true,
  })
  avatar_url?: string;
}

// --- Create User Response ---
export class AdminUserActionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'User created successfully' })
  message: string;

  @ApiProperty({ type: AdminUserDto })
  data: AdminUserDto;
}

// --- List Users Response ---
export class AdminUserListItemDto {
  @ApiProperty({ example: 'cl0a1b2c3d4e5f6g7h8i9j0k' })
  id: string;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: 'avatar-12345.png', required: false, nullable: true })
  avatar?: string;

  @ApiProperty({ example: '+1234567890', required: false, nullable: true })
  phone_number?: string;

  @ApiProperty({ example: 'Free Plan' })
  subscription_plan: string;

  @ApiProperty({ example: 5 })
  total_stops: number;

  @ApiProperty({ example: '2026-06-28T05:27:41Z' })
  created_at: string;

  @ApiProperty({ example: 'Active' })
  status: string;
}

export class AdminUserListMetaDto {
  @ApiProperty({ example: 45 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}

export class AdminUserListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [AdminUserListItemDto] })
  data: AdminUserListItemDto[];

  @ApiProperty({ type: AdminUserListMetaDto })
  meta_data: AdminUserListMetaDto;
}

// --- User Detail Response ---
export class AdminUserDetailResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: AdminUserDto })
  data: AdminUserDto;
}

// --- Generic Success Response (Approve, Reject, Update, Delete) ---
export class AdminUserGenericSuccessDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}
