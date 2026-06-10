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
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { StopLogService } from './stoplog.service';
import { UpdateStopLogDto } from './dto/update-stoplog.dto';
import { PutStopLogDto } from './dto/create-stoplog.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  QueryHomeDataDto,
  QueryReportDto,
  QueryStopLogDto,
} from './dto/query-stoplog.dto';
import { Query } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@ApiTags('Application stoplog')
@ApiBearerAuth('user_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stoplog')
export class StopLogController {
  constructor(private readonly StopLogService: StopLogService) {}

  @ApiOperation({
    summary: 'Record or update a stop log step',
    description:
      'Drives the stop log state machine by recording steps chronologically: arrival_time, dock_in_time, completed_time, and departure_time. Supports uploading up to 10 files as attachments (stored in cloud storage like AWS S3 or MinIO). Dynamically creates/updates shipper facility data. Requires a valid JWT token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Step recorded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Stop log step recorded successfully',
        },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cl0a1b2c3d4e5f6g7h8i9j0k' },
            shipper_facility_id: {
              type: 'string',
              example: 'cl0a1b2c3d4e5f6g7h8i9j1k',
            },
            shipper_id: {
              type: 'string',
              example: 'cl0a1b2c3d4e5f6g7h8i9j1k',
            },
            shipper_name: { type: 'string', example: 'Acme Warehouse' },
            facility_name: { type: 'string', example: 'Acme Warehouse' },
            bol_number: {
              type: 'string',
              example: 'BOL-12345',
              nullable: true,
            },
            status: { type: 'string', example: 'ACTIVE' },
            arrived_at: { type: 'string', format: 'date-time' },
            docked_at: { type: 'string', format: 'date-time', nullable: true },
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
            arrival_location: { type: 'object', nullable: true },
            facility_address: { type: 'object', nullable: true },
            attachments: { type: 'array', items: { type: 'object' } },
            current_step: { type: 'string', example: 'arrival_time' },
          },
        },
      },
    },
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: PutStopLogDto })
  @UseInterceptors(
    FilesInterceptor('attachments', 10, {
      storage: memoryStorage(),
    }),
  )
  @Put()
  putStopLog(
    @Body() putStopLogDto: PutStopLogDto,
    @UploadedFiles() attachments: Express.Multer.File[],
    @GetUser('id') user_id: string,
  ) {
    putStopLogDto.attachments = attachments;
    return this.StopLogService.putStopLog(putStopLogDto, user_id);
  }

  @ApiOperation({
    summary: 'Get all stop logs with pagination and search',
    description:
      'Retrieves a list of stop logs for the currently authenticated driver. Supports cursor-based pagination, text searching by address/city, and filtering by status (ALL, PROGRESS, COMPLETED).',
  })
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
              facility_name: {
                type: 'string',
                example: 'Acme Warehouse',
              },
              shipper_facility_id: {
                type: 'string',
                example: 'cl0a1b2c3d4e5f6g7h8i9j1k',
                nullable: true,
              },
              date: { type: 'string', format: 'date-time' },
              amount: { type: 'string', example: '250.00' },
              status: {
                type: 'string',
                enum: ['COMPLETED', 'PROGRESS'],
                example: 'COMPLETED',
              },
            },
          },
        },
        meta_data: {
          type: 'object',
          properties: {
            next_cursor: {
              type: 'string',
              example: 'cl0a1b2c3d4e5f6g7h8i9j0k',
              nullable: true,
            },
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

  @ApiOperation({
    summary: 'Get driver dashboard metrics',
    description:
      'Aggregates key statistics for the driver home screen, including total detention earnings, total lost revenue, stops count, total hours, average waiting time per stop, collection rate, and weekly activity chart dataset. Filterable by period (TODAY, WEEK, MONTH, YEAR).',
  })
  @ApiResponse({
    status: 200,
    description: 'Home data fetched successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Home data fetched successfully' },
        data: {
          type: 'object',
          properties: {
            total_detention: { type: 'string', example: '225.00' },
            total_lost: { type: 'string', example: '225.00' },
            total_stops: { type: 'number', example: 6 },
            claimed_stops: { type: 'number', example: 3 },
            total_hours: { type: 'string', example: '14.50' },
            avg_hours_per_stop: { type: 'string', example: '2.42' },
            avg_hours_per_stop_text: { type: 'string', example: '2h 25m' },
            collection_rate: { type: 'string', example: '68.00' },
            collection_rate_change: { type: 'string', example: '12.00' },
            weekly_activity: {
              type: 'object',
              properties: {
                total_stops: { type: 'number', example: 10 },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      day: { type: 'string', example: 'Mon' },
                      total_stops: { type: 'number', example: 2 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @Get('home-data')
  getHomeData(
    @Query() query: QueryHomeDataDto,
    @GetUser('id') user_id: string,
  ) {
    return this.StopLogService.getHomeData(user_id, query);
  }

  @ApiOperation({
    summary: 'Get weekly summary or tax reports',
    description:
      'Fetches structured reports for the driver. Supports two report modes via query tabs: WEEKLY_SUMMARY (shows waiting hours, detention captured, revenue lost, and worst stop facility) or TAX_REPORT (shows claimed/collected amounts, collection rate, avg days to pay, and monthly revenue realization chart).',
  })
  @ApiResponse({
    status: 200,
    description: 'Report tab data fetched successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Weekly summary fetched successfully',
        },
        data: {
          oneOf: [
            {
              type: 'object',
              title: 'Weekly Summary Response',
              properties: {
                tab: { type: 'string', example: 'WEEKLY_SUMMARY' },
                total_waiting_hours: { type: 'string', example: '14.50' },
                total_waiting_text: { type: 'string', example: '14h 30m' },
                detention_captured: { type: 'string', example: '225.00' },
                revenue_lost: { type: 'string', example: '25.00' },
                top_worst_stop: {
                  type: 'object',
                  properties: {
                    facility_name: {
                      type: 'string',
                      example: 'Cold Storage Solutions',
                      nullable: true,
                    },
                    waiting_hours: { type: 'string', example: '3.00' },
                    waiting_time_text: { type: 'string', example: '3h 0m' },
                  },
                },
              },
            },
            {
              type: 'object',
              title: 'Tax Report Response',
              properties: {
                tab: { type: 'string', example: 'TAX_REPORT' },
                period: {
                  type: 'string',
                  enum: ['MONTHLY', 'YEARLY'],
                  example: 'MONTHLY',
                },
                date_range: {
                  type: 'object',
                  properties: {
                    start: { type: 'string', format: 'date-time' },
                    end: { type: 'string', format: 'date-time' },
                  },
                },
                total_claimed: { type: 'string', example: '600.00' },
                total_collected: { type: 'string', example: '225.00' },
                collection_rate: { type: 'string', example: '45.00' },
                avg_days_to_pay: { type: 'string', example: '25.00' },
                avg_days_to_pay_text: { type: 'string', example: '25 days' },
                revenue_lost: { type: 'string', example: '375.00' },
                revenue_realization: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      label: { type: 'string', example: 'Jan' },
                      claimed: { type: 'string', example: '400.00' },
                      collected: { type: 'string', example: '325.00' },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  })
  @Get('report')
  getReport(@Query() query: QueryReportDto, @GetUser('id') user_id: string) {
    return this.StopLogService.getReport(user_id, query);
  }

  @ApiOperation({
    summary: 'Get single stop log by ID',
    description:
      'Retrieves details for a specific stop log by ID. Dynamically returns either the in-progress schema (if departure is not yet recorded) or the completed schema (with billable time, detention earnings, and lost revenue calculated).',
  })
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
                current_step: { type: 'string', example: 'arrival_time' },
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
