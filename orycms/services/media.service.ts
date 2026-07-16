import type {
  OryCMSMediaAsset,
  OryCMSMediaFolder,
  OryCMSCreateMediaFolderInput,
  OryCMSUpdateMediaAssetInput,
  OryCMSPaginatedResponse,
  OryCMSPaginationParams,
} from "@/types";

export const OryCMSMediaService = {
  async findAll(
    _params?: OryCMSPaginationParams & { folderId?: string; type?: string; search?: string },
  ): Promise<OryCMSPaginatedResponse<OryCMSMediaAsset>> {
    throw new Error("Not implemented");
  },

  async findById(_id: string): Promise<OryCMSMediaAsset> {
    throw new Error("Not implemented");
  },

  async upload(_file: File, _folderId?: string): Promise<OryCMSMediaAsset> {
    throw new Error("Not implemented");
  },

  async update(_id: string, _input: OryCMSUpdateMediaAssetInput): Promise<OryCMSMediaAsset> {
    throw new Error("Not implemented");
  },

  async delete(_id: string): Promise<void> {
    throw new Error("Not implemented");
  },

  async bulkDelete(_ids: string[]): Promise<void> {
    throw new Error("Not implemented");
  },

  async findFolders(_parentId?: string): Promise<OryCMSMediaFolder[]> {
    throw new Error("Not implemented");
  },

  async createFolder(_input: OryCMSCreateMediaFolderInput): Promise<OryCMSMediaFolder> {
    throw new Error("Not implemented");
  },

  async deleteFolder(_id: string): Promise<void> {
    throw new Error("Not implemented");
  },
};
