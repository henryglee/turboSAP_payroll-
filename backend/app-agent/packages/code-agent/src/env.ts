export const Env = {
  // Internal store for configuration
  _config: {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
    AZURE_COGNITIVE_SERVICES_RESOURCE_NAME: process.env.AZURE_COGNITIVE_SERVICES_RESOURCE_NAME || "",
  } as Record<string, string>,

  /**
   * Resolves the "Property 'get' does not exist" error.
   */
  get(key: string): string {
    return this._config[key] || process.env[key] || "";
  },

  /**
   * Resolves the "Property 'set' does not exist" error.
   */
  set(key: string, value: string): void {
    this._config[key] = value;
  },

  /**
   * Resolves the "Property 'all' does not exist" error.
   */
  all(): Record<string, string> {
    return {
      ...process.env,
      ...this._config,
    } as Record<string, string>;
  }
};
