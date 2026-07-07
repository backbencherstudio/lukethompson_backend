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
import { AdminStopLogListResponseDto } from './dto/response-stoplog.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { AdminQueryStopLogDto } from './dto/query-stoplog.dto';

@ApiTags('Admin stoplog')
@ApiBearerAuth('admin_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/stoplog')
export class StopLogController {
  constructor(private readonly stopLogService: StopLogService) {}

  @ApiOperation({
    summary: 'Get all stop logs for a specific user',
    description:
      'Allows administrative users to retrieve all stop logs belonging to a specific user (driver) by their user ID. Supports page and limit pagination and text search filtering.',
  })
  @ApiResponse({
    status: 200,
    description: 'User stop logs fetched successfully',
    type: AdminStopLogListResponseDto,
  })
  @Get('user/:user_id')
  findAllByUser(
    @Param('user_id') user_id: string,
    @Query() query: AdminQueryStopLogDto,
  ) {
    return this.stopLogService.findAllByUser(user_id, query);
  }
}
