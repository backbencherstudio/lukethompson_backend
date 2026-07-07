import {
  Controller,
  Get,
  Query,
  UseGuards,
  Body,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
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
import { MarkPaidDto, MarkDeniedDto, SubmitClaimDto } from './dto/update-claim.dto';
import { SendFollowUpDto } from './dto/send-follow-up.dto';
import {
  ClaimListResponseDto,
  ClaimActionResponseDto,
} from './dto/response-claim.dto';

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
    type: ClaimListResponseDto,
  })
  @Get()
  getAllClaims(@Query() query: QueryClaimDto, @GetUser('id') user_id: string) {
    return this.claimService.getAllClaims(query, user_id);
  }

  @ApiOperation({
    summary: 'Mark a claim as paid',
    description:
      'Allows marking a claim as paid and specifying the paid amount.',
  })
  @ApiBody({ type: MarkPaidDto })
  @ApiResponse({
    status: 200,
    description: 'Claim marked as paid successfully',
    type: ClaimActionResponseDto,
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
    description:
      'Allows marking a claim as denied and specifying denial details.',
  })
  @ApiBody({ type: MarkDeniedDto })
  @ApiResponse({
    status: 200,
    description: 'Claim marked as denied successfully',
    type: ClaimActionResponseDto,
  })
  @Patch(':id/mark-denied')
  markDenied(
    @Param('id') id: string,
    @Body() dto: MarkDeniedDto,
    @GetUser('id') user_id: string,
  ) {
    return this.claimService.markDenied(id, dto, user_id);
  }

  @ApiOperation({
    summary: 'Send claim follow-up email',
    description:
      'Triggers manual sending of the selected follow-up template. Validates downgrade restrictions and updates claim status and timeline.',
  })
  @ApiBody({ type: SendFollowUpDto })
  @ApiResponse({
    status: 200,
    description: 'Follow-up email queued successfully',
    type: ClaimActionResponseDto,
  })
  @Post(':id/follow-up')
  sendFollowUp(
    @Param('id') id: string,
    @Body() dto: SendFollowUpDto,
    @GetUser('id') user_id: string,
  ) {
    return this.claimService.sendFollowUp(id, dto, user_id);
  }

  @ApiOperation({
    summary: 'Submit a claim',
    description:
      'Submits a claim via EMAIL (sends notification to recipient and CCs broker, attaching detention summary PDF) or via MESSAGE (returns formatted message content). Validates that the recipient email exists in the system.',
  })
  @ApiBody({ type: SubmitClaimDto })
  @ApiResponse({
    status: 200,
    description: 'Claim submitted successfully',
  })
  @Post(':id/submit')
  submitClaim(
    @Param('id') id: string,
    @Body() dto: SubmitClaimDto,
    @GetUser('id') user_id: string,
  ) {
    return this.claimService.submitClaim(id, dto, user_id);
  }
}
