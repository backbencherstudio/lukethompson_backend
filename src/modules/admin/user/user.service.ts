import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';
import appConfig from '../../../config/app.config';
import { NajimStorage } from '../../../common/lib/Disk/NajimStorage';
import { DateHelper } from '../../../common/helper/date.helper';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      const user = await this.userRepository.createUser(createUserDto);

      return {
        success: true,
        message: 'User created successfully',
        data: user,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findAll({
    search,
    page = 1,
    limit = 10,
    type = 'user',
  }: {
    search?: string;
    page?: number;
    limit?: number;
    type?: string;
  }) {
    try {
      const skip = (page - 1) * limit;
      const where_condition: any = {
        type: type,
      };

      if (search) {
        where_condition['OR'] = [
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
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(id: string) {
    try {
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
          updated_at: true,
          avatar: true,
          billing_id: true,
        },
      });

      // add avatar url to user
      if (user.avatar) {
        user['avatar'] = NajimStorage.url(
          appConfig().storageUrl.avatar + user.avatar,
          { signed: true },
        );
      }

      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
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
    try {
      const user = await this.userRepository.updateUser(id, updateUserDto);

      if (user.success) {
        return {
          success: user.success,
          message: user.message,
        };
      } else {
        return {
          success: user.success,
          message: user.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async remove(id: string) {
    try {
      const user = await this.userRepository.deleteUser(id);
      return user;
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
