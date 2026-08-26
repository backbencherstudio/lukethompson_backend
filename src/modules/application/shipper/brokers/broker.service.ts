// broker.service.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBrokerDto } from './dto/create-broker.dto';
import { ResponseHelper } from 'src/common/helper/response.helper';

@Injectable()
export class BrokerService {
  constructor(private readonly prisma: PrismaService) {}

  async createBroker(dto: CreateBrokerDto) {
    const { name, email, phone, brokerId, address, city, state, zip, country } =
      dto;

    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing broker with same email
    const existingBroker = await this.prisma.broker.findFirst({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingBroker) {
      throw new ConflictException(
        `A broker with email "${email}" already exists`,
      );
    }

    // Check for existing broker with same name (case-insensitive)
    const existingBrokerByName = await this.prisma.broker.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: 'insensitive',
        },
      },
    });

    if (existingBrokerByName) {
      throw new ConflictException(
        `A broker with name "${name}" already exists`,
      );
    }

    // Check for existing broker with same brokerId (if provided)
    if (brokerId) {
      const existingBrokerById = await this.prisma.broker.findFirst({
        where: {
          brokerId: brokerId.trim(),
        },
      });

      if (existingBrokerById) {
        throw new ConflictException(
          `A broker with broker ID "${brokerId}" already exists`,
        );
      }
    }

    // Create location if address details provided
    let locationId: string | undefined;

    if (address || city || state || zip || country) {
      const location = await this.prisma.location.create({
        data: {
          address: address || null,
          city: city || null,
          state: state || null,
          zip: zip || null,
          country: country || 'USA',
          lat: null,
          lng: null,
        },
      });
      locationId = location.id;
    }

    // Create the broker
    const broker = await this.prisma.broker.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        phone: phone || null,
        brokerId: brokerId ? brokerId.trim() : null,
        location_id: locationId || null,
      },
      include: {
        location: true,
      },
    });

    return ResponseHelper.success({
      message: 'Broker created successfully',
      data: broker,
    });
  }
}
