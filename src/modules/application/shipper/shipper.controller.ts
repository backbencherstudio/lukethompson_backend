import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Param,
  Body,
} from '@nestjs/common';
import { ShipperService } from './shipper.service';
import { QueryShipperDto, SearchShipperDto } from './dto/query-shipper.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import {
  ShipperRatingsResponseDto,
  ShipperRatingDetailsResponseDto,
  ShipperSearchResponseDto,
  ShipperCreateRatingResponseDto,
} from './dto/response-shipper.dto';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateShipperRatingDto } from './dto/create-shipper.dto';

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
    summary: 'Search shipper facilities',
    description:
      'Retrieves a list of matching shipper facilities containing ID, name, and address by searching on name or address.',
  })
  @ApiResponse({
    status: 200,
    description: 'Shipper facilities searched successfully',
    type: ShipperSearchResponseDto,
  })
  @Get('search')
  searchShippers(@Query() query: SearchShipperDto) {
    return this.shipperService.searchShippers(query);
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

  @ApiOperation({
    summary: 'Submit a rating for a shipper facility',
    description:
      'Creates a rating (0-100) for a shipper facility associated with a specific stop log. Each stop log can only be rated once.',
  })
  @ApiResponse({
    status: 201,
    description: 'Rating submitted successfully',
    type: ShipperCreateRatingResponseDto,
  })
  @Post('ratings/:stop_log_id')
  createRating(
    @Param('stop_log_id') stop_log_id: string,
    @GetUser('id') user_id: string,
    @Body() createShipperRatingDto: CreateShipperRatingDto,
  ) {
    return this.shipperService.createRating(
      stop_log_id,
      user_id,
      createShipperRatingDto,
    );
  }
}
