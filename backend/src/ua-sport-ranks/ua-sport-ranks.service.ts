import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUaSportRankDto } from './dto/create-ua-sport-rank.dto';
import { UpdateUaSportRankDto } from './dto/update-ua-sport-rank.dto';

@Injectable()
export class UaSportRanksService {
  constructor(private prisma: PrismaService) {}

  private handleWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Норматив ФПУ з такими параметрами вже існує');
      }
      if (error.code === 'P2025') {
        throw new NotFoundException('Норматив ФПУ не знайдено');
      }
    }
    throw error;
  }

  findAll(poolLength?: number) {
    return this.prisma.uaSportRank.findMany({
      where: poolLength ? { poolLength } : {},
      orderBy: [{ distance: 'asc' }, { style: 'asc' }, { gender: 'asc' }, { normTimeMs: 'asc' }],
    });
  }

  async create(data: CreateUaSportRankDto) {
    try {
      return await this.prisma.uaSportRank.create({ data });
    } catch (error: unknown) {
      this.handleWriteError(error);
    }
  }

  async update(id: number, data: UpdateUaSportRankDto) {
    try {
      return await this.prisma.uaSportRank.update({ where: { id }, data });
    } catch (error: unknown) {
      this.handleWriteError(error);
    }
  }

  async delete(id: number) {
    try {
      return await this.prisma.uaSportRank.delete({ where: { id } });
    } catch (error: unknown) {
      this.handleWriteError(error);
    }
  }
}
