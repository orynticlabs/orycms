export interface OryCMSGeneralSettings {
  workspaceName: string;
  adminOwner: string;
  operationsEmail: string;
  supportEmail: string;
  adminDomain: string;
  address?: string;
  logoUrl?: string;
  faviconUrl?: string;
}

export interface OryCMSStoreSettings {
  currency: string;
  timezone: string;
  locale: string;
  orderPrefix: string;
  lowStockThreshold: number;
  weightUnit: "kg" | "g" | "lb" | "oz";
  dimensionUnit: "cm" | "in" | "mm";
}

export interface OryCMSNotificationSettings {
  emailAlerts: boolean;
  pushAlerts: boolean;
  weeklyDigest: boolean;
  orderAlerts: boolean;
  inventoryAlerts: boolean;
  securityAlerts: boolean;
}

export interface OryCMSSecuritySettings {
  twoFactorEnabled: boolean;
  auditLogRetentionDays: number;
  sessionTimeoutMinutes: number;
  allowedIpRanges: string[];
  returnApprovalRequired: boolean;
  internationalOrdersEnabled: boolean;
}

export interface OryCMSApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface OryCMSAppearanceSettings {
  theme: "light" | "dark" | "system";
  accentColor?: string;
  sidebarCollapsedDefault: boolean;
  dateFormat: string;
  timeFormat: "12h" | "24h";
}

export interface OryCMSWorkspaceSettings {
  general: OryCMSGeneralSettings;
  store: OryCMSStoreSettings;
  notifications: OryCMSNotificationSettings;
  security: OryCMSSecuritySettings;
  appearance: OryCMSAppearanceSettings;
}
