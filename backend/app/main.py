"""FinAlly FastAPI application entrypoint."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

# Load .env from project root before any env var reads
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from app.db import init_db  # noqa: E402
from app.market import PriceCache, create_market_data_source, create_stream_router  # noqa: E402
from app.market.seed_prices import SEED_PRICES  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Module-level singletons so create_stream_router can be called at import time
price_cache = PriceCache()
market_source = create_market_data_source(price_cache)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB, start market data. Shutdown: stop market data."""
    logger.info("Starting FinAlly backend")
    init_db()
    await market_source.start(list(SEED_PRICES.keys()))
    yield
    logger.info("Shutting down FinAlly backend")
    await market_source.stop()


app = FastAPI(title="FinAlly", lifespan=lifespan)

stream_router = create_stream_router(price_cache)
app.include_router(stream_router)


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}
