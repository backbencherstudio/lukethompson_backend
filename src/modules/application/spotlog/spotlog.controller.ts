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
import { UpdateSpotlogDto } from './dto/update-spotlog.dto';
import { PutSpotLogDto } from './dto/create-spotlog.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QuerySpotLogDto } from './dto/query-spotlog.dto';
import { Query } from '@nestjs/common';

@ApiTags('Application Spotlog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('spotlog')
export class SpotlogController {
  constructor(private readonly spotlogService: SpotlogService) {}

  @ApiOperation({
    summary: 'Update or create a spot log step (Arrival, Dock, etc.)',
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
  putSpotLog(
    @Body() putSpotLogDto: PutSpotLogDto,
    @GetUser('id') user_id: string,
  ) {
    return this.spotlogService.putSpotLogDto(putSpotLogDto, user_id);
  }

  @ApiOperation({ summary: 'Get all spot logs for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'List of spot logs fetched successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Spot logs fetched successfully' },
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
  getAllSpotLogs(
    @Query() query: QuerySpotLogDto,
    @GetUser('id') user_id: string,
  ) {
    return this.spotlogService.getAllSpotLogs(query, user_id);
  }

  @Get(':id')
  getOneSpotLog(@Param('id') id: string, @GetUser('id') user_id: string) {
    return this.spotlogService.getOneSpotLog(id, user_id);
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
