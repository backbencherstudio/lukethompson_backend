import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SpotlogService } from './spotlog.service';
import { CreateSpotlogDto } from './dto/create-spotlog.dto';
import { UpdateSpotlogDto } from './dto/update-spotlog.dto';

@Controller('spotlog')
export class SpotlogController {
  constructor(private readonly spotlogService: SpotlogService) {}

  @Post()
  create(@Body() createSpotlogDto: CreateSpotlogDto) {
    return this.spotlogService.create(createSpotlogDto);
  }

  @Get()
  findAll() {
    return this.spotlogService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.spotlogService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSpotlogDto: UpdateSpotlogDto) {
    return this.spotlogService.update(+id, updateSpotlogDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.spotlogService.remove(+id);
  }
}
