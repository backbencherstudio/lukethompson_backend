import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseHelper } from 'src/common/helper/response.helper';

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenueChart(year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const transactions = await this.prisma.paymentTransaction.findMany({
      where: {
        created_at: { gte: startDate, lte: endDate },
        status: 'succeeded', // Assuming 'succeeded' is the successful state
      },
      select: { amount: true, created_at: true },
    });

    const monthlyData = Array(12).fill(0);
    transactions.forEach((tx) => {
      const month = new Date(tx.created_at).getMonth();
      monthlyData[month] += Number(tx.amount || 0);
    });

    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const formattedData = months.map((month, index) => ({
      month,
      revenue: monthlyData[index].toFixed(2),
    }));

    return ResponseHelper.success({
      message: 'Revenue chart data fetched successfully',
      data: formattedData,
    });
  }

  async getUserPlanStats() {
    // Currently, since we don't have a Plan table, we'll group by user type
    // In a real scenario, this would join with a Subscriptions table
    const users = await this.prisma.user.groupBy({
      by: ['type'],
      _count: { _all: true },
    });

    const totalUsers = await this.prisma.user.count({ where: { type: 'user' } });

    const formattedData = users.map((u) => ({
      plan: u.type === 'user' ? 'Free Plan' : 'Pro Plan',
      count: u._count._all,
    }));

    return ResponseHelper.success({
      message: 'User plan stats fetched successfully',
      data: {
        total_users: totalUsers,
        plans: formattedData,
      },
    });
  }

  async getStatsSummary() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));

    const [totalUsers, monthlyRevenue, proSubscribers, stopsToday] = await Promise.all([
      this.prisma.user.count({ where: { type: 'user' } }),
      this.prisma.paymentTransaction.aggregate({
        where: {
          created_at: { gte: startOfMonth },
          status: 'succeeded',
        },
        _sum: { amount: true },
      }),
      this.prisma.user.count({
        where: { type: { not: 'user' } }, // Assuming non-standard types are 'Pro'
      }),
      this.prisma.stopLog.count({
        where: { created_at: { gte: startOfToday } },
      }),
    ]);

    return ResponseHelper.success({
      message: 'Stats summary fetched successfully',
      data: {
        total_user: totalUsers,
        monthly_revenue: (Number(monthlyRevenue._sum.amount) || 0).toFixed(2),
        pro_subscriber: proSubscribers,
        stops_today: stopsToday,
      },
    });
  }
}
