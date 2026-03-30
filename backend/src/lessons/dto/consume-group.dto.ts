import { IsArray, IsDateString, IsString, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GroupStudentTicket {
  @ApiProperty()
  studentId: number;

  @ApiProperty()
  ticketId: number;
}

export class ConsumeGroupTicketDto {
  @ApiProperty({ type: [GroupStudentTicket] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupStudentTicket)
  students: GroupStudentTicket[];

  @ApiPropertyOptional({ description: 'Instructor ID (admin only)' })
  @IsNumber()
  @IsOptional()
  instructorId?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  executedAt?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
