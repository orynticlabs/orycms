import type { OryCMSLoginInput, OryCMSAuthToken, OryCMSSessionUser } from "@/types";

export const OryCMSAuthService = {
  async login(_input: OryCMSLoginInput): Promise<OryCMSAuthToken> {
    throw new Error("Not implemented");
  },

  async logout(_refreshToken: string): Promise<void> {
    throw new Error("Not implemented");
  },

  async refresh(_refreshToken: string): Promise<OryCMSAuthToken> {
    throw new Error("Not implemented");
  },

  async me(_accessToken: string): Promise<OryCMSSessionUser> {
    throw new Error("Not implemented");
  },
};
