import { mountSettingsFormView } from "./ui/settingsFormView";
import { pwaStorage } from "./platform/pwa/storage";
import { ensureOrigins } from "./platform/pwa/permissions";
import { registerServiceWorker } from "./platform/pwa/registerServiceWorker";

registerServiceWorker();

mountSettingsFormView({
  storage: pwaStorage,
  ensureOrigins,
  supportsLiveNotifications: false
});
