import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsBoolean } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class UpdateFoundingMemberDto {
  @ApiProperty({
    description: 'Toggle founding member status',
    example: true,
    required: true,
  })
  @IsBoolean()
  isFoundingMember: boolean;
}