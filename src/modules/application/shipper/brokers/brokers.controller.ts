import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiBody, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BrokerService } from './broker.service';
import { CreateBrokerDto } from './dto/create-broker.dto';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guard/role/roles.guard';

@ApiTags('Brokers')
@ApiBearerAuth('user_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('brokers')
export class BrokerController {
  constructor(private readonly brokerService: BrokerService) {}

  @ApiOperation({
    summary: 'Create a new broker',
    description: 'Creates a new broker with unique name and email validation.',
  })
  @ApiBody({ type: CreateBrokerDto })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createBroker(@Body() createBrokerDto: CreateBrokerDto) {
    return this.brokerService.createBroker(createBrokerDto);
  }
}
