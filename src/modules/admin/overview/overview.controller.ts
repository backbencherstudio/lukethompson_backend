import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @Get('revenue-chart')
  getRevenueChart(@Query('year') year?: string) {
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    return this.overviewService.getRevenueChart(targetYear);
  }

  @ApiOperation({ summary: 'Get user count stats by plan' })
  @Get('user-plan-stats')
  getUserPlanStats() {
    return this.overviewService.getUserPlanStats();
  }

  @ApiOperation({ summary: 'Get top level statistics summary' })
  @Get('stats-summary')
  getStatsSummary() {
    return this.overviewService.getStatsSummary();
  }
}
