import {
  Controller,
  Get,
  Query,
  UseGuards,
  Delete,
  Param,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Role } from '../../../common/guard/role/role.enum';
import { ShipperService } from './shipper.service';
import { QueryShipperRatingDto } from './dto/query-shipper.dto';
import {
  AdminShipperRatingListResponseDto,
  AdminShipperStatsResponseDto,
  AdminShipperRatingDeleteResponseDto,
} from './dto/response-shipper.dto';

@ApiBearerAuth('admin_token')
@ApiTags('Admin Shipper')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/shipper')
export class ShipperController {
  constructor(private readonly shipperService: ShipperService) {}

  @ApiOperation({
    summary: 'Get all shipper ratings with search and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'List of shipper ratings retrieved successfully.',
    type: AdminShipperRatingListResponseDto,
  })
  @Get('ratings')
  async getRatings(@Query() query: QueryShipperRatingDto) {
    return this.shipperService.getRatings(query);
  }

  @ApiOperation({ summary: 'Get shipper statistics' })
  @ApiResponse({
    status: 200,
    description: 'Shipper statistics retrieved successfully.',
    type: AdminShipperStatsResponseDto,
  })
  @Get('stats')
  async getStats() {
    return this.shipperService.getStats();
  }

  @ApiOperation({ summary: 'Delete a shipper rating' })
  @ApiResponse({
    status: 200,
    description: 'Shipper rating deleted successfully.',
    type: AdminShipperRatingDeleteResponseDto,
  })
  @Delete('ratings/:id')
  async deleteRating(@Param('id') id: string) {
    return this.shipperService.deleteRating(id);
  }
}
