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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CompanyService } from '../company/company.service';
import { ContentRepository, CreateGeneratedContentDto } from './content.repository';
import { AgentType } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller('companies/:companyId/content')
export class ContentController {
  constructor(
    private readonly contentRepo: ContentRepository,
    private readonly companyService: CompanyService,
  ) {}

  @Get()
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('contentType') contentType?: string,
    @Query('agentType') agentType?: AgentType,
  ) {
    await this.assertMembership(companyId, user.id);
    return this.contentRepo.list(companyId, contentType, agentType);
  }

  @Get(':id')
  async getOne(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    const item = await this.contentRepo.findOne(companyId, id);
    if (!item) throw new NotFoundException('Content not found');
    return item;
  }

  @Post()
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateGeneratedContentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    return this.contentRepo.create(companyId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    const deleted = await this.contentRepo.delete(companyId, id);
    if (!deleted) throw new NotFoundException('Content not found');
  }

  private async assertMembership(companyId: string, userId: string): Promise<void> {
    await this.companyService.getCompany(companyId, userId);
  }
}
