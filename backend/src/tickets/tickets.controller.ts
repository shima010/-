import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketTypeDto, UpdateTicketTypeDto } from './dto/create-ticket-type.dto';
import { IssueTicketDto } from './dto/issue-ticket.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // TicketType endpoints
  @Get('types')
  @Roles('admin', 'instructor')
  @ApiOperation({ summary: 'Get all ticket types' })
  findAllTypes() {
    return this.ticketsService.findAllTicketTypes();
  }

  @Get('types/:id')
  @Roles('admin', 'instructor')
  @ApiOperation({ summary: 'Get ticket type by ID' })
  findOneType(@Param('id', ParseIntPipe) id: number) {
    return this.ticketsService.findOneTicketType(id);
  }

  @Post('types')
  @Roles('admin')
  @ApiOperation({ summary: 'Create ticket type' })
  createType(@Body() dto: CreateTicketTypeDto, @CurrentUser() user: any) {
    return this.ticketsService.createTicketType(dto, user?.id);
  }

  @Put('types/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update ticket type' })
  updateType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketTypeDto,
    @CurrentUser() user: any,
  ) {
    return this.ticketsService.updateTicketType(id, dto, user?.id);
  }

  @Delete('types/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete ticket type' })
  deleteType(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.ticketsService.deleteTicketType(id, user?.id);
  }

  // Issue tickets
  @Post('issue')
  @Roles('admin')
  @ApiOperation({ summary: 'Issue ticket to student(s)' })
  issue(@Body() dto: IssueTicketDto, @CurrentUser() user: any) {
    return this.ticketsService.issueTickets(dto, user?.id);
  }

  // Student tickets
  @Get('student/:studentId')
  @Roles('admin', 'instructor', 'student')
  @ApiOperation({ summary: 'Get all tickets for a student' })
  @ApiQuery({ name: 'status', required: false })
  getStudentTickets(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query('status') status?: string,
  ) {
    return this.ticketsService.getStudentTickets(studentId, status);
  }

  @Get('student/:studentId/active')
  @Roles('admin', 'instructor', 'student')
  @ApiOperation({ summary: 'Get active tickets for a student' })
  getActiveTickets(@Param('studentId', ParseIntPipe) studentId: number) {
    return this.ticketsService.getActiveTickets(studentId);
  }

  // Expiring tickets alert
  @Get('expiring')
  @Roles('admin')
  @ApiOperation({ summary: 'Get expiring tickets within N days' })
  @ApiQuery({ name: 'days', required: false })
  getExpiringTickets(@Query('days') days?: string) {
    return this.ticketsService.getExpiringTickets(days ? parseInt(days) : 7);
  }

  // Void a ticket
  @Put(':id/void')
  @Roles('admin')
  @ApiOperation({ summary: 'Void a ticket' })
  voidTicket(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.ticketsService.voidTicket(id, user?.id);
  }
}
