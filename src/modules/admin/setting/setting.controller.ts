import { Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';
import { GetUser } from 'src/modules/auth/decorators/get-user.decorator';
import { SettingService } from './setting.service';

@ApiTags('Admin Setting')
@ApiBearerAuth('admin_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/setting')
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  @ApiOperation({ summary: 'Get all notification settings' })
  @Get()
  getSettings(@GetUser('id') user_id: string) {
    return this.settingService.getSettings(user_id);
  }

  @ApiOperation({ summary: 'Toggle subscription notification' })
  @Patch('toggle-subscription')
  toggleSubscriptionNotification(@GetUser('id') user_id: string) {
    return this.settingService.toggleSubscriptionNotification(user_id);
  }

  @ApiOperation({ summary: 'Toggle email notification' })
  @Patch('toggle-email')
  toggleEmailNotification(@GetUser('id') user_id: string) {
    return this.settingService.toggleEmailNotification(user_id);
  }
}
