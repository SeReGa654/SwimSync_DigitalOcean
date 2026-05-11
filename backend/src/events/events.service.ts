import { Injectable, NotFoundException } from '@nestjs/common';
import { AthleteGender, Prisma, SwimStyle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  findByCompetition(competitionId: number) {
    return this.prisma.event.findMany({
      where: { competitionId },
      include: { _count: { select: { entries: true } } },
      orderBy: [{ sortOrder: 'asc' }, { distance: 'asc' }, { style: 'asc' }, { gender: 'asc' }],
    });
  }

  findOne(id: number) {
    return this.prisma.event.findUnique({
      where: { id },
      include: { entries: { include: { athlete: true, result: true, ageGroup: true } } },
    });
  }

  create(data: { competitionId: number; distance: number; style: SwimStyle; gender: AthleteGender }) {
    const styleUaMap: Record<string, string> = {
      'Freestyle': 'Вільний стиль', 'FREE': 'Вільний стиль',
      'Breaststroke': 'Брас', 'BREAST': 'Брас',
      'Backstroke': 'На спині', 'BACK': 'На спині',
      'Butterfly': 'Батерфляй', 'FLY': 'Батерфляй',
      'Medley': 'Комплексне плавання', 'MEDLEY': 'Комплексне плавання',
    };
    const genderLabel = 
      data.gender === 'F' ? 'Жінки' : 
      data.gender === 'M' ? 'Чоловіки' : 'Змішана';
    const name = `${data.distance}м ${styleUaMap[data.style] || data.style} ${genderLabel}`;
    return this.prisma.event.create({ data: { ...data, name } });
  }

  async reorder(eventIds: number[]) {
    const updates = eventIds.map((id, index) =>
      this.prisma.event.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );
    await this.prisma.$transaction(updates);
    return { reordered: eventIds.length };
  }

  async delete(id: number) {
    try {
      return await this.prisma.event.delete({ where: { id } });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Event not found');
      }
      throw error;
    }
  }
}
