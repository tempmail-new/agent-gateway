import type { AgentProvider } from "./types.js";

export class ProviderRegistry {
  private readonly providers = new Map<string, AgentProvider>();

  constructor(private readonly defaultProvider: string) {}

  get(providerName?: string): AgentProvider {
    const selectedProvider = providerName ?? this.defaultProvider;
    const provider = this.providers.get(selectedProvider);

    if (provider === undefined) {
      throw new UnknownProviderError(selectedProvider, [...this.providers.keys()]);
    }

    return provider;
  }

  register(provider: AgentProvider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(`Provider '${provider.name}' is already registered`);
    }

    this.providers.set(provider.name, provider);
  }

  list(): string[] {
    return [...this.providers.keys()].sort();
  }
}

export class UnknownProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly supportedProviders: string[],
  ) {
    super(`Unknown provider '${provider}'`);
    this.name = "UnknownProviderError";
  }
}
