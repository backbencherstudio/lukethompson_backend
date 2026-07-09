import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRepository } from '../../common/repository/user/user.repository';
import { NajimStorage } from '../../common/lib/Disk/NajimStorage';
import appConfig from '../../config/app.config';
import { Role } from '../../common/guard/role/role.enum';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    return 'This action adds a new notification';
  }

  async findOne(id: string) {
    return `This action returns a #${id} notification`;
  }

  async update(id: string, updateNotificationDto: UpdateNotificationDto) {
    return `This action updates a #${id} notification`;
  }

  async findAll(user_id: string) {
    try {
      const where_condition = {};
      const userDetails = await this.userRepository.getUserDetails(user_id);

      if (!userDetails) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      if (
        userDetails.type === Role.ADMIN ||
        userDetails.type === Role.SU_ADMIN
      ) {
        where_condition['OR'] = [
          { receiver_id: { equals: user_id } },
          { receiver_id: { equals: null } },
        ];
      } else {
        where_condition['receiver_id'] = user_id;
      }

      const notifications = await this.prisma.notification.findMany({
        where: where_condition,
        select: {
          id: true,
          sender_id: true,
          receiver_id: true,
          entity_id: true,
          created_at: true,
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          notification_event: {
            select: {
              id: true,
              type: true,
              text: true,
            },
          },
        },
      });

      // add url to avatar
      if (notifications.length > 0) {
        for (const notification of notifications) {
          if (notification.sender && notification.sender.avatar) {
            notification.sender['avatar_url'] = NajimStorage.url(
              appConfig().storageUrl.avatar + notification.sender.avatar,
              { signed: true },
            );
          }

          if (notification.receiver && notification.receiver.avatar) {
            notification.receiver['avatar_url'] = NajimStorage.url(
              appConfig().storageUrl.avatar + notification.receiver.avatar,
              { signed: true },
            );
          }
        }
      }

      return {
        success: true,
        data: notifications,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string, user_id?: string) {
    try {
      const notification = await this.prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      if (user_id) {
        const userDetails = await this.userRepository.getUserDetails(user_id);
        if (
          userDetails &&
          userDetails.type !== Role.ADMIN &&
          userDetails.type !== Role.SU_ADMIN &&
          notification.receiver_id !== user_id
        ) {
          return {
            success: false,
            message: 'Unauthorized to delete this notification',
          };
        }
      }

      await this.prisma.notification.delete({
        where: { id },
      });

      return {
        success: true,
        message: 'Notification deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async removeAll(user_id: string) {
    try {
      const userDetails = await this.userRepository.getUserDetails(user_id);
      if (!userDetails) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      const where_condition = {};
      if (
        userDetails.type === Role.ADMIN ||
        userDetails.type === Role.SU_ADMIN
      ) {
        where_condition['OR'] = [
          { receiver_id: { equals: user_id } },
          { receiver_id: { equals: null } },
        ];
      } else {
        where_condition['receiver_id'] = user_id;
      }

      const notifications = await this.prisma.notification.findMany({
        where: where_condition,
      });

      if (notifications.length === 0) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      await this.prisma.notification.deleteMany({
        where: where_condition,
      });

      return {
        success: true,
        message: 'All notifications deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
