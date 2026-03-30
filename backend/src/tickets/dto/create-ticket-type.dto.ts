import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TicketCategory {
  monthly = 'monthly',
  coupon = 'coupon',
}

export class CreateTicketTypeDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  grantCount: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  validityDays: number;

  @ApiPropertyOptional({ enum: TicketCategory })
  @IsEnum(TicketCategory)
  @IsOptional()
  category?: TicketCategory;
}

export class UpdateTicketTypeDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(1)
  @IsOptional()
  grantCount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(1)
  @IsOptional()
  validityDays?: number;

  @ApiPropertyOptional({ enum: TicketCategory })
  @IsEnum(TicketCategory)
  @IsOptional()
  category?: TicketCategory;
}
