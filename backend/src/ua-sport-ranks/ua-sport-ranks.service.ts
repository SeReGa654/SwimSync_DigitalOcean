import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUaSportRankDto } from './dto/create-ua-sport-rank.dto';
import { UpdateUaSportRankDto } from './dto/update-ua-sport-rank.dto';

@Injectable()
export class UaSportRanksService {
  constructor(private prisma: PrismaService) {}

  findAll(poolLength?: number) {
    return this.prisma.uaSportRank.findMany({
      where: poolLength ? { poolLength } : {},
      orderBy: [{ distance: 'asc' }, { style: 'asc' }, { gender: 'asc' }, { normTimeMs: 'asc' }],
    });
  }

  create(data: CreateUaSportRankDto) {
    return this.prisma.uaSportRank.create({ data });
  }

  update(id: number, data: UpdateUaSportRankDto) {
    return this.prisma.uaSportRank.update({ where: { id }, data });
  }

  delete(id: number) {
    return this.prisma.uaSportRank.delete({ where: { id } });
  }
}
