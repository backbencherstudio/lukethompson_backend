import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ShipperService } from './shipper.service';
import { QueryShipperDto } from './dto/query-shipper.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import {
  ShipperRatingsResponseDto,
  ShipperRatingDetailsResponseDto,
} from './dto/response-shipper.dto';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Application shipper')
@ApiBearerAuth('user_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shippers')
export class ShipperController {
  constructor(private readonly shipperService: ShipperService) {}

  @ApiOperation({
    summary: 'Get all shippers and facilities with ratings',
    description:
      'Retrieves all shipper facilities in the network with aggregated payment and rating statistics, categorized tabs (All, Good Payers, Average, Poor Payers) and search.',
  })
  @ApiResponse({
    status: 200,
    description: 'Shipper ratings fetched successfully',
    type: ShipperRatingsResponseDto,
  })
  @Get('ratings')
  getAllShippers(@Query() query: QueryShipperDto) {
    return this.shipperService.getAllShippers(query);
  }

  @ApiOperation({
    summary: 'Get single shipper rating details',
    description:
      'Retrieves detailed ratings and payment statistics for a single shipper facility by its ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'Shipper rating details fetched successfully',
    type: ShipperRatingDetailsResponseDto,
  })
  @Get('ratings/:rating_id')
  getOneShipper(@Param('rating_id') rating_id: string) {
    return this.shipperService.getOneShipper(rating_id);
  }
}
