import type {
  OryCMSWorkspaceSettings,
  OryCMSGeneralSettings,
  OryCMSStoreSettings,
  OryCMSNotificationSettings,
  OryCMSSecuritySettings,
  OryCMSAppearanceSettings,
  OryCMSApiKey,
} from "@/types";

export const OryCMSSettingsService = {
  async getAll(): Promise<OryCMSWorkspaceSettings> {
    throw new Error("Not implemented");
  },

  async updateGeneral(_input: Partial<OryCMSGeneralSettings>): Promise<OryCMSGeneralSettings> {
    throw new Error("Not implemented");
  },

  async updateStore(_input: Partial<OryCMSStoreSettings>): Promise<OryCMSStoreSettings> {
    throw new Error("Not implemented");
  },

  async updateNotifications(
    _input: Partial<OryCMSNotificationSettings>,
  ): Promise<OryCMSNotificationSettings> {
    throw new Error("Not implemented");
  },

  async updateSecurity(_input: Partial<OryCMSSecuritySettings>): Promise<OryCMSSecuritySettings> {
    throw new Error("Not implemented");
  },

  async updateAppearance(
    _input: Partial<OryCMSAppearanceSettings>,
  ): Promise<OryCMSAppearanceSettings> {
    throw new Error("Not implemented");
  },

  async getApiKeys(): Promise<OryCMSApiKey[]> {
    throw new Error("Not implemented");
  },

  async createApiKey(
    _name: string,
    _permissions: string[],
    _expiresAt?: string,
  ): Promise<OryCMSApiKey & { secret: string }> {
    throw new Error("Not implemented");
  },

  async deleteApiKey(_id: string): Promise<void> {
    throw new Error("Not implemented");
  },
};
