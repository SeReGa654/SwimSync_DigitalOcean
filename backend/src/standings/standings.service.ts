import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StandingsService {
  constructor(private prisma: PrismaService) {}

  async getStandings(competitionId: number) {
    const results = await this.prisma.result.findMany({
      where: {
        entry: { event: { competitionId } },
        place: { not: null }
      },
      include: {
        entry: { include: { athlete: true } }
      }
    });

    const clubs = new Map<string, { gold: number; silver: number; bronze: number; points: number; club: string }>();

    for (const r of results) {
      const club = r.entry.athlete?.club || r.entry.teamName || 'Невідомий Клуб';

      if (!clubs.has(club)) {
        clubs.set(club, { gold: 0, silver: 0, bronze: 0, points: 0, club });
      }

      const stats = clubs.get(club)!;
      if (r.place === 1) stats.gold++;
      if (r.place === 2) stats.silver++;
      if (r.place === 3) stats.bronze++;
      if (r.pointsWa) stats.points += r.pointsWa;
    }

    const arr = Array.from(clubs.values());
    
    const medalStandings = [...arr].sort((a, b) => {
      if (b.gold !== a.gold) return b.gold - a.gold;
      if (b.silver !== a.silver) return b.silver - a.silver;
      if (b.bronze !== a.bronze) return b.bronze - a.bronze;
      return b.points - a.points;
    });

    const pointsStandings = [...arr].sort((a, b) => b.points - a.points);

    return { medalStandings, pointsStandings };
  }
}
