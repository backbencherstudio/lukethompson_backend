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

  @ApiOperation({ summary: 'Get all stop logs for a specific user' })
  @ApiResponse({
    status: 200,
    description: 'User stop logs fetched successfully',
  })
  @Get('user/:user_id')
  findAllByUser(
    @Param('user_id') user_id: string,
    @Query() query: QueryStopLogDto,
  ) {
    return this.stopLogService.findAllByUser(user_id, query);
  }

  @Post()
  create(@Body() createStopLogDto: CreateStopLogDto) {
    return this.stopLogService.create(createStopLogDto);
  }

  @Get()
  findAll() {
    return this.stopLogService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stopLogService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStopLogDto: UpdateStopLogDto) {
    return this.stopLogService.update(+id, updateStopLogDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stopLogService.remove(+id);
  }
}
