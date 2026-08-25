import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Put,
} from '@nestjs/common';
import { Company, CompanyKnowledge } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CreateKnowledgeDto, UpdateKnowledgeDto } from './dto/company-knowledge.dto';
import { SafeMember } from './company.repository';

@UseGuards(JwtAuthGuard)
@Controller('companies/:companyId')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  async getCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Company> {
    return this.companyService.getCompany(companyId, user.id);
  }

  @Patch()
  async updateCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Company> {
    return this.companyService.updateCompany(companyId, dto, user.id);
  }

  @Get('members')
  async getMembers(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SafeMember[]> {
    return this.companyService.getMembers(companyId, user.id);
  }

  @Patch('members/:memberId/role')
  async updateMemberRole(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SafeMember> {
    return this.companyService.updateMemberRole(companyId, memberId, dto, user.id);
  }

  @Delete('members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.companyService.removeMember(companyId, memberId, user.id);
  }

  @Get('knowledge')
  async listKnowledge(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('category') category?: string,
  ): Promise<CompanyKnowledge[]> {
    return this.companyService.listKnowledge(companyId, user.id, category);
  }

  @Post('knowledge')
  async upsertKnowledge(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateKnowledgeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompanyKnowledge> {
    return this.companyService.upsertKnowledge(companyId, dto, user.id);
  }

  @Patch('knowledge/:knowledgeId')
  async updateKnowledge(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('knowledgeId', ParseUUIDPipe) knowledgeId: string,
    @Body() dto: UpdateKnowledgeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompanyKnowledge> {
    return this.companyService.updateKnowledge(companyId, knowledgeId, dto, user.id);
  }

  @Delete('knowledge/:knowledgeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteKnowledge(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('knowledgeId', ParseUUIDPipe) knowledgeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.companyService.deleteKnowledge(companyId, knowledgeId, user.id);
  }

  // ─── AI Configuration ─────────────────────────────────────────────────────

  @Get('ai/config')
  async getAiConfig(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companyService.getAiConfig(companyId, user.id);
  }

  @Put('ai/config')
  async updateAiConfig(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() config: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.companyService.updateAiConfig(companyId, config, user.id);
  }

  // ─── AI Usage ─────────────────────────────────────────────────────────────

  @Get('ai/usage')
  async getAiUsage(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.companyService.getAiUsage(companyId, user.id, from, to);
  }
}
