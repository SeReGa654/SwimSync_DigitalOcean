import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';

@Injectable()
export class EntriesService {
  constructor(private prisma: PrismaService) {}

  findByEvent(eventId: number) {
    return this.prisma.entry.findMany({
      where: { eventId },
      include: { athlete: true, result: true, ageGroup: true },
      orderBy: [{ heatNumber: 'asc' }, { laneNumber: 'asc' }],
    });
  }

  findByCompetition(competitionId: number) {
    return this.prisma.entry.findMany({
      where: { event: { competitionId } },
      include: { athlete: true, event: true, result: true, ageGroup: true },
    });
  }

  create(data: CreateEntryDto) {
    return this.prisma.entry.create({
      data: {
        athleteId: data.athleteId || null,
        teamName: data.teamName || null,
        eventId: data.eventId,
        entryTimeMs: data.entryTimeMs ?? null,
        ageGroupId: data.ageGroupId ?? null,
        doctorApproved: data.doctorApproved ?? false,
        isOutOfCompetition: data.isOutOfCompetition ?? false,
      },
    });
  }

  async update(id: number, data: UpdateEntryDto) {
    try {
      return await this.prisma.entry.update({ where: { id }, data });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Entry not found');
      }
      throw error;
    }
  }

  async delete(id: number) {
    try {
      return await this.prisma.entry.delete({ where: { id } });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Entry not found');
      }
      throw error;
    }
  }
}
