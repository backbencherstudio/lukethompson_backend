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
} from '@nestjs/common';
import { StopLogService } from './stoplog.service';
import { UpdateStopLogDto } from './dto/update-stoplog.dto';
import { PutStopLogDto } from './dto/create-stoplog.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueryHomeDataDto, QueryStopLogDto } from './dto/query-stoplog.dto';
import { Query } from '@nestjs/common';

@ApiTags('Application stoplog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stoplog')
export class StopLogController {
  constructor(private readonly StopLogService: StopLogService) {}

  @ApiOperation({
    summary: 'Update or create a stop log step (Arrival, Dock, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'Step recorded successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'cl0a1b2c3d4e5f6g7h8i9j0k' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        arrived_at: { type: 'string', format: 'date-time' },
        docked_at: { type: 'string', format: 'date-time', nullable: true },
        completed_at: { type: 'string', format: 'date-time', nullable: true },
        departed_at: { type: 'string', format: 'date-time', nullable: true },
        current_step: { type: 'string', example: 'ARRIVAL_TIME' },
        user_id: { type: 'string', example: 'user_id_123' },
      },
    },
  })
  @Put()
  putStopLog(
    @Body() putStopLogDto: PutStopLogDto,
    @GetUser('id') user_id: string,
  ) {
    return this.StopLogService.putStopLogDto(putStopLogDto, user_id);
  }

  @ApiOperation({ summary: 'Get all stop logs for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'List of stop logs fetched successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Stop logs fetched successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'cl0a1b2c3d4e5f6g7h8i9j0k' },
              arrived_at: { type: 'string', example: '10:00', nullable: true },
              departed_at: { type: 'string', example: '15:54', nullable: true },
              address: {
                type: 'string',
                example: 'Warehouse A, Dhaka',
                nullable: true,
              },
              total_time: { type: 'string', example: '5.90', nullable: true },
              payable_time: { type: 'string', example: '2.50' },
              detention: { type: 'string', example: '250.00' },
              lost: { type: 'string', example: '250.00' },
            },
          },
        },
        meta_data: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 100 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            search: { type: 'string', example: 'Dhaka', nullable: true },
            filters: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'ALL' },
              },
            },
          },
        },
      },
    },
  })
  @Get()
  getAllStopLogs(
    @Query() query: QueryStopLogDto,
    @GetUser('id') user_id: string,
  ) {
    return this.StopLogService.getAllStopLogs(query, user_id);
  }

  @Get('home-data')
  getHomeData(
    @Query() query: QueryHomeDataDto,
    @GetUser('id') user_id: string,
  ) {
    return this.StopLogService.getHomeData(user_id, query);
  }

  @Get('report')
  getReport(@GetUser('id') user_id: string) {
    return this.StopLogService.getReport(user_id);
  }

  @ApiOperation({ summary: 'Get a single stop log by ID' })
  @ApiResponse({
    status: 200,
    description: 'Stop log fetched successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Stop log fetched successfully' },
        data: {
          oneOf: [
            {
              type: 'object',
              title: 'In Progress Schema',
              description:
                'Response when the log is not yet completed (Before Departure)',
              properties: {
                id: { type: 'string', example: 'cl0a1b2c3d4e5f6g7h8i9j0k' },
                arrived_at: { type: 'string', format: 'date-time' },
                docked_at: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                },
                completed_at: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                },
                departed_at: {
                  type: 'string',
                  format: 'date-time',
                  nullable: true,
                },
                current_step: { type: 'string', example: 'ARRIVAL_TIME' },
              },
            },
            {
              type: 'object',
              title: 'Completed Schema',
              description:
                'Response when the log is completed (Departure recorded)',
              properties: {
                id: { type: 'string', example: 'cl0a1b2c3d4e5f6g7h8i9j0k' },
                rate_per_hour: { type: 'number', example: 100 },
                free_wait_time: { type: 'number', example: 2 },
                billable_time: { type: 'string', example: '2.50' },
                arrival_departure_time: { type: 'string', example: '5.90' },
                address: {
                  type: 'string',
                  example: 'Warehouse A',
                  nullable: true,
                },
                detention: { type: 'string', example: '250.00' },
                lost: { type: 'string', example: '250.00' },
              },
            },
          ],
        },
      },
    },
  })
  @Get(':id')
  getOneStopLog(@Param('id') id: string, @GetUser('id') user_id: string) {
    return this.StopLogService.getOneStopLog(id, user_id);
  }
}
