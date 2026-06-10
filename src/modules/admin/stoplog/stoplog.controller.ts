import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
  Query,
} from '@nestjs/common';
import { StopLogService } from './stoplog.service';
import { CreateStopLogDto } from './dto/create-stoplog.dto';
import { UpdateStopLogDto } from './dto/update-stoplog.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { QueryStopLogDto } from '../../application/stoplog/dto/query-stoplog.dto';

@ApiTags('Admin stoplog')
@ApiBearerAuth('admin_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/stoplog')
export class StopLogController {
  constructor(private readonly stopLogService: StopLogService) {}

  @ApiOperation({
    summary: 'Get all stop logs for a specific user',
    description:
      'Allows administrative users to retrieve all stop logs belonging to a specific user (driver) by their user ID. Supports cursor pagination and text search filtering.',
  })
  @ApiResponse({
    status: 200,
    description: 'User stop logs fetched successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'User stop logs fetched successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'cl0a1b2c3d4e5f6g7h8i9j0k' },
              address: { type: 'string', example: 'Acme Warehouse', nullable: true },
              arrived_at: { type: 'string', format: 'date-time' },
              docked_at: { type: 'string', format: 'date-time', nullable: true },
              completed_at: { type: 'string', format: 'date-time', nullable: true },
              departed_at: { type: 'string', format: 'date-time', nullable: true },
              detention: { type: 'string', example: '200.00' },
            },
          },
        },
        meta_data: {
          type: 'object',
          properties: {
            next_cursor: { type: 'string', example: 'cl0a1b2c3d4e5f6g7h8i9j0k', nullable: true },
            limit: { type: 'number', example: 10 },
          },
        },
      },
    },
  })
  @Get('user/:user_id')
  findAllByUser(
    @Param('user_id') user_id: string,
    @Query() query: QueryStopLogDto,
  ) {
    return this.stopLogService.findAllByUser(user_id, query);
  }

  @ApiOperation({
    summary: 'Create a new stop log (Placeholder)',
    description: 'Creates a new stop log in the system (boilerplace endpoint).',
  })
  @ApiResponse({ status: 201, description: 'Returns a confirmation string.' })
  @Post()
  create(@Body() createStopLogDto: CreateStopLogDto) {
    return this.stopLogService.create(createStopLogDto);
  }

  @ApiOperation({
    summary: 'Get all stop logs across the system (Placeholder)',
    description: 'Fetches all stop logs available in the system database.',
  })
  @ApiResponse({ status: 200, description: 'Returns a confirmation string.' })
  @Get()
  findAll() {
    return this.stopLogService.findAll();
  }

  @ApiOperation({
    summary: 'Get stop log details by ID (Placeholder)',
    description: 'Fetches details of a specific stop log by ID.',
  })
  @ApiResponse({ status: 200, description: 'Returns a confirmation string.' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stopLogService.findOne(+id);
  }

  @ApiOperation({
    summary: 'Update a stop log by ID (Placeholder)',
    description: 'Updates properties of a specific stop log by ID.',
  })
  @ApiResponse({ status: 200, description: 'Returns a confirmation string.' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStopLogDto: UpdateStopLogDto) {
    return this.stopLogService.update(+id, updateStopLogDto);
  }

  @ApiOperation({
    summary: 'Delete a stop log by ID (Placeholder)',
    description: 'Removes a specific stop log by ID from the database.',
  })
  @ApiResponse({ status: 200, description: 'Returns a confirmation string.' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stopLogService.remove(+id);
  }
}
