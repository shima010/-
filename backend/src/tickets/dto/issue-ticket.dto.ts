import { IsNumber, IsArray, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IssueTicketDto {
  @ApiProperty({ description: 'Student ID(s) to issue ticket to', type: [Number] })
  @IsArray()
  studentIds: number[];

  @ApiProperty()
  @IsNumber()
  ticketTypeId: number;

  @ApiPropertyOptional({ description: 'Override issued date' })
  @IsDateString()
  @IsOptional()
  issuedAt?: string;
}

export class IssueTicketToOneDto {
  @ApiProperty()
  @IsNumber()
  studentId: number;

  @ApiProperty()
  @IsNumber()
  ticketTypeId: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  issuedAt?: string;
}
