import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseHelper } from 'src/common/helper/response.helper';

@Injectable()
export class SettingService {
  constructor(private readonly prisma: PrismaService) {}

  private async toggleSetting(user_id: string, key: string) {
    // 1. Ensure the setting exists in the global 'Setting' table
    let setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    // If it doesn't exist, create it as a global config first
    if (!setting) {
      setting = await this.prisma.setting.create({
        data: {
          key,
          label: key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          category: 'notification',
          default_value: 'true',
        },
      });
    }

    // 2. Find the user's current value in 'UserSetting'
    const userSetting = await this.prisma.userSetting.findFirst({
      where: {
        user_id,
        setting_id: setting.id,
      },
    });

    const currentValue = userSetting ? userSetting.value === 'true' : true; // default to true if not set
    const newValue = !currentValue;

    if (userSetting) {
      await this.prisma.userSetting.update({
        where: { id: userSetting.id },
        data: { value: String(newValue) },
      });
    } else {
      await this.prisma.userSetting.create({
        data: {
          user_id,
          setting_id: setting.id,
          value: String(newValue),
        },
      });
    }

    return newValue;
  }

  async toggleSubscriptionNotification(user_id: string) {
    const status = await this.toggleSetting(
      user_id,
      'subscription_notification',
    );
    return ResponseHelper.success({
      message: `Subscription notification turned ${status ? 'ON' : 'OFF'}`,
      data: { status },
    });
  }

  async toggleEmailNotification(user_id: string) {
    const status = await this.toggleSetting(user_id, 'email_notification');
    return ResponseHelper.success({
      message: `Email notification turned ${status ? 'ON' : 'OFF'}`,
      data: { status },
    });
  }

  async getSettings(user_id: string) {
    const settings = await this.prisma.setting.findMany({
      where: { category: 'notification' },
      include: {
        user_settings: {
          where: { user_id },
        },
      },
    });

    const formatted = settings.map((s) => ({
      key: s.key,
      label: s.label,
      value:
        s.user_settings[0]?.value === 'true' ||
        (s.user_settings.length === 0 && s.default_value === 'true'),
    }));

    return ResponseHelper.success({
      message: 'Settings fetched successfully',
      data: formatted,
    });
  }
}
