import { Test, TestingModule } from '@nestjs/testing';
import { RewardsService } from './rewards.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * 報酬計算ロジックのユニットテスト（RFP 第7章）
 * - 固定単価方式（A）
 * - 歩合方式（B）
 * - グループレッスン扱い
 */

const makeMockLesson = (overrides: any = {}) => ({
  id: 1,
  executedAt: new Date('2026-04-15'),
  instructorId: 1,
  studentId: 1,
  ticketId: 1,
  lessonType: 'individual',
  groupSessionId: null,
  notes: null,
  isConfirmed: false,
  ...overrides,
  instructor: {
    id: 1,
    name: 'Test Instructor',
    rewardType: 'fixed',
    rewardSettings: [{
      id: 1,
      instructorId: 1,
      effectiveDate: new Date('2026-01-01'),
      fixedRate: 3000,
      percentageRate: null,
      groupLessonRate: 1500,
    }],
    ...overrides.instructor,
  },
  ticket: {
    id: 1,
    remainingCount: 3,
    ticketType: {
      id: 1,
      name: 'Monthly 4 Lessons',
      price: 20000,
      grantCount: 4,
      category: 'monthly',
    },
    ...overrides.ticket,
  },
});

describe('RewardsService', () => {
  let service: RewardsService;
  let prismaService: jest.Mocked<PrismaService>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const mockPrisma = {
      lessonRecord: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      rewardResult: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<RewardsService>(RewardsService);
    prismaService = module.get(PrismaService);
    auditService = module.get(AuditService);
  });

  describe('calculateRewardsPreview', () => {
    it('固定単価方式（個人レッスン）: レッスン回数 × 固定単価を計算する', async () => {
      const lessons = [
        makeMockLesson({ id: 1 }),
        makeMockLesson({ id: 2 }),
        makeMockLesson({ id: 3 }),
      ];
      (prismaService.lessonRecord.findMany as jest.Mock).mockResolvedValue(lessons);

      const result = await service.calculateRewardsPreview('2026-04');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].lessonCount).toBe(3);
      // 3回 × 3000円 = 9000円
      expect(result.results[0].rewardAmount).toBe(9000);
    });

    it('固定単価方式（グループレッスン）: グループ単価を使用する', async () => {
      const lessons = [
        makeMockLesson({ id: 1, lessonType: 'group' }),
        makeMockLesson({ id: 2, lessonType: 'group' }),
        makeMockLesson({ id: 3 }),  // 個人1回
      ];
      (prismaService.lessonRecord.findMany as jest.Mock).mockResolvedValue(lessons);

      const result = await service.calculateRewardsPreview('2026-04');

      expect(result.results[0].lessonCount).toBe(3);
      // グループ2回 × 1500円 + 個人1回 × 3000円 = 6000円
      expect(result.results[0].rewardAmount).toBe(6000);
    });

    it('歩合方式: (チケット単価 ÷ 回数) × 歩合率を計算する', async () => {
      const percentageInstructor = {
        id: 2,
        name: 'Percentage Instructor',
        rewardType: 'percentage',
        rewardSettings: [{
          id: 2,
          instructorId: 2,
          effectiveDate: new Date('2026-01-01'),
          fixedRate: null,
          percentageRate: 60,
          groupLessonRate: null,
        }],
      };

      const lessons = [
        makeMockLesson({
          id: 1,
          instructorId: 2,
          instructor: percentageInstructor,
          ticket: {
            id: 2,
            ticketType: {
              name: '10 Lesson Coupon',
              price: 45000,
              grantCount: 10,
            },
          },
        }),
      ];
      (prismaService.lessonRecord.findMany as jest.Mock).mockResolvedValue(lessons);

      const result = await service.calculateRewardsPreview('2026-04');

      // 単価: 45000 ÷ 10 = 4500円
      // 報酬: 4500 × 60% = 2700円
      expect(result.results[0].totalSales).toBe(4500);
      expect(result.results[0].rewardAmount).toBe(2700);
    });

    it('レッスンがない月は空の配列を返す', async () => {
      (prismaService.lessonRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.calculateRewardsPreview('2026-04');

      expect(result.results).toHaveLength(0);
    });

    it('報酬設定がない講師は報酬0円を返す', async () => {
      const noSettingLesson = makeMockLesson({
        instructor: {
          id: 99,
          name: 'No Setting Instructor',
          rewardType: 'fixed',
          rewardSettings: [],
        },
      });
      (prismaService.lessonRecord.findMany as jest.Mock).mockResolvedValue([noSettingLesson]);

      const result = await service.calculateRewardsPreview('2026-04');

      expect(result.results[0].rewardAmount).toBe(0);
    });

    it('複数講師の場合、それぞれ個別に計算する', async () => {
      const instructor2 = {
        id: 2,
        name: 'Instructor 2',
        rewardType: 'fixed',
        rewardSettings: [{
          id: 2,
          fixedRate: 2000,
          percentageRate: null,
          groupLessonRate: 1000,
          effectiveDate: new Date('2026-01-01'),
        }],
      };

      const lessons = [
        makeMockLesson({ id: 1, instructorId: 1 }),
        makeMockLesson({ id: 2, instructorId: 1 }),
        makeMockLesson({ id: 3, instructorId: 2, instructor: instructor2 }),
      ];
      (prismaService.lessonRecord.findMany as jest.Mock).mockResolvedValue(lessons);

      const result = await service.calculateRewardsPreview('2026-04');

      expect(result.results).toHaveLength(2);

      const instr1 = result.results.find((r: any) => r.instructorId === 1);
      const instr2 = result.results.find((r: any) => r.instructorId === 2);

      // 講師1: 2回 × 3000円 = 6000円
      expect(instr1?.rewardAmount).toBe(6000);
      // 講師2: 1回 × 2000円 = 2000円
      expect(instr2?.rewardAmount).toBe(2000);
    });
  });

  describe('getMonthRange（private method via calculateRewardsPreview）', () => {
    it('2026-04 は 2026-04-01 〜 2026-04-30 の範囲になる', async () => {
      (prismaService.lessonRecord.findMany as jest.Mock).mockImplementation((args) => {
        const gte: Date = args.where.executedAt.gte;
        const lte: Date = args.where.executedAt.lte;
        expect(gte.getMonth()).toBe(3); // April (0-indexed)
        expect(gte.getDate()).toBe(1);
        expect(lte.getMonth()).toBe(3);
        expect(lte.getDate()).toBe(30);
        return Promise.resolve([]);
      });

      await service.calculateRewardsPreview('2026-04');
    });
  });
});
