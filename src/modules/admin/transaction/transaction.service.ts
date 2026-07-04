import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRepository } from '../../../common/repository/user/user.repository';

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
  ) {}

  async findAll(user_id?: string) {
    try {
      const userDetails = await this.userRepository.getUserDetails(user_id);

      const whereClause = {};
      if (userDetails.type === 'vendor') {
        whereClause['user_id'] = user_id;
      }

      const transactions = await this.prisma.paymentTransaction.findMany({
        where: {
          ...whereClause,
        },
        select: {
          id: true,
          reference_number: true,
          status: true,
          provider: true,
          amount: true,
          currency: true,
          paid_amount: true,
          paid_currency: true,
          created_at: true,
          updated_at: true,
        },
      });

      return {
        success: true,
        data: transactions,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async findOne(id: string, user_id?: string) {
    try {
      const userDetails = await this.userRepository.getUserDetails(user_id);

      const whereClause = {};
      if (userDetails.type === 'vendor') {
        whereClause['user_id'] = user_id;
      }

      const transaction = await this.prisma.paymentTransaction.findUnique({
        where: {
          id: id,
          ...whereClause,
        },
        select: {
          id: true,
          reference_number: true,
          status: true,
          provider: true,
          amount: true,
          currency: true,
          paid_amount: true,
          paid_currency: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!transaction) {
        return {
          success: false,
          message: 'Transaction not found',
        };
      }

      return {
        success: true,
        data: transaction,
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
      const userDetails = await this.userRepository.getUserDetails(user_id);

      const whereClause = {};
      if (userDetails.type === 'vendor') {
        whereClause['user_id'] = user_id;
      }

      const transaction = await this.prisma.paymentTransaction.findUnique({
        where: {
          id: id,
          ...whereClause,
        },
      });

      if (!transaction) {
        return {
          success: false,
          message: 'Transaction not found',
        };
      }

      await this.prisma.paymentTransaction.delete({
        where: {
          id: id,
        },
      });

      return {
        success: true,
        message: 'Transaction deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
