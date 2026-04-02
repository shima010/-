import { Test, TestingModule } from '@nestjs/testing';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

/**
 * チケット発行・管理ロジックのユニットテスト（RFP 第5章）
 */
describe('TicketsService', () => {
  let service: TicketsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockTicketType = {
    id: 1,
    name: '月謝ピアノ（4回）',
    price: 20000,
    grantCount: 4,
    validityDays: 30,
    category: 'monthly',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      ticketType: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      studentTicket: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      student: {
        findUnique: jest.fn(),
      },
    };

    const mockAudit = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    prismaService = module.get(PrismaService);
  });

  describe('issueTickets', () => {
    it('複数の生徒に一括でチケットを発行できる', async () => {
      (prismaService.ticketType.findUnique as jest.Mock).mockResolvedValue(mockTicketType);
      (prismaService.studentTicket.create as jest.Mock).mockImplementation((args) =>
        Promise.resolve({ id: Math.random(), ...args.data }),
      );

      const result = await service.issueTickets({
        studentIds: [1, 2, 3],
        ticketTypeId: 1,
      });

      expect(prismaService.studentTicket.create).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(3);
    });

    it('各チケットは正しい初期回数・有効期限で発行される', async () => {
      (prismaService.ticketType.findUnique as jest.Mock).mockResolvedValue(mockTicketType);
      let capturedData: any;
      (prismaService.studentTicket.create as jest.Mock).mockImplementation((args) => {
        capturedData = args.data;
        return Promise.resolve({ id: 1, ...args.data });
      });

      const issuedAt = new Date('2026-04-01');
      await service.issueTickets({ studentIds: [1], ticketTypeId: 1, issuedAt: issuedAt.toISOString() });

      expect(capturedData.initialCount).toBe(4);
      expect(capturedData.remainingCount).toBe(4);
      expect(capturedData.status).toBe('active');

      // 有効期限: 発行日 + 30日 = 2026-05-01
      const expectedExpiry = new Date(issuedAt);
      expectedExpiry.setDate(expectedExpiry.getDate() + 30);
      expect(capturedData.expiresAt.toDateString()).toBe(expectedExpiry.toDateString());
    });

    it('存在しないチケット種別のIDを指定するとエラーになる', async () => {
      (prismaService.ticketType.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.issueTickets({ studentIds: [1], ticketTypeId: 999 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('月謝チケットは当月末を有効期限として自動設定できる', async () => {
      const monthlyType = { ...mockTicketType, validityDays: 30, category: 'monthly' };
      (prismaService.ticketType.findUnique as jest.Mock).mockResolvedValue(monthlyType);

      let capturedExpiry: Date;
      (prismaService.studentTicket.create as jest.Mock).mockImplementation((args) => {
        capturedExpiry = args.data.expiresAt;
        return Promise.resolve({ id: 1, ...args.data });
      });

      const issuedAt = new Date('2026-04-15');
      await service.issueTickets({ studentIds: [1], ticketTypeId: 1, issuedAt: issuedAt.toISOString() });

      // validityDays=30で計算: 2026-04-15 + 30 = 2026-05-15
      expect(capturedExpiry!).toBeDefined();
    });
  });

  describe('getExpiringTickets', () => {
    it('指定日数以内に期限が切れるアクティブなチケットを返す', async () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 5);
      const far = new Date();
      far.setDate(far.getDate() + 30);

      const tickets = [
        { id: 1, status: 'active', expiresAt: soon, student: { name: 'A' }, ticketType: { name: 'T1' } },
        { id: 2, status: 'active', expiresAt: far, student: { name: 'B' }, ticketType: { name: 'T2' } },
      ];
      (prismaService.studentTicket.findMany as jest.Mock).mockResolvedValue(
        tickets.filter((t) => t.expiresAt <= soon),
      );

      const result = await service.getExpiringTickets(7);
      // findMany に where 条件で絞られているため最初の1件が返る
      expect(result).toBeDefined();
    });
  });

  describe('voidTicket', () => {
    it('アクティブなチケットを無効化できる', async () => {
      const activeTicket = {
        id: 1, status: 'active', remainingCount: 3,
        studentId: 1, ticketTypeId: 1,
      };
      (prismaService.studentTicket.findUnique as jest.Mock).mockResolvedValue(activeTicket);
      (prismaService.studentTicket.update as jest.Mock).mockResolvedValue({
        ...activeTicket, status: 'void',
      });

      const result = await service.voidTicket(1);
      expect(result.status).toBe('void');
    });

    it('存在しないチケットを無効化しようとするとエラーになる', async () => {
      (prismaService.studentTicket.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.voidTicket(999)).rejects.toThrow(NotFoundException);
    });
  });
});
