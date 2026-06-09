import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateStopLogDto } from './dto/create-stoplog.dto';
import { UpdateStopLogDto } from './dto/update-stoplog.dto';
import {
  LogStopStep,
  PutStopLogDto,
} from '../../application/stoplog/dto/create-stoplog.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResponseHelper } from 'src/common/helper/response.helper';
import { QueryStopLogDto } from '../../application/stoplog/dto/query-stoplog.dto';

@Injectable()
export class StopLogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByUser(user_id: string, query: QueryStopLogDto) {
    const { cursor, limit = 10, search } = query;

    // 1. Verify user exists and get rates
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
      select: { rate_per_hour: true, free_wait_time: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // 2. Build where clause
    const where: any = { user_id };
    if (search) {
      where.OR = [
        {
          arrival_location: {
            OR: [
              { city: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          facility_address: {
            OR: [
              { city: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    // 3. Fetch data and count in parallel
    const stopLogs = await this.prisma.stopLog.findMany({
      where,
      take: Number(limit) + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { created_at: 'desc' },
      include: {
        arrival_location: true,
        facility_address: true,
      },
    });

    const nextCursor =
      stopLogs.length > Number(limit) ? stopLogs[Number(limit)]?.id : undefined;

    if (nextCursor) stopLogs.pop();

    // 4. Transform and calculate detention
    const formattedData = stopLogs.map((log) => {
      const arrived = log.arrived_at ? new Date(log.arrived_at).getTime() : 0;
      const departed = log.departed_at
        ? new Date(log.departed_at).getTime()
        : 0;

      const totalTimeHours =
        departed > arrived ? (departed - arrived) / (1000 * 60 * 60) : 0;

      const payableTime = Math.max(
        0,
        totalTimeHours - (user.free_wait_time || 0),
      );
      const detentionAmount = payableTime * (user.rate_per_hour || 0);

      return {
        id: log.id,
        address:
          log.facility_address?.address ||
          log.arrival_location?.address ||
          null,
        arrived_at: log.arrived_at,
        docked_at: log.docked_at,
        completed_at: log.completed_at,
        departed_at: log.departed_at,
        detention: detentionAmount.toFixed(2),
      };
    });

    return ResponseHelper.success({
      message: 'User stop logs fetched successfully',
      data: formattedData,
      meta_data: {
        next_cursor: nextCursor,
        limit: Number(limit),
      },
    });
  }

  create(createStopLogDto: CreateStopLogDto) {
    return 'This action adds a new stoplog';
  }

  findAll() {
    return `This action returns all stoplog`;
  }

  findOne(id: number) {
    return `This action returns a #${id} stoplog`;
  }

  update(id: number, updateStopLogDto: UpdateStopLogDto) {
    return `This action updates a #${id} stoplog`;
  }

  remove(id: number) {
    return `This action removes a #${id} stoplog`;
  }
}
