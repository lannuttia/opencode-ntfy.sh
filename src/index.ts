import {
  createNotificationPlugin,
  loadConfig,
  getBackendConfig,
} from "opencode-notification-sdk";
import { parseNtfyBackendConfig } from "./config.js";
import { createNtfyBackend } from "./backend.js";

const config = loadConfig("ntfy");
const backendRaw = getBackendConfig(config, "ntfy");
const backendConfig = parseNtfyBackendConfig(backendRaw);

export default createNotificationPlugin(createNtfyBackend(backendConfig), {
  backendConfigKey: "ntfy",
  config,
});
