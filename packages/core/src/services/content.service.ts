import type {
  OryCMSContentEntry,
  OryCMSContentVersion,
  OryCMSCreateContentInput,
  OryCMSUpdateContentInput,
  OryCMSPublishContentInput,
  OryCMSPaginatedResponse,
  OryCMSPaginationParams,
  OryCMSFilterParams,
  OryCMSSortParams,
} from "@/types";

export const OryCMSContentService = {
  async findAll(
    _collectionSlug: string,
    _params?: OryCMSPaginationParams & {
      filter?: OryCMSFilterParams;
      sort?: OryCMSSortParams;
      locale?: string;
    },
  ): Promise<OryCMSPaginatedResponse<OryCMSContentEntry>> {
    throw new Error("Not implemented");
  },

  async findById(_collectionSlug: string, _id: string): Promise<OryCMSContentEntry> {
    throw new Error("Not implemented");
  },

  async create(_input: OryCMSCreateContentInput): Promise<OryCMSContentEntry> {
    throw new Error("Not implemented");
  },

  async update(
    _collectionSlug: string,
    _id: string,
    _input: OryCMSUpdateContentInput,
  ): Promise<OryCMSContentEntry> {
    throw new Error("Not implemented");
  },

  async delete(_collectionSlug: string, _id: string): Promise<void> {
    throw new Error("Not implemented");
  },

  async publish(
    _collectionSlug: string,
    _id: string,
    _input?: OryCMSPublishContentInput,
  ): Promise<OryCMSContentEntry> {
    throw new Error("Not implemented");
  },

  async unpublish(_collectionSlug: string, _id: string): Promise<OryCMSContentEntry> {
    throw new Error("Not implemented");
  },

  async getVersions(_collectionSlug: string, _id: string): Promise<OryCMSContentVersion[]> {
    throw new Error("Not implemented");
  },

  async restoreVersion(
    _collectionSlug: string,
    _id: string,
    _versionId: string,
  ): Promise<OryCMSContentEntry> {
    throw new Error("Not implemented");
  },
};
