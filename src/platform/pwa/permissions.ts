/**
 * A PWA has no permission-request model for arbitrary origins the way an
 * extension does — a fetch to a configured API either succeeds or fails
 * under CORS, with nothing to prompt the user for. This exists only to
 * satisfy SettingsFormPlatform's interface.
 */
export async function ensureOrigins(): Promise<void> {}
