"""Tests for app.state singleton exports."""

import pytest


def test_price_cache_is_pricecache():
    from app.market import PriceCache
    from app.state import price_cache
    assert isinstance(price_cache, PriceCache)


def test_market_source_is_marketdatasource():
    from app.market import MarketDataSource
    from app.state import market_source
    assert isinstance(market_source, MarketDataSource)


def test_snapshot_task_initially_none():
    from app.state import snapshot_task
    assert snapshot_task is None


def test_api_package_importable():
    import app.api
