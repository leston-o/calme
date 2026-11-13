from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="CALME_", extra="ignore"
    )

    app_name: str = "CalMe API"
    environment: str = "development"
    debug: bool = True
    log_level: str = "INFO"
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:3000"]

    # FISH AUDIO
    fish_api_key: str = ""
    fish_tts_model: str = "s2-pro"   
    idle_timeout_seconds: float = 10.0
    idle_max_prompts: int = 2
    max_call_seconds: int = 900

    # FISH AUDIO AGENTS (hosted calls: speech, LLM and voice run at Fish)
    fish_agent_enabled: bool = True
    fish_agent_llm_model: str = "anthropic/claude-haiku-4.5"
    # set these to use your own OpenAI-compatible LLM instead (public https only)
    fish_agent_llm_base_url: str = ""
    fish_agent_llm_custom_model: str = ""
    fish_agent_llm_api_key: str = ""

    # POSTGRESS
    database_url: str = ""

    # LLM OLLAMA
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"

    # TWILIO
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_bundle_sid: str = ""   # only for countries that need regulatory paperwork
    twilio_address_sid: str = ""  # same
    public_base_url: str = ""     # your public https address, no trailing slash


@lru_cache
def get_settings() -> Settings:
    return Settings()