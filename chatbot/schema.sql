// The two forms the chatbot draws from generated field specs.
//
// sure-factor reads this file at generation time. Nothing here is parsed by
// hand: the provider lists become <select> options (from the CHECK
// constraints), the comments become labels and help text, and the password
// column becomes a password input. Run `npm run generate` after editing it.

CREATE TABLE chatbot_settings (
  provider VARCHAR(40) NOT NULL CHECK (provider IN ('mock', 'openai', 'anthropic', 'google', 'google-vertex', 'openrouter', 'openai-compatible')),
  model VARCHAR(128),
  temperature NUMERIC(3,2) NOT NULL,
  base_url VARCHAR(255)
);

COMMENT ON COLUMN chatbot_settings.provider IS 'LLM Provider
Also set your API key in the 🔑 Keys dialog';
COMMENT ON COLUMN chatbot_settings.model IS 'Model
Leave empty for the provider default';
COMMENT ON COLUMN chatbot_settings.temperature IS 'Temperature
0 = precise, 2 = creative';
COMMENT ON COLUMN chatbot_settings.base_url IS 'Base URL
API endpoint for OpenAI-compatible providers';

CREATE TABLE provider_key (
  key_provider VARCHAR(40) NOT NULL CHECK (key_provider IN ('openai', 'anthropic', 'google', 'google-vertex', 'openrouter', 'openai-compatible', 'serpapi', 'exa', 'firesearch')),
  key_base_url VARCHAR(255),
  key_password VARCHAR(256) NOT NULL
);

COMMENT ON COLUMN provider_key.key_provider IS 'Provider
Where this key is used';
COMMENT ON COLUMN provider_key.key_base_url IS 'Base URL
Instance host for Firesearch or an OpenAI-compatible endpoint';
COMMENT ON COLUMN provider_key.key_password IS 'API Key
Stored encrypted on the server; never sent back to the browser';
