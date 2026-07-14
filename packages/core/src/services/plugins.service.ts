import type { OryCMSPlugin, OryCMSUpdatePluginConfigInput } from "@/types";

export const OryCMSPluginService = {
  async findAll(): Promise<OryCMSPlugin[]> {
    throw new Error("Not implemented");
  },

  async findBySlug(_slug: string): Promise<OryCMSPlugin> {
    throw new Error("Not implemented");
  },

  async install(_slug: string): Promise<OryCMSPlugin> {
    throw new Error("Not implemented");
  },

  async uninstall(_slug: string): Promise<void> {
    throw new Error("Not implemented");
  },

  async enable(_slug: string): Promise<OryCMSPlugin> {
    throw new Error("Not implemented");
  },

  async disable(_slug: string): Promise<OryCMSPlugin> {
    throw new Error("Not implemented");
  },

  async updateConfig(_slug: string, _input: OryCMSUpdatePluginConfigInput): Promise<OryCMSPlugin> {
    throw new Error("Not implemented");
  },
};
