import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import appConfig from '../../../config/app.config';
import { NajimStorage } from '../../../common/lib/Disk/NajimStorage';
import { DateHelper } from '../../../common/helper/date.helper';
import { QueryUserDto } from './dto/query-user.dto';
import { Prisma } from 'prisma/generated/browser';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const user = await this.userRepository.createUser(createUserDto);

    return {
      success: true,
      message: 'User created successfully',
      data: user,
    };
  }

  async findAll(query: QueryUserDto) {
    const { search, page = 1, limit = 10, type, status } = query;
    const skip = (page - 1) * limit;
    const where_condition: Prisma.UserWhereInput = {
      ...(type !== undefined && { type }),
      ...(status !== undefined && { status }),
    };

    if (search) {
      where_condition.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where: where_condition }),
      this.prisma.user.findMany({
        where: where_condition,
        skip: Number(skip),
        take: Number(limit),
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          phone_number: true,
          status: true,
          created_at: true,
          _count: {
            select: { stop_logs: true },
          },
        },
      }),
    ]);

    const formattedUsers = users.map((user) => {
      let statusLabel = 'Active';
      if (user.status === 0) statusLabel = 'Pending';
      if (user.status === -1) statusLabel = 'Banned';

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        phone_number: user.phone_number,
        subscription_plan: 'Free Plan', // Defaulting to Free Plan as no specific plan model found
        total_stops: user._count.stop_logs,
        created_at: user.created_at,
        status: statusLabel,
      };
    });

    return {
      success: true,
      data: formattedUsers,
      meta_data: {
        total,
        page: Number(page),
        limit: Number(limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        phone_number: true,
        approved_at: true,
        created_at: true,
        avatar: true,
      },
    });

    // add avatar url to user
    if (user?.avatar) {
      user.avatar = NajimStorage.url(
        appConfig().storageUrl.avatar + user.avatar,
        { signed: true },
      );
    }

    if (!user) {
      throw new InternalServerErrorException('Failed to fetch user details.');
    }

    return {
      success: true,
      message: 'User details fetched successfully',
      data: user,
    };
  }

  async approve(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      await this.prisma.user.update({
        where: { id: id },
        data: { approved_at: DateHelper.now() },
      });
      return {
        success: true,
        message: 'User approved successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async reject(id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }
      await this.prisma.user.update({
        where: { id: id },
        data: { approved_at: null },
      });
      return {
        success: true,
        message: 'User rejected successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.updateUser(id, updateUserDto);

    if (user.success) {
      return {
        success: user.success,
        message: user.message,
      };
    } else {
      throw new InternalServerErrorException(user.message);
    }
  }

  async remove(id: string) {
    const user = await this.userRepository.deleteUser(id);
    if (user.success) {
      return {
        success: user.success,
        message: user.message,
      };
    } else {
      throw new InternalServerErrorException(user.message);
    }
  }

  async bannedUser(user_id: string) {
    const user = await this.prisma.user.update({
      where: {
        id: user_id,
      },
      data: {
        status: -1,
      },
    });
    if (!user)
      throw new InternalServerErrorException('Failed to update user status.');
    return {
      success: true,
      message: 'User banned successfully',
    };
  }

  async unBanUser(user_id: string) {
    const user = await this.prisma.user.update({
      where: {
        id: user_id,
      },
      data: {
        status: 1,
      },
    });
    if (!user)
      throw new InternalServerErrorException('Failed to update user status.');
    return {
      success: true,
      message: 'User unbanned successfully',
    };
  }

  async getStats() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);

      const [totalUsers, monthlyRevenueResult, stopsToday, paidSubscribers] =
        await Promise.all([
          this.prisma.user.count({ where: { type: 'user' } }),
          this.prisma.paymentTransaction.aggregate({
            where: {
              created_at: { gte: startOfMonth },
              status: 'succeeded',
            },
            _sum: { amount: true },
          }),
          this.prisma.stopLog.count({
            where: { created_at: { gte: startOfToday } },
          }),
          this.prisma.userSubscription.count({
            where: { status: 'ACTIVE' },
          }),
        ]);

      return {
        success: true,
        data: {
          total_users: totalUsers,
          monthly_revenue: Number(monthlyRevenueResult._sum?.amount || 0),
          stop_log_today: stopsToday,
          total_paid_subscribers: paidSubscribers,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
