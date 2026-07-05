import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Role } from 'src/common/guard/role/role.enum';

export enum UserStatus {
  PENDING = 0,
  ACTIVE = 1,
  BANNED = -1,
}

export class QueryUserDto {
  @ApiPropertyOptional({
    description: 'Search by username or email',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by role',
    enum: Role,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    Role[value.toUpperCase()] ? Role[value.toUpperCase()] : undefined,
  )
  @IsEnum(Role)
  type?: Role;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: ['PENDING', 'ACTIVE', 'BANNED'],
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => UserStatus[value.toUpperCase()] ?? undefined)
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({
    description: 'Limit number',
    example: 10,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
