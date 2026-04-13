import { Injectable } from '@nestjs/common';
import { CreateSpotlogDto } from './dto/create-spotlog.dto';
import { UpdateSpotlogDto } from './dto/update-spotlog.dto';

@Injectable()
export class SpotlogService {
  create(createSpotlogDto: CreateSpotlogDto) {
    return 'This action adds a new spotlog';
  }

  findAll() {
    return `This action returns all spotlog`;
  }

  findOne(id: number) {
    return `This action returns a #${id} spotlog`;
  }

  update(id: number, updateSpotlogDto: UpdateSpotlogDto) {
    return `This action updates a #${id} spotlog`;
  }

  remove(id: number) {
    return `This action removes a #${id} spotlog`;
  }
}
