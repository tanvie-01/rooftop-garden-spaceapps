"""Gemini-র ভেতরের ব্যাকআপ: কোটা শেষ হলে পরের মডেল, অন্য ভুলে থামা। আসল API ডাকা হয় না।"""
import asyncio
from types import SimpleNamespace

import pytest
from pydantic import BaseModel

import llm


class A(BaseModel):
    answer: str


class QuotaError(Exception):
    code = 429


class FakeModels:
    def __init__(self, fail: dict):
        self.fail, self.calls = fail, []

    def generate_content(self, model, contents, config):
        self.calls.append(model)
        if model in self.fail:
            raise self.fail[model]
        return SimpleNamespace(parsed=A(answer=f"from {model}"), text="", usage_metadata=None)


def run(monkeypatch, models, fail):
    fake = FakeModels(fail)
    monkeypatch.setattr(llm, "client", SimpleNamespace(models=fake))
    monkeypatch.setattr(llm, "GEMINI_MODELS", models)
    out = asyncio.run(llm._gemini_json("sys", [("user", "q")], A, 0.4))
    return out, fake.calls


def test_quota_moves_to_next_model(monkeypatch):
    (obj, meta), calls = run(monkeypatch, ["m1", "m2", "m3"], {"m1": QuotaError("RESOURCE_EXHAUSTED")})
    assert obj.answer == "from m2" and meta["model"] == "m2"
    assert calls == ["m1", "m2"]


class GoneError(Exception):
    code = 404


def test_retired_model_moves_to_next(monkeypatch):
    (obj, meta), calls = run(monkeypatch, ["old", "m2"], {"old": GoneError("404 NOT_FOUND")})
    assert meta["model"] == "m2" and calls == ["old", "m2"]


def test_default_fallbacks_skip_primary():
    assert llm.GEMINI_MODELS[0] == llm.MODEL and llm.MODEL not in llm.FALLBACK_MODELS


def test_first_model_used_when_it_works(monkeypatch):
    (obj, meta), calls = run(monkeypatch, ["m1", "m2"], {})
    assert meta["model"] == "m1" and calls == ["m1"]


def test_other_errors_do_not_burn_backup_quota(monkeypatch):
    with pytest.raises(ValueError):
        run(monkeypatch, ["m1", "m2"], {"m1": ValueError("bad request")})


def test_all_quotas_gone_reports_quota(monkeypatch):
    # সব মডেলের কোটা শেষ: generate_json "quota" দেয়, তখন চ্যাট নিজেদের গাইড থেকে উত্তর দেয়
    fake = FakeModels({"m1": QuotaError("x"), "m2": QuotaError("x")})
    monkeypatch.setattr(llm, "client", SimpleNamespace(models=fake))
    monkeypatch.setattr(llm, "GEMINI_MODELS", ["m1", "m2"])
    monkeypatch.setattr(llm, "PROVIDERS", ["gemini"])
    with pytest.raises(llm.LLMUnavailable) as e:
        asyncio.run(llm.generate_json("sys", [("user", "q")], A))
    assert e.value.reason == "quota" and fake.calls == ["m1", "m2"]


def test_thinking_config_per_model():
    assert llm.thinking_config("gemini-2.5-flash-lite").thinking_budget == 0
    assert llm.thinking_config("gemini-3.1-flash-lite").thinking_level is not None
