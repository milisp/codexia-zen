export const mapProviderToEnvKey = (provider: string | undefined): string => {
    if (provider === undefined) {
        return "GENERIC_API_KEY";
    }
    const key = {
      openai: "OPENAI_API_KEY",
      ollama: "",
      openrouter: "OPENROUTER_API_KEY",
      google: "GEMINI_API_KEY",
    }[provider];
    if (key === undefined) {
      console.error(`Unknown provider '${provider}', defaulting to GENERIC_API_KEY`);
      return "GENERIC_API_KEY";
    }
    return key;
  };