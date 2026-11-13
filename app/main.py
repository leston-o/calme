import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.db.session import create_engine, create_session_factory
from app.providers.fish_agent import FishAgentClient, FishAgents, FishAgentTelephony
from app.providers.fish_audio import FishAudioSTT, FishAudioTTS
from app.providers.ollama import OllamaLLM
from app.repositories.in_memory import InMemoryAgentRepository
from app.repositories.postgres import PostgresAgentRepository
from app.providers.twilio_telephony import TwilioTelephony


logger = logging.getLogger("calme")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    setup_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # storage
        if settings.database_url:
            engine = create_engine(settings.database_url)
            app.state.engine = engine
            app.state.agent_repo = PostgresAgentRepository(create_session_factory(engine))
        else:
            app.state.engine = None
            app.state.agent_repo = InMemoryAgentRepository()
            logger.warning("CALME_DATABASE_URL not set; using in-memory storage")

        # FISH AUDIO CONDITIONAL PROVIDER
        app.state.llm = OllamaLLM(settings.ollama_base_url, settings.ollama_model)
        if settings.fish_api_key:
            app.state.tts = FishAudioTTS(settings.fish_api_key, settings.fish_tts_model)
            app.state.stt = FishAudioSTT(settings.fish_api_key)
        else:
            app.state.tts = None
            app.state.stt = None
            logger.warning("CALME_FISH_API_KEY not set; Fish Audio features disabled")

        # FISH AUDIO AGENTS: hosted calls and phone numbers
        if settings.fish_api_key and settings.fish_agent_enabled:
            app.state.fish_agent_client = FishAgentClient(settings.fish_api_key)
            app.state.fish_agents = FishAgents(app.state.fish_agent_client)
            app.state.fish_telephony = FishAgentTelephony(app.state.fish_agent_client)
        else:
            app.state.fish_agent_client = None
            app.state.fish_agents = None
            app.state.fish_telephony = None

        # TWILIO CONDITIONAL PROVIDER
        if settings.twilio_account_sid and settings.twilio_auth_token:
            app.state.telephony = TwilioTelephony(
                settings.twilio_account_sid,
                settings.twilio_auth_token,
                settings.twilio_bundle_sid,
                settings.twilio_address_sid,
            )
        else:
            app.state.telephony = None
            logger.warning("Twilio keys not set; phone numbers disabled")
        
        logger.info("%s started (%s)", settings.app_name, settings.environment)
        yield

        await app.state.llm.aclose()
        if app.state.fish_agent_client is not None:
            await app.state.fish_agent_client.aclose()
        if app.state.engine is not None:
            await app.state.engine.dispose()
        logger.info("%s shutting down", settings.app_name)

    app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    if settings.debug:  # dev-only test page
        static_dir = Path(__file__).parent / "static"
        app.mount("/test", StaticFiles(directory=static_dir, html=True), name="test")

    return app


app = create_app()