import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private getMonthRange(yearMonth: string) {
    const [year, month] = yearMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  async calculateRewardsPreview(yearMonth: string, instructorId?: number) {
    const { start, end } = this.getMonthRange(yearMonth);

    const where: any = {
      executedAt: { gte: start, lte: end },
    };
    if (instructorId) where.instructorId = instructorId;

    // Get all lesson records for the month
    const lessons = await this.prisma.lessonRecord.findMany({
      where,
      include: {
        instructor: {
          include: {
            rewardSettings: {
              where: { effectiveDate: { lte: end } },
              orderBy: { effectiveDate: 'desc' },
              take: 1,
            },
          },
        },
        ticket: {
          include: { ticketType: true },
        },
      },
    });

    // Group by instructor
    const instructorMap = new Map<number, any[]>();
    for (const lesson of lessons) {
      const id = lesson.instructorId;
      if (!instructorMap.has(id)) instructorMap.set(id, []);
      instructorMap.get(id).push(lesson);
    }

    const results = [];

    for (const [instrId, instrLessons] of instructorMap) {
      const instructor = instrLessons[0].instructor;
      const rewardSetting = instructor.rewardSettings?.[0];

      let lessonCount = instrLessons.length;
      let totalSales = 0;
      let rewardAmount = 0;

      if (rewardSetting) {
        if (instructor.rewardType === 'fixed') {
          // Fixed rate: lessonCount × fixedRate (or groupLessonRate for group lessons)
          for (const lesson of instrLessons) {
            if (lesson.lessonType === 'group' && rewardSetting.groupLessonRate) {
              rewardAmount += rewardSetting.groupLessonRate;
            } else {
              rewardAmount += rewardSetting.fixedRate || 0;
            }
          }
        } else if (instructor.rewardType === 'percentage') {
          // Percentage: (ticketPrice / ticketCount) × percentageRate
          for (const lesson of instrLessons) {
            const ticketPrice = lesson.ticket?.ticketType?.price || 0;
            const ticketCount = lesson.ticket?.ticketType?.grantCount || 1;
            const lessonValue = ticketPrice / ticketCount;
            totalSales += lessonValue;

            if (lesson.lessonType === 'group' && rewardSetting.groupLessonRate) {
              rewardAmount += rewardSetting.groupLessonRate;
            } else {
              rewardAmount += lessonValue * ((rewardSetting.percentageRate || 0) / 100);
            }
          }
        }
      }

      results.push({
        instructorId: instrId,
        instructorName: instructor.name,
        rewardType: instructor.rewardType,
        lessonCount,
        totalSales,
        rewardAmount: Math.round(rewardAmount),
        rewardSetting,
      });
    }

    return { yearMonth, results };
  }

  async monthlyClose(yearMonth: string, requestingUserId?: number) {
    // Check if already closed
    const existing = await this.prisma.rewardResult.findFirst({
      where: { targetYearMonth: yearMonth },
    });

    if (existing?.confirmedAt) {
      throw new ConflictException(`Month ${yearMonth} is already closed`);
    }

    const { start, end } = this.getMonthRange(yearMonth);

    // Calculate rewards
    const preview = await this.calculateRewardsPreview(yearMonth);

    // Lock lesson records
    await this.prisma.lessonRecord.updateMany({
      where: {
        executedAt: { gte: start, lte: end },
        isConfirmed: false,
      },
      data: { isConfirmed: true },
    });

    // Save reward results
    const confirmedAt = new Date();
    const savedResults = await Promise.all(
      preview.results.map((r) =>
        this.prisma.rewardResult.upsert({
          where: {
            targetYearMonth_instructorId: {
              targetYearMonth: yearMonth,
              instructorId: r.instructorId,
            },
          },
          update: {
            lessonCount: r.lessonCount,
            totalSales: r.totalSales,
            rewardAmount: r.rewardAmount,
            confirmedAt,
          },
          create: {
            targetYearMonth: yearMonth,
            instructorId: r.instructorId,
            lessonCount: r.lessonCount,
            totalSales: r.totalSales,
            rewardAmount: r.rewardAmount,
            confirmedAt,
          },
        }),
      ),
    );

    await this.auditService.log({
      userId: requestingUserId,
      action: 'MONTHLY_CLOSE',
      targetEntity: 'RewardResult',
      targetId: yearMonth,
      newValue: { yearMonth, resultCount: savedResults.length },
    });

    return {
      yearMonth,
      confirmedAt,
      results: savedResults,
    };
  }

  async getRewardResults(yearMonth?: string, instructorId?: number) {
    const where: any = {};
    if (yearMonth) where.targetYearMonth = yearMonth;
    if (instructorId) where.instructorId = instructorId;

    return this.prisma.rewardResult.findMany({
      where,
      include: {
        instructor: { select: { id: true, name: true, rewardType: true } },
      },
      orderBy: [{ targetYearMonth: 'desc' }, { instructorId: 'asc' }],
    });
  }

  async getInstructorRewards(instructorId: number) {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [confirmed, preview] = await Promise.all([
      this.prisma.rewardResult.findMany({
        where: { instructorId },
        orderBy: { targetYearMonth: 'desc' },
        include: {
          instructor: { select: { name: true } },
        },
      }),
      this.calculateRewardsPreview(currentYearMonth, instructorId),
    ]);

    return {
      confirmed,
      currentMonthPreview: preview.results.find((r) => r.instructorId === instructorId) || null,
    };
  }
}
