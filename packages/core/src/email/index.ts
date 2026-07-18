export type {
  OryCMSEmailMessage,
  OryCMSEmailProvider,
  OryCMSResolvedEmailConfig,
} from "./email.types";
export {
  getOryCMSEmailProvider,
  resolveOryCMSEmailConfig,
} from "./email.factory";
export {
  sendOryCMSEmail,
  isOryCMSEmailConfigured,
} from "./email.service";
export type { OryCMSSendResult } from "./email.service";
