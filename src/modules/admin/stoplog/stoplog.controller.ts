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
import { CreateStopLogDto } from './dto/create-stoplog.dto';
import { UpdateStopLogDto } from './dto/update-stoplog.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { PutStopLogDto } from '../../application/stoplog/dto/create-stoplog.dto';

@ApiTags('Admin stoplog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stoplog')
export class StopLogController {
  constructor(private readonly StopLogService: StopLogService) {}

  @ApiOperation({ summary: 'Update or create a stop log step' })
  @ApiResponse({ status: 200, description: 'Step updated successfully' })
  @Put()
  putStopLog(
    @Body() putStopLogDto: PutStopLogDto,
    @GetUser('id') user_id: string,
  ) {
    return this.StopLogService.putStopLogDto(putStopLogDto, user_id);
  }

  @Post()
  create(@Body() createStopLogDto: CreateStopLogDto) {
    return this.StopLogService.create(createStopLogDto);
  }

  @Get()
  findAll() {
    return this.StopLogService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.StopLogService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStopLogDto: UpdateStopLogDto) {
    return this.StopLogService.update(+id, updateStopLogDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.StopLogService.remove(+id);
  }
}



