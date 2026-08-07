import { mountSettingsFormView } from "./ui/settingsFormView";
import { extensionStorage } from "./platform/extension/storage";
import { ensureOrigins } from "./platform/extension/permissions";

interface TestNotificationResponse {
  ok: boolean;
  message: string;
}

mountSettingsFormView({
  storage: extensionStorage,
  ensureOrigins,
  supportsLiveNotifications: true,
  testLiveNotification: () =>
    chrome.runtime.sendMessage({
      type: "test-live-notification"
    }) as Promise<TestNotificationResponse>
});
