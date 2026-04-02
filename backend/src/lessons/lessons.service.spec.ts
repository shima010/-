import { Test, TestingModule } from '@nestjs/testing';
import { LessonsService } from './lessons.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * レッスン消化ロジックのユニットテスト（RFP 第3章・第6章）
 */
describe('LessonsService', () => {
  let service: LessonsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockActiveTicket = {
    id: 1,
    studentId: 1,
    ticketTypeId: 1,
    remainingCount: 3,
    status: 'active',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日後
    ticketType: { id: 1, name: 'Monthly 4', price: 20000, grantCount: 4 },
  };

  const mockLessonRecord = {
    id: 1,
    executedAt: new Date(),
    instructorId: 1,
    studentId: 1,
    ticketId: 1,
    lessonType: 'individual',
    groupSessionId: null,
    notes: null,
    isConfirmed: false,
    student: { name: '佐藤一郎' },
    instructor: { name: 'Yamada Hanako' },
    ticket: { ticketType: { name: 'Monthly 4' } },
  };

  beforeEach(async () => {
    const mockPrisma = {
      studentTicket: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      lessonRecord: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockAudit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<LessonsService>(LessonsService);
    prismaService = module.get(PrismaService);
  });

  describe('consumeTicket（個人レッスン消化）', () => {
    it('有効なチケットを消化し、残数を1減らす', async () => {
      (prismaService.studentTicket.findUnique as jest.Mock).mockResolvedValue(mockActiveTicket);
      (prismaService.$transaction as jest.Mock).mockImplementation(async (ops) => {
        return ops; // 配列を返すトランザクション
      });
      (prismaService.lessonRecord.create as jest.Mock).mockResolvedValue(mockLessonRecord);
      (prismaService.studentTicket.update as jest.Mock).mockResolvedValue({
        ...mockActiveTicket,
        remainingCount: 2,
      });

      // $transaction を配列として扱う
      (prismaService.$transaction as jest.Mock).mockResolvedValue([
        mockLessonRecord,
        { ...mockActiveTicket, remainingCount: 2 },
      ]);

      const result = await service.consumeTicket(
        { studentId: 1, ticketId: 1, lessonType: 'individual' },
        1,
      );

      expect(result).toBeDefined();
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('存在しないチケットを消化しようとするとNotFoundエラー', async () => {
      (prismaService.studentTicket.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.consumeTicket({ studentId: 1, ticketId: 999, lessonType: 'individual' }, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('他の生徒のチケットを使おうとするとBadRequestエラー', async () => {
      const wrongTicket = { ...mockActiveTicket, studentId: 999 };
      (prismaService.studentTicket.findUnique as jest.Mock).mockResolvedValue(wrongTicket);

      await expect(
        service.consumeTicket({ studentId: 1, ticketId: 1, lessonType: 'individual' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('残数0のチケットを消化しようとするとBadRequestエラー', async () => {
      const emptyTicket = { ...mockActiveTicket, remainingCount: 0 };
      (prismaService.studentTicket.findUnique as jest.Mock).mockResolvedValue(emptyTicket);

      await expect(
        service.consumeTicket({ studentId: 1, ticketId: 1, lessonType: 'individual' }, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('期限切れチケットを消化しようとするとBadRequestエラー', async () => {
      const expiredTicket = {
        ...mockActiveTicket,
        expiresAt: new Date(Date.now() - 1000), // 過去
      };
      (prismaService.studentTicket.findUnique as jest.Mock).mockResolvedValue(expiredTicket);

      await expect(
        service.consumeTicket({ studentId: 1, ticketId: 1, lessonType: 'individual' }, 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update（レッスン記録の修正）', () => {
    it('管理者は確定前のレッスン記録をいつでも修正できる', async () => {
      const record = { ...mockLessonRecord, executedAt: new Date('2026-03-01'), isConfirmed: false };
      (prismaService.lessonRecord.findUnique as jest.Mock).mockResolvedValue(record);
      (prismaService.lessonRecord.update as jest.Mock).mockResolvedValue({ ...record, notes: '更新済み' });

      const result = await service.update(
        1,
        { notes: '更新済み' },
        { id: 99, role: 'admin' },
      );

      expect(result.notes).toBe('更新済み');
    });

    it('講師は当日以外のレッスン記録を修正できない（RFP 6章）', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const record = { ...mockLessonRecord, executedAt: yesterday, instructorId: 1, isConfirmed: false };
      (prismaService.lessonRecord.findUnique as jest.Mock).mockResolvedValue(record);

      await expect(
        service.update(1, { notes: '変更' }, { id: 1, role: 'instructor' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('確定済みのレッスン記録は誰も修正できない', async () => {
      const confirmed = { ...mockLessonRecord, isConfirmed: true };
      (prismaService.lessonRecord.findUnique as jest.Mock).mockResolvedValue(confirmed);

      await expect(
        service.update(1, { notes: '変更' }, { id: 99, role: 'admin' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove（レッスン記録の削除・チケット返還）', () => {
    it('削除時にチケット残数が自動的に1戻される', async () => {
      const record = { ...mockLessonRecord, isConfirmed: false, ticket: mockActiveTicket };
      (prismaService.lessonRecord.findUnique as jest.Mock).mockResolvedValue(record);
      (prismaService.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      await service.remove(1, { id: 99, role: 'admin' });

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('確定済みのレッスン記録は削除できない', async () => {
      const record = { ...mockLessonRecord, isConfirmed: true };
      (prismaService.lessonRecord.findUnique as jest.Mock).mockResolvedValue(record);

      await expect(
        service.remove(1, { id: 99, role: 'admin' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
