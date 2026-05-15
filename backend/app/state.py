"""Module-level singletons shared across the app."""

import asyncio

from app.market import PriceCache, create_market_data_source

price_cache = PriceCache()
market_source = create_market_data_source(price_cache)
snapshot_task: asyncio.Task | None = None
