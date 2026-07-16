import type {
  OryCMSSeoPage,
  OryCMSRedirect,
  OryCMSCreateRedirectInput,
  OryCMSSitemapSettings,
  OryCMSPaginatedResponse,
  OryCMSPaginationParams,
} from "@/types";

export const OryCMSSeoService = {
  async getPages(
    _params?: OryCMSPaginationParams,
  ): Promise<OryCMSPaginatedResponse<OryCMSSeoPage>> {
    throw new Error("Not implemented");
  },

  async getPage(_path: string): Promise<OryCMSSeoPage> {
    throw new Error("Not implemented");
  },

  async upsertPage(_path: string, _input: Partial<OryCMSSeoPage>): Promise<OryCMSSeoPage> {
    throw new Error("Not implemented");
  },

  async getRedirects(
    _params?: OryCMSPaginationParams,
  ): Promise<OryCMSPaginatedResponse<OryCMSRedirect>> {
    throw new Error("Not implemented");
  },

  async createRedirect(_input: OryCMSCreateRedirectInput): Promise<OryCMSRedirect> {
    throw new Error("Not implemented");
  },

  async updateRedirect(
    _id: string,
    _input: Partial<OryCMSCreateRedirectInput>,
  ): Promise<OryCMSRedirect> {
    throw new Error("Not implemented");
  },

  async deleteRedirect(_id: string): Promise<void> {
    throw new Error("Not implemented");
  },

  async getSitemapSettings(): Promise<OryCMSSitemapSettings> {
    throw new Error("Not implemented");
  },

  async updateSitemapSettings(
    _input: Partial<OryCMSSitemapSettings>,
  ): Promise<OryCMSSitemapSettings> {
    throw new Error("Not implemented");
  },
};
