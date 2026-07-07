import { Controller, Get, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guard/role/roles.guard';
import { Request } from 'express';

@ApiBearerAuth('user_token')
@ApiTags('Notification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller(['notification', 'admin/notification'])
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({ summary: 'Get all notifications' })
  @ApiResponse({
    status: 200,
    description: 'List of notifications retrieved successfully.',
  })
  @Get()
  async findAll(@Req() req: Request) {
    try {
      const user_id = req.user.id;
      const notifications = await this.notificationService.findAll(user_id);
      return notifications;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Delete notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully.',
  })
  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    try {
      const user_id = req.user.id;
      const result = await this.notificationService.remove(id, user_id);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Delete all notifications' })
  @ApiResponse({
    status: 200,
    description: 'All notifications cleared successfully.',
  })
  @Delete()
  async removeAll(@Req() req: Request) {
    try {
      const user_id = req.user.id;
      const result = await this.notificationService.removeAll(user_id);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
