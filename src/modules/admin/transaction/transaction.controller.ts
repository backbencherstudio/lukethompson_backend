import { Controller, Get, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../../common/guard/role/roles.guard';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { Role } from '../../../common/guard/role/role.enum';
import { Roles } from '../../../common/guard/role/roles.decorator';
import { Request } from 'express';

@ApiBearerAuth()
@ApiTags('Admin Transaction')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @ApiOperation({ summary: 'Get all transactions' })
  @Get()
  async findAll(@Req() req: Request) {
    try {
      const user_id = req.user.id;
      return await this.transactionService.findAll(user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Get one transaction' })
  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    try {
      const user_id = req.user.id;
      return await this.transactionService.findOne(id, user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @ApiOperation({ summary: 'Delete one transaction' })
  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    try {
      const user_id = req.user.id;
      return await this.transactionService.remove(id, user_id);
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
