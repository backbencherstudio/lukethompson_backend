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
import { SpotlogService } from './spotlog.service';
import { CreateSpotlogDto } from './dto/create-spotlog.dto';
import { UpdateSpotlogDto } from './dto/update-spotlog.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { PutSpotLogDto } from '../../application/spotlog/dto/create-spotlog.dto';

@ApiTags('Admin Spotlog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('spotlog')
export class SpotlogController {
  constructor(private readonly spotlogService: SpotlogService) {}

  @ApiOperation({ summary: 'Update or create a spot log step' })
  @ApiResponse({ status: 200, description: 'Step updated successfully' })
  @Put()
  putSpotLog(
    @Body() putSpotLogDto: PutSpotLogDto,
    @GetUser('id') user_id: string,
  ) {
    return this.spotlogService.putSpotLogDto(putSpotLogDto, user_id);
  }

  @Post()
  create(@Body() createSpotlogDto: CreateSpotlogDto) {
    return this.spotlogService.create(createSpotlogDto);
  }

  @Get()
  findAll() {
    return this.spotlogService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.spotlogService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSpotlogDto: UpdateSpotlogDto) {
    return this.spotlogService.update(+id, updateSpotlogDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.spotlogService.remove(+id);
  }
}
