import type { OryCMSID, OryCMSTimestamps, OryCMSStatus } from "./common.types";

export interface OryCMSUser {
  id: OryCMSID;
  email: string;
  name: string;
  avatar?: string;
  status: OryCMSStatus;
  roles: string[];
  lastLoginAt?: string;
  timestamps: OryCMSTimestamps;
}

export interface OryCMSCreateUserInput {
  email: string;
  name: string;
  password: string;
  roles?: string[];
}

export interface OryCMSUpdateUserInput {
  name?: string;
  email?: string;
  avatar?: string;
  status?: OryCMSStatus;
  roles?: string[];
}

export interface OryCMSAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface OryCMSLoginInput {
  email: string;
  password: string;
}

export interface OryCMSSessionUser {
  id: OryCMSID;
  email: string;
  name: string;
  roles: string[];
  avatar?: string;
}
