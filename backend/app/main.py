"""FinAlly FastAPI application entrypoint."""

import asyncio
import logging
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Load .env from project root before any env var reads
load_dotenv(Path(__file__).parent.parent.parent / ".env")

STATIC_DIR = Path("/app/static")

import app.state as state  # noqa: E402
from app.api.chat import router as chat_router  # noqa: E402
from app.api.portfolio import record_portfolio_snapshot, router as portfolio_router  # noqa: E402
from app.api.watchlist import router as watchlist_router  # noqa: E402
from app.db import get_db_path, init_db  # noqa: E402
from app.market import create_stream_router  # noqa: E402
from app.market.seed_prices import SEED_PRICES  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def snapshot_loop() -> None:
    while True:
        await asyncio.sleep(30)
        try:
            record_portfolio_snapshot(get_db_path(), state.price_cache)
        except Exception:
            logger.exception("Snapshot failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB, start market data, snapshot task. Shutdown: cancel tasks, stop market data."""
    logger.info("Starting FinAlly backend")
    init_db()
    with sqlite3.connect(get_db_path()) as conn:
        rows = conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id='default'"
        ).fetchall()
    tickers_to_track = [r[0] for r in rows] or list(SEED_PRICES.keys())
    await state.market_source.start(tickers_to_track)
    try:
        record_portfolio_snapshot(get_db_path(), state.price_cache)
    except Exception:
        logger.exception("Initial snapshot failed")
    state.snapshot_task = asyncio.create_task(snapshot_loop(), name="snapshot-loop")
    yield
    logger.info("Shutting down FinAlly backend")
    if state.snapshot_task and not state.snapshot_task.done():
        state.snapshot_task.cancel()
        try:
            await state.snapshot_task
        except asyncio.CancelledError:
            pass
    await state.market_source.stop()


app = FastAPI(title="FinAlly", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

stream_router = create_stream_router(state.price_cache)
app.include_router(stream_router)
app.include_router(portfolio_router, prefix="/api")
app.include_router(watchlist_router, prefix="/api")
app.include_router(chat_router, prefix="/api")


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


# Serve static files only when the directory exists (production/Docker)
# Must be registered after all API routes so /api/* routes take precedence.
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
