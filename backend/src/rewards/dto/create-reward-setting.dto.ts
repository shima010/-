import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MonthlyCloseDto {
  @ApiProperty({ description: 'Year-month in format YYYY-MM', example: '2024-01' })
  @IsString()
  yearMonth: string;
}

export class RewardPreviewDto {
  @ApiProperty({ description: 'Year-month in format YYYY-MM', example: '2024-01' })
  @IsString()
  yearMonth: string;

  @ApiPropertyOptional({ description: 'Filter by instructor ID' })
  @IsOptional()
  instructorId?: number;
}
