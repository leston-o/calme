from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code = 400
    code = "app_error"

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)

class NotFoundError(AppError):
    status_code = 404
    code = "not_found"

class ProviderError(AppError):
    """An external service (Fish Audio, LLM, etc.) failed."""
    status_code = 502
    code = "provider_error"


class NotConfiguredError(AppError):
    status_code = 503
    code = "not_configured"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"
    

def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )