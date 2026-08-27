import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Asset } from '@prisma/client';
import { AssetsRepository } from './assets.repository';
import { AssetsStorageService } from './assets.storage.service';
import { CompanyRepository } from '../company/company.repository';

export interface UploadedAssetFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Injectable()
export class AssetsService {
  constructor(
    private readonly assetsRepo: AssetsRepository,
    private readonly storage: AssetsStorageService,
    private readonly companyRepo: CompanyRepository,
  ) {}

  async list(companyId: string, requesterId: string, tag?: string): Promise<Asset[]> {
    await this.assertMembership(companyId, requesterId);
    return this.assetsRepo.list(companyId, tag);
  }

  async upload(
    companyId: string,
    requesterId: string,
    file: UploadedAssetFile,
    tags: string[] = [],
  ): Promise<Asset> {
    await this.assertMembership(companyId, requesterId);

    this.storage.validate(file);
    const stored = await this.storage.save(companyId, file);

    return this.assetsRepo.create({
      companyId,
      uploadedBy: requesterId,
      filename: stored.filename,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      storagePath: stored.storagePath,
      publicUrl: stored.publicUrl,
      tags,
    });
  }

  async delete(companyId: string, requesterId: string, id: string): Promise<void> {
    await this.assertMembership(companyId, requesterId);

    const asset = await this.assetsRepo.findById(companyId, id);
    if (!asset) throw new NotFoundException('Asset not found');

    const deleted = await this.assetsRepo.delete(companyId, id);
    if (!deleted) throw new NotFoundException('Asset not found');

    await this.storage.delete(asset.storagePath);
  }

  private async assertMembership(companyId: string, userId: string): Promise<void> {
    const member = await this.companyRepo.findMemberInCompany(companyId, userId);
    if (!member || !member.isActive) {
      throw new ForbiddenException('Access denied to this company');
    }
  }
}
