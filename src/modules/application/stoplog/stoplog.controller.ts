import {
  Controller,
  Get,
  Body,
  Param,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Patch,
} from '@nestjs/common';
import { StopLogService } from './stoplog.service';
import { PutStopLogDto } from './dto/create-stoplog.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
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
import {
  StopLogStepResponseDto,
  StopLogListResponseDto,
  StopLogHomeResponseDto,
  StopLogReportResponseDto,
  StopLogDetailResponseDto,
  StopLogActiveResponseDto,
} from './dto/response-stoplog.dto';
import { UpdateStopLogDto } from './dto/update-stoplog.dto';

@ApiTags('Application stoplog')
@ApiBearerAuth('user_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stoplog')
export class StopLogController {
  constructor(private readonly StopLogService: StopLogService) {}

  @ApiOperation({
    summary: 'Record or update a stop log step',
    description:
      'Drives the stop log state machine chronologically: arrival_time -> dock_in_time -> completed_time -> departure_time.\n\n' +
      '**Validation Rules:**\n' +
      '- `bol_number` and `attachments` can ONLY be provided during the `departure_time` step or after the stop log has already departed.\n' +
      '- Providing `attachments` or `bol_number` in any other step will result in a `400 Bad Request` error.\n' +
      '- At least one attachment is **mandatory** during or after departure (the request must contain a new attachment or the log must have an existing one). The `bol_number` is optional.\n\n' +
      '**Claim Generation:**\n' +
      "- Once the stop log is completed (departed) and has at least one attachment, a draft claim (`DRAFT`) is automatically generated/updated based on the waiting hours (total waiting time minus the driver's free wait time) and the driver's hourly rate.",
  })
  @ApiResponse({
    status: 200,
    description: 'Step recorded successfully',
    type: StopLogStepResponseDto,
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
    type: StopLogListResponseDto,
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
    type: StopLogHomeResponseDto,
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
    type: StopLogReportResponseDto,
  })
  @Get('report')
  getReport(@Query() query: QueryReportDto, @GetUser('id') user_id: string) {
    return this.StopLogService.getReport(user_id, query);
  }

  @ApiOperation({
    summary: 'Get active stop log ID',
    description:
      'Retrieves the ID of the currently active stop log for the authenticated driver.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active stop log fetched successfully',
    type: StopLogActiveResponseDto,
  })
  @Get('active')
  getActiveStopLog(@GetUser('id') user_id: string) {
    return this.StopLogService.getActiveStopLog(user_id);
  }

  @ApiOperation({
    summary: 'Get single stop log by ID',
    description:
      'Retrieves details for a specific stop log by ID. Dynamically returns either the in-progress schema (if departure is not yet recorded) or the completed schema (with billable time, detention earnings, and lost revenue calculated).',
  })
  @ApiResponse({
    status: 200,
    description: 'Stop log fetched successfully',
    type: StopLogDetailResponseDto,
  })
  @Get(':id')
  getOneStopLog(@Param('id') id: string, @GetUser('id') user_id: string) {
    return this.StopLogService.getOneStopLog(id, user_id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a stop log',
    description:
      'Updates a stop log based on the selected step. Supports arrival, dock-in, completed, departure, and document upload steps.',
  })
  @ApiParam({
    name: 'id',
    description: 'Stop log ID',
    example: 'cl0a1b2c3d4e5f6g7h8i9j0k',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        step: {
          type: 'string',
          enum: [
            'arrival_time',
            'dock_in_time',
            'completed_time',
            'departure_time',
            'upload_documents',
          ],
          example: 'dock_in_time',
        },
        shipper_id: {
          type: 'string',
          example: 'cmabc123shipper',
        },
        facility_name: {
          type: 'string',
          example: 'Acme Warehouse',
        },
        bol_number: {
          type: 'string',
          example: 'BOL-123456789',
        },
        location: {
          type: 'string',
          example: JSON.stringify({
            city: 'New York',
            state: 'NY',
            country: 'US',
            address: '123 Warehouse Street',
            zip: '10001',
            lat: 40.7128,
            lng: -74.006,
          }),
          description: 'JSON string containing location information',
        },
        attachments: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['step'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Stop log updated successfully',
    type: StopLogDetailResponseDto,
  })
  async updateStopLog(
    @Param('id') id: string,
    @GetUser('id') user_id: string,
    @Body() dto: UpdateStopLogDto,
    @UploadedFiles() attachments: Express.Multer.File[],
  ) {
    return this.StopLogService.updateStopLog(id, user_id, dto, attachments);
  }
}
