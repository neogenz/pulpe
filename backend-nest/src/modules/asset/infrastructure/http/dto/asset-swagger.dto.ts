import { createZodDto } from 'nestjs-zod';
import {
  assetCreateSchema,
  assetUpdateSchema,
  assetSnapshotsCreateSchema,
  assetCategoryCreateSchema,
  assetCategoryUpdateSchema,
  netWorthResponseSchema,
  assetResponseSchema,
  assetDeleteResponseSchema,
  assetSnapshotsResponseSchema,
  assetCategoryResponseSchema,
  assetCategoryDeleteResponseSchema,
} from 'pulpe-shared';

// Swagger DTOs derived from the shared Zod schemas (single source of truth).
export class AssetCreateDto extends createZodDto(assetCreateSchema) {}
export class AssetUpdateDto extends createZodDto(assetUpdateSchema) {}
export class AssetSnapshotsCreateDto extends createZodDto(
  assetSnapshotsCreateSchema,
) {}
export class AssetCategoryCreateDto extends createZodDto(
  assetCategoryCreateSchema,
) {}
export class AssetCategoryUpdateDto extends createZodDto(
  assetCategoryUpdateSchema,
) {}
export class NetWorthResponseDto extends createZodDto(netWorthResponseSchema) {}
export class AssetResponseDto extends createZodDto(assetResponseSchema) {}
export class AssetDeleteResponseDto extends createZodDto(
  assetDeleteResponseSchema,
) {}
export class AssetSnapshotsResponseDto extends createZodDto(
  assetSnapshotsResponseSchema,
) {}
export class AssetCategoryResponseDto extends createZodDto(
  assetCategoryResponseSchema,
) {}
export class AssetCategoryDeleteResponseDto extends createZodDto(
  assetCategoryDeleteResponseSchema,
) {}
