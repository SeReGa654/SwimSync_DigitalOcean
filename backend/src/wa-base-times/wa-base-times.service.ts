import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WaBaseTimesService {
  constructor(private prisma: PrismaService) {}

  findAll(year?: number, poolLength?: number) {
    return this.prisma.waBaseTime.findMany({
      where: { ...(year ? { year } : {}), ...(poolLength ? { poolLength } : {}) },
      orderBy: [{ gender: 'asc' }, { distance: 'asc' }, { style: 'asc' }],
    });
  }

  upsert(data: { year: number; gender: string; distance: number; style: string; poolLength: number; baseTimeMs: number }) {
    return this.prisma.waBaseTime.upsert({
      where: {
        year_gender_distance_style_poolLength: {
          year: data.year, gender: data.gender, distance: data.distance,
          style: data.style, poolLength: data.poolLength,
        },
      },
      update: { baseTimeMs: data.baseTimeMs },
      create: data,
    });
  }

  delete(id: number) {
    return this.prisma.waBaseTime.delete({ where: { id } });
  }
}
