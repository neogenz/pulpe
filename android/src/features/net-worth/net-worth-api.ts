import {
  type AssetCategoryCreate,
  assetCategoryCreateSchema,
  type AssetCategoryRecord,
  assetCategoryResponseSchema,
  type AssetCategoryUpdate,
  assetCategoryUpdateSchema,
  type AssetCreate,
  assetCreateSchema,
  assetDeleteResponseSchema,
  type AssetRecord,
  assetResponseSchema,
  type AssetSnapshotsCreate,
  assetSnapshotsCreateSchema,
  assetSnapshotsResponseSchema,
  type AssetUpdate,
  assetUpdateSchema,
  type NetWorth,
  netWorthResponseSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

export function fetchNetWorth(): Promise<NetWorth> {
  return api
    .get(ENDPOINTS.assets, netWorthResponseSchema)
    .then((response) => response.data);
}

export function createAsset(payload: AssetCreate): Promise<AssetRecord> {
  return api
    .post<
      { data: AssetRecord },
      AssetCreate
    >(ENDPOINTS.assets, payload, assetResponseSchema, assetCreateSchema)
    .then((response) => response.data);
}

export function updateAsset(input: {
  assetId: string;
  changes: AssetUpdate;
}): Promise<AssetRecord> {
  return api
    .patch<
      { data: AssetRecord },
      AssetUpdate
    >(ENDPOINTS.asset(input.assetId), input.changes, assetResponseSchema, assetUpdateSchema)
    .then((response) => response.data);
}

export function deleteAsset(assetId: string): Promise<unknown> {
  return api.delete(ENDPOINTS.asset(assetId), assetDeleteResponseSchema);
}

export function recordAssetSnapshots(
  payload: AssetSnapshotsCreate,
): Promise<unknown> {
  return api.post(
    ENDPOINTS.assetSnapshots,
    payload,
    assetSnapshotsResponseSchema,
    assetSnapshotsCreateSchema,
  );
}

export function dismissAssetSuggestion(assetId: string): Promise<AssetRecord> {
  return api
    .post(
      ENDPOINTS.assetDismissSuggestion(assetId),
      undefined,
      assetResponseSchema,
    )
    .then((response) => response.data);
}

export function createAssetCategory(
  payload: AssetCategoryCreate,
): Promise<AssetCategoryRecord> {
  return api
    .post<
      { data: AssetCategoryRecord },
      AssetCategoryCreate
    >(ENDPOINTS.assetCategories, payload, assetCategoryResponseSchema, assetCategoryCreateSchema)
    .then((response) => response.data);
}

export function renameAssetCategory(input: {
  categoryId: string;
  changes: AssetCategoryUpdate;
}): Promise<AssetCategoryRecord> {
  return api
    .patch<
      { data: AssetCategoryRecord },
      AssetCategoryUpdate
    >(ENDPOINTS.assetCategory(input.categoryId), input.changes, assetCategoryResponseSchema, assetCategoryUpdateSchema)
    .then((response) => response.data);
}
