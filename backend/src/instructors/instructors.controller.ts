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
import { InstructorsService } from './instructors.service';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto, CreateRewardSettingDto } from './dto/update-instructor.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('instructors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instructors')
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'Get all instructors' })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.instructorsService.findAll({
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get(':id')
  @Roles('admin', 'instructor')
  @ApiOperation({ summary: 'Get instructor by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.instructorsService.findOne(id);
  }

  @Get(':id/students')
  @Roles('admin', 'instructor')
  @ApiOperation({ summary: 'Get students assigned to instructor' })
  getStudents(@Param('id', ParseIntPipe) id: number) {
    return this.instructorsService.getStudentsByInstructor(id);
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create new instructor' })
  create(@Body() dto: CreateInstructorDto, @CurrentUser() user: any) {
    return this.instructorsService.create(dto, user?.id);
  }

  @Put(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update instructor' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInstructorDto,
    @CurrentUser() user: any,
  ) {
    return this.instructorsService.update(id, dto, user?.id);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete instructor' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.instructorsService.remove(id, user?.id);
  }

  @Post(':id/reward-settings')
  @Roles('admin')
  @ApiOperation({ summary: 'Create reward setting for instructor' })
  createRewardSetting(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateRewardSettingDto,
    @CurrentUser() user: any,
  ) {
    return this.instructorsService.createRewardSetting(id, dto, user?.id);
  }
}
