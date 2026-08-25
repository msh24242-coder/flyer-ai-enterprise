import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ContentRepository, CreateGeneratedContentDto } from './content.repository';
import { AgentType } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('companies/:companyId/content')
export class ContentController {
  constructor(private readonly contentRepo: ContentRepository) {}

  @Get()
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('contentType') contentType?: string,
    @Query('agentType') agentType?: AgentType,
  ) {
    return this.contentRepo.list(companyId, contentType, agentType);
  }

  @Get(':id')
  async getOne(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const item = await this.contentRepo.findOne(companyId, id);
    if (!item) throw new NotFoundException('Content not found');
    return item;
  }

  @Post()
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateGeneratedContentDto,
  ) {
    return this.contentRepo.create(companyId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const deleted = await this.contentRepo.delete(companyId, id);
    if (!deleted) throw new NotFoundException('Content not found');
  }
}
