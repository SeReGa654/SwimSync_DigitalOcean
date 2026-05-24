import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WaBaseTimesService {
  constructor(private prisma: PrismaService) {}

  private handleWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('WA норматив з такими параметрами вже існує');
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('WA норматив не знайдено');
      }
    }
    throw error;
  }

  findAll(year?: number, poolLength?: number) {
    return this.prisma.waBaseTime.findMany({
      where: { ...(year ? { year } : {}), ...(poolLength ? { poolLength } : {}) },
      orderBy: [{ gender: 'asc' }, { distance: 'asc' }, { style: 'asc' }],
    });
  }

  async upsert(data: { year: number; gender: string; distance: number; style: string; poolLength: number; baseTimeMs: number }) {
    try {
      return await this.prisma.waBaseTime.upsert({
        where: {
          year_gender_distance_style_poolLength: {
            year: data.year, gender: data.gender, distance: data.distance,
            style: data.style, poolLength: data.poolLength,
          },
        },
        update: { baseTimeMs: data.baseTimeMs },
        create: data,
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
    }
  }

  async update(
    id: number,
    data: { year: number; gender: string; distance: number; style: string; poolLength: number; baseTimeMs: number },
  ) {
    try {
      return await this.prisma.waBaseTime.update({
        where: { id },
        data,
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
    }
  }

  async delete(id: number) {
    try {
      return await this.prisma.waBaseTime.delete({ where: { id } });
    } catch (error: unknown) {
      this.handleWriteError(error);
    }
  }
}
