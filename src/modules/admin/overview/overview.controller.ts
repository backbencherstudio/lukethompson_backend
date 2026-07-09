import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { Roles } from 'src/common/guard/role/roles.decorator';
import { Role } from 'src/common/guard/role/role.enum';
import { OverviewService } from './overview.service';

@ApiTags('Admin Overview')
@ApiBearerAuth('admin_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/overview')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @ApiOperation({ summary: 'Get monthly revenue chart data' })
  @ApiResponse({
    status: 200,
    description: 'Revenue chart data fetched successfully.',
  })
  @Get('revenue-chart')
  getRevenueChart(@Query('year') year?: string) {
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    return this.overviewService.getRevenueChart(targetYear);
  }

  @ApiOperation({ summary: 'Get user count stats by plan' })
  @ApiResponse({
    status: 200,
    description: 'User subscription plan statistics retrieved successfully.',
  })
  @Get('user-plan-stats')
  getUserPlanStats() {
    return this.overviewService.getUserPlanStats();
  }

  @ApiOperation({ summary: 'Get top level statistics summary' })
  @ApiResponse({
    status: 200,
    description: 'Top-level stats summary computed and returned successfully.',
  })
  @Get('stats-summary')
  getStatsSummary() {
    return this.overviewService.getStatsSummary();
  }
}
