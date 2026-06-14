import { Controller, Get, Query, UseGuards, Body, Param, Patch } from '@nestjs/common';
import { ClaimService } from './claim.service';
import { QueryClaimDto } from './dto/query-claim.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MarkPaidDto, MarkDeniedDto } from './dto/update-claim.dto';

@ApiTags('Application claim')
@ApiBearerAuth('user_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('claim')
export class ClaimController {
  constructor(private readonly claimService: ClaimService) {}

  @ApiOperation({
    summary: 'Get all claims with pagination and search',
    description:
      'Retrieves all claims for the authenticated driver with cursor pagination. Returns formatted claim card details in snake_case and counts/stats in metadata.',
  })
  @ApiResponse({
    status: 200,
    description: 'Claims fetched successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Claims fetched successfully' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'claim_id_1' },
              facility_name: { type: 'string', example: 'Walmart DC Shelbyville' },
              date: { type: 'string', format: 'date-time' },
              amount: { type: 'number', example: 135 },
              status: { type: 'string', example: 'PAID' },
            },
          },
        },
        meta_data: {
          type: 'object',
          properties: {
            next_cursor: { type: 'string', example: 'claim_id_10', nullable: true },
            limit: { type: 'number', example: 10 },
            search: { type: 'string', example: 'Walmart', nullable: true },
            filters: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'ALL' },
              },
            },
            counts: {
              type: 'object',
              properties: {
                all: { type: 'number', example: 12 },
                draft: { type: 'number', example: 2 },
                submitted: { type: 'number', example: 4 },
                paid: { type: 'number', example: 6 },
                denied: { type: 'number', example: 0 },
              },
            },
            stats: {
              type: 'object',
              properties: {
                pending_claims_amount: { type: 'string', example: '1240.00' },
                settled_this_week_amount: { type: 'string', example: '4892.00' },
              },
            },
          },
        },
      },
    },
  })
  @Get()
  getAllClaims(
    @Query() query: QueryClaimDto,
    @GetUser('id') user_id: string,
  ) {
    return this.claimService.getAllClaims(query, user_id);
  }

  @ApiOperation({
    summary: 'Mark a claim as paid',
    description: 'Allows marking a claim as paid and specifying the paid amount.',
  })
  @ApiBody({ type: MarkPaidDto })
  @ApiResponse({
    status: 200,
    description: 'Claim marked as paid successfully',
  })
  @Patch(':id/mark-paid')
  markPaid(
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
    @GetUser('id') user_id: string,
  ) {
    return this.claimService.markPaid(id, dto, user_id);
  }

  @ApiOperation({
    summary: 'Mark a claim as denied / uncollectable',
    description: 'Allows marking a claim as denied and specifying denial details.',
  })
  @ApiBody({ type: MarkDeniedDto })
  @ApiResponse({
    status: 200,
    description: 'Claim marked as denied successfully',
  })
  @Patch(':id/mark-denied')
  markDenied(
    @Param('id') id: string,
    @Body() dto: MarkDeniedDto,
    @GetUser('id') user_id: string,
  ) {
    return this.claimService.markDenied(id, dto, user_id);
  }
}
