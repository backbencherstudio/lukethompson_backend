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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  AdminUserActionResponseDto,
  AdminUserListResponseDto,
  AdminUserDetailResponseDto,
  AdminUserGenericSuccessDto,
} from './dto/response-user.dto';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@ApiTags('Admin User')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

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
    description: 'Fetches a list of all users. Supports query filtering by search, type, and approved status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Get all users',
    type: AdminUserListResponseDto,
  })
  @Get()
  async findAll(
    @Query() query: { search?: string; type?: string; approved?: string },
  ) {
    try {
      const users = await this.userService.findAll(query);
      return users;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // approve user
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Approve user registration',
    description: 'Approves a pending user registration and activates their account.',
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
  @Roles(Role.ADMIN)
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
    summary: 'Retrieve user by ID',
    description: 'Fetches detailed information for a specific user by their ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'Get a user by id',
    type: AdminUserDetailResponseDto,
  })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const user = await this.userService.findOne(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
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
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      const user = await this.userService.update(id, updateUserDto);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
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
  async remove(@Param('id') id: string) {
    try {
      const user = await this.userService.remove(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
