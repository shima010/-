import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';
import { InstructorsModule } from './instructors/instructors.module';
import { TicketsModule } from './tickets/tickets.module';
import { LessonsModule } from './lessons/lessons.module';
import { RewardsModule } from './rewards/rewards.module';
import { CsvModule } from './csv/csv.module';
import { AuditModule } from './audit/audit.module';
import { ImportModule } from './import/import.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Rate limiting: 100 req / 60s per IP (RFP 9.2)
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    StudentsModule,
    InstructorsModule,
    TicketsModule,
    LessonsModule,
    RewardsModule,
    CsvModule,
    AuditModule,
    ImportModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
