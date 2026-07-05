import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AdminUserActionResponseDto,
  AdminUserListResponseDto,
  AdminUserDetailResponseDto,
  AdminUserGenericSuccessDto,
  AdminUserStatsResponseDto,
} from './dto/response-user.dto';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { QueryUserDto } from './dto/query-user.dto';

@ApiBearerAuth('admin_token')
@ApiTags('Admin User')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Creates a new user with the specified roles and details.',
  })
  @ApiResponse({
    status: 201,
    description: 'Create a user',
    type: AdminUserActionResponseDto,
  })
  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    try {
      const user = await this.userService.create(createUserDto);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({
    summary: 'Retrieve all users',
    description:
      'Fetches a list of all users. Supports query filtering by search, type, and approved status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Get all users',
    type: AdminUserListResponseDto,
  })
  @Get()
  async findAll(@Query() query: QueryUserDto) {
    return await this.userService.findAll(query);
  }

  @ApiExcludeEndpoint()
  // approve user
  @ApiOperation({
    summary: 'Approve user registration',
    description:
      'Approves a pending user registration and activates their account.',
  })
  @ApiResponse({
    status: 200,
    description: 'Approve a user',
    type: AdminUserGenericSuccessDto,
  })
  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    try {
      const user = await this.userService.approve(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // reject user
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Reject user registration',
    description: 'Rejects a pending user registration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reject a user',
    type: AdminUserGenericSuccessDto,
  })
  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    try {
      const user = await this.userService.reject(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({
    summary: 'Retrieve general stats summary',
    description:
      'Fetches total users, monthly revenue, stop logs today, and total paid subscribers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Stats summary retrieved successfully.',
    type: AdminUserStatsResponseDto,
  })
  @Get('stats')
  getStats() {
    return this.userService.getStats();
  }

  @ApiOperation({
    summary: 'Retrieve user by ID',
    description:
      'Fetches detailed information for a specific user by their ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'Get a user by id',
    type: AdminUserDetailResponseDto,
  })
  @Get(':user_id')
  findOne(@Param('user_id') user_id: string) {
    return this.userService.findOne(user_id);
  }

  @ApiOperation({
    summary: 'Update user details',
    description: 'Updates details of an existing user.',
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: AdminUserActionResponseDto,
  })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @ApiOperation({
    summary: 'Delete user',
    description: 'Deletes a user by their ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    type: AdminUserActionResponseDto,
  })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Patch(':user_id/ban')
  bannedUser(@Param('user_id') user_id: string) {
    return this.userService.bannedUser(user_id);
  }

  @Patch(':user_id/unban')
  unBanUser(@Param('user_id') user_id: string) {
    return this.userService.unBanUser(user_id);
  }
}
