import {
  Controller,
  Get,
  Body,
  Param,
  Put,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
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
} from './dto/response-stoplog.dto';

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
}
