import {
  Controller,
  Get,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { createReadStream } from 'fs';
import { join } from 'path';
import { Response } from 'express';
import { Readable } from 'stream';
import {
  ApiExcludeController,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('App')
@Controller() // This handles root routes
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Root endpoint' })
  @ApiResponse({ status: 200, description: 'Returns welcome message' })
  getRoot(): { message: string; status: string; timestamp: string } {
    return {
      message: 'Welcome to the API',
      status: 'online',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Returns service health status' })
  async healthCheck(): Promise<{
    status: string;
    service: string;
    timestamp: string;
    uptime: number;
  }> {
    return {
      status: 'healthy',
      service: 'api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('hello')
  getHello(): string {
    return this.appService.getHello();
  }
}
