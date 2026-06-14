import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ShipperService } from './shipper.service';
import { QueryShipperDto } from './dto/query-shipper.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
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
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Shipper ratings fetched successfully',
        },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'shipper_id_1' },
              facility_name: {
                type: 'string',
                example: 'Walmart DC - Memphis',
              },
              rating: { type: 'number', example: 84 },
              status_subtext: {
                type: 'string',
                example: 'Known good payer • Avg. 5 days to pay',
              },
              claims_count: { type: 'number', example: 127 },
              avg_pay_days: { type: 'number', example: 5, nullable: true },
              paid_claims_count: { type: 'number', example: 107 },
            },
          },
        },
        meta_data: {
          type: 'object',
          properties: {
            next_cursor: {
              type: 'string',
              example: 'shipper_id_10',
              nullable: true,
            },
            limit: { type: 'number', example: 10 },
            search: { type: 'string', example: 'Walmart', nullable: true },
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
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Shipper rating details fetched successfully',
        },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'shipper_id_1' },
            facility_name: { type: 'string', example: 'Walmart DC - Memphis' },
            rating: { type: 'number', example: 84 },
            total_claims_submitted: { type: 'number', example: 127 },
            avg_pay_days: { type: 'number', example: 5, nullable: true },
            total_paid: { type: 'number', example: 107 },
            total_denied: { type: 'number', example: 20 },
          },
        },
      },
    },
  })
  @Get('ratings/:rating_id')
  getOneShipper(@Param('rating_id') rating_id: string) {
    return this.shipperService.getOneShipper(rating_id);
  }
}
