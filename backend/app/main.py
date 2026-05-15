"""FinAlly FastAPI application entrypoint."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

# Load .env from project root before any env var reads
load_dotenv(Path(__file__).parent.parent.parent / ".env")

import app.state as state  # noqa: E402
from app.db import init_db  # noqa: E402
from app.market import create_stream_router  # noqa: E402
from app.market.seed_prices import SEED_PRICES  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB, start market data. Shutdown: stop market data."""
    logger.info("Starting FinAlly backend")
    init_db()
    await state.market_source.start(list(SEED_PRICES.keys()))
    yield
    logger.info("Shutting down FinAlly backend")
    await state.market_source.stop()


app = FastAPI(title="FinAlly", lifespan=lifespan)

stream_router = create_stream_router(state.price_cache)
app.include_router(stream_router)


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}
