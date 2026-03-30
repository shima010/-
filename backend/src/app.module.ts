import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';
import { InstructorsModule } from './instructors/instructors.module';
import { TicketsModule } from './tickets/tickets.module';
import { LessonsModule } from './lessons/lessons.module';
import { RewardsModule } from './rewards/rewards.module';
import { CsvModule } from './csv/csv.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    StudentsModule,
    InstructorsModule,
    TicketsModule,
    LessonsModule,
    RewardsModule,
    CsvModule,
    AuditModule,
  ],
})
export class AppModule {}
