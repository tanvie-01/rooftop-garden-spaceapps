"""ভাষা-মডেল এক জায়গায়: Gemini (ফ্রি প্ল্যান) আর ঐচ্ছিকভাবে লোকাল Ollama মডেল।

Gemini-র ভেতরেও ব্যাকআপ: প্রধান মডেলের কোটা শেষ হলে GEMINI_FALLBACK_MODELS একে একে (একই key)।

LLM_PROVIDERS-এ যে ক্রমে লেখা, সেই ক্রমে চেষ্টা হয় (যেমন "gemini,ollama")। একটা কোটা শেষ
বা ব্যর্থ হলে পরেরটা। সবগুলো ব্যর্থ হলে LLMUnavailable; তখন চ্যাট নিজেদের গাইড থেকে উত্তর দেয়।
Embedding (knowledge base খোঁজা) শুধু Gemini দিয়ে।
"""
import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(Path(__file__).resolve().parent / ".env")

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
# ব্যাকআপ মডেল, একই key দিয়ে। ফ্রি প্ল্যানে প্রতিটা মডেলের দৈনিক কোটা আলাদা, তাই প্রধান মডেলের
# কোটা শেষ হলে এগুলো একে একে চেষ্টা হয়। ফাঁকা রাখলে ব্যাকআপ বন্ধ।
FALLBACK_MODELS = [m.strip() for m in os.getenv(
    "GEMINI_FALLBACK_MODELS", "gemini-3.1-flash-lite,gemini-3.5-flash,gemini-2.5-flash").split(",")
    if m.strip() and m.strip() != MODEL]
GEMINI_MODELS = [MODEL] + FALLBACK_MODELS
EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "gemini-embedding-001")
EMBED_DIM = 768
EMBED_BATCH = 50

client = genai.Client(api_key=API_KEY) if API_KEY else None

PROVIDERS = [p.strip() for p in os.getenv("LLM_PROVIDERS", "gemini").split(",") if p.strip()]
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
LLM_TIMEOUT_S = float(os.getenv("LLM_TIMEOUT_S", "90"))


class LLMUnavailable(Exception):
    """কোনো মডেল উত্তর দিতে পারেনি। reason: quota / error / not_configured"""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def is_quota_error(e: Exception) -> bool:
    return "RESOURCE_EXHAUSTED" in str(e) or getattr(e, "code", None) == 429


async def _gemini_json(system: str, turns: list[tuple[str, str]], schema, temperature: float):
    if client is None:
        raise LLMUnavailable("not_configured")
    contents = [
        types.Content(role="user" if role == "user" else "model", parts=[types.Part(text=text)])
        for role, text in turns
    ]
    # কোটা শেষ বা মডেল বন্ধ (Google পুরোনো মডেল সরিয়ে দেয়, 404) হলেই শুধু পরের মডেলে যাওয়া;
    # অন্য ভুল (যেমন খারাপ উত্তর) হলে সাথে সাথে থামা, নইলে একই ভুল প্রশ্নে সব মডেলের কোটা খরচ হতো
    for i, model in enumerate(GEMINI_MODELS):
        try:
            # sync client আলাদা thread-এ (embed_query-র মতোই কারণে)
            res = await asyncio.wait_for(asyncio.to_thread(
                client.models.generate_content,
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    temperature=temperature,
                    max_output_tokens=1500,
                    response_mime_type="application/json",
                    response_schema=schema,
                    thinking_config=thinking_config(model),
                ),
            ), LLM_TIMEOUT_S)
        except Exception as e:
            gone = getattr(e, "code", None) == 404 or "NOT_FOUND" in str(e)
            if (is_quota_error(e) or gone) and i + 1 < len(GEMINI_MODELS):
                print(f"Gemini {'মডেল নেই' if gone else 'quota শেষ'} ({model}), পরের মডেল: {GEMINI_MODELS[i + 1]}")
                continue
            raise
        obj = res.parsed if isinstance(res.parsed, schema) else schema.model_validate_json(res.text)
        u = res.usage_metadata
        return obj, {
            "provider": "gemini", "model": model,
            "prompt_tokens": (u.prompt_token_count or 0) if u else 0,
            "output_tokens": (u.candidates_token_count or 0) if u else 0,
        }


async def _ollama_json(system: str, turns: list[tuple[str, str]], schema, temperature: float):
    import httpx

    messages = [{"role": "system", "content": system}] + [
        {"role": "user" if role == "user" else "assistant", "content": text} for role, text in turns
    ]
    async with httpx.AsyncClient(timeout=LLM_TIMEOUT_S) as http:
        r = await http.post(f"{OLLAMA_URL}/api/chat", json={
            "model": OLLAMA_MODEL, "messages": messages, "stream": False,
            "format": schema.model_json_schema(), "options": {"temperature": temperature},
        })
        r.raise_for_status()
        d = r.json()
    obj = schema.model_validate(json.loads(d["message"]["content"]))
    return obj, {
        "provider": "ollama", "model": OLLAMA_MODEL,
        "prompt_tokens": d.get("prompt_eval_count", 0), "output_tokens": d.get("eval_count", 0),
    }


async def generate_json(system: str, turns: list[tuple[str, str]], schema, temperature: float = 0.4):
    """turns: [(role, text)], role = user / assistant। ফেরত দেয় (schema object, usage dict)।"""
    reasons = []
    for name in PROVIDERS:
        fn = {"gemini": _gemini_json, "ollama": _ollama_json}.get(name)
        if fn is None:
            continue
        try:
            return await fn(system, turns, schema, temperature)
        except LLMUnavailable as e:
            reasons.append(e.reason)
        except Exception as e:
            print(f"LLM error ({name}):", str(e)[:300])  # বিস্তারিত শুধু terminal-এ
            reasons.append("quota" if is_quota_error(e) else "error")
    raise LLMUnavailable("quota" if "quota" in reasons else reasons[0] if reasons else "not_configured")


def thinking_config(model: str = MODEL) -> types.ThinkingConfig:
    """কম চিন্তা = দ্রুত ও সস্তা উত্তর। Gemini 2.x নেয় thinking_budget, 3.x নেয় thinking_level
    (3.x-এ thinking_budget=0 দিলে 400 INVALID_ARGUMENT আসে)।"""
    if model.startswith("gemini-2"):
        return types.ThinkingConfig(thinking_budget=0)
    return types.ThinkingConfig(thinking_level="low")


def normalize(v: list[float]) -> list[float]:
    # ৭৬৮ মাত্রায় ছোট করা embedding নিজে থেকে normalized থাকে না
    n = sum(x * x for x in v) ** 0.5 or 1.0
    return [x / n for x in v]


def embed(texts: list[str], task: str) -> list[list[float]]:
    """task: RETRIEVAL_DOCUMENT (ডকুমেন্টের অংশ) বা RETRIEVAL_QUERY (প্রশ্ন)।"""
    if client is None:
        raise RuntimeError("GEMINI_API_KEY সেট করা নেই")
    out = []
    for i in range(0, len(texts), EMBED_BATCH):
        res = client.models.embed_content(
            model=EMBED_MODEL,
            contents=texts[i:i + EMBED_BATCH],
            config=types.EmbedContentConfig(task_type=task, output_dimensionality=EMBED_DIM),
        )
        out.extend(normalize(e.values) for e in res.embeddings)
    return out


async def embed_query(text: str) -> list[float]:
    # sync client আলাদা thread-এ: async client একটা event loop-এ বাঁধা পড়ে যায়
    return (await asyncio.to_thread(embed, [text], "RETRIEVAL_QUERY"))[0]
