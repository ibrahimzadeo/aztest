"""Nexum Router client — OpenAI-compatible chat completions.

Nexum (https://dialagram.me/router/v1) serves BARE model ids (no `vendor/`
prefix), charges a flat weekly fee (so per-token pricing is whatever the
operator sets by hand in Settings), and returns HTTP 429 at concurrency 4.
Its /models endpoint is slow (~18s) and is the only reliable source of the
model list — the marketing page under-reports it.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import re
import time
from dataclasses import dataclass, field

import httpx

log = logging.getLogger("azbench.nexum")

DEFAULT_BASE_URL = "https://dialagram.me/router/v1"
# /models has been measured at ~18s; anything under 20s times out spuriously.
CATALOG_TIMEOUT_S = 45.0
# Reasoning models here have run 165s and 9k output tokens. The read timeout
# applies per chunk while streaming, so it bounds a stall, not the answer.
CHAT_TIMEOUT = httpx.Timeout(connect=30.0, read=180.0, write=30.0, pool=30.0)
# Nexum 429s at concurrency 4, so 3 is the ceiling for in-flight requests.
SAFE_CONCURRENCY = 3


class ProviderError(RuntimeError):
    """A call to the provider failed in a way the caller should surface."""

    def __init__(self, message: str, *, status: int | None = None, retryable: bool = False):
        super().__init__(message)
        self.status = status
        self.retryable = retryable


@dataclass
class Completion:
    text: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0
    model: str = ""
    finish_reason: str = ""
    reasoning_tokens: int = 0
    had_reasoning: bool = False
    raw_usage: dict = field(default_factory=dict)

    @property
    def truncated(self) -> bool:
        """The provider stopped us at the token cap rather than at an ending."""
        return self.finish_reason == "length"

    def emptiness_reason(self) -> str | None:
        """Why there is no answer to score, or None if there is one.

        A reasoning model can spend its whole completion budget thinking and
        return nothing. That is a configuration problem, not bad writing, and
        it must never reach the judge as an empty answer to score.
        """
        if self.text.strip():
            return None
        if self.truncated:
            return (
                f"truncated: the whole {self.completion_tokens}-token budget went to "
                "reasoning and no answer was emitted. Raise 'Maks output token' for "
                "this model in Settings -> Modellər (thinking models need several "
                "thousand)."
            )
        if self.had_reasoning:
            return (
                "the model returned reasoning but no answer "
                f"(finish_reason={self.finish_reason or 'unknown'})"
            )
        return f"empty response (finish_reason={self.finish_reason or 'unknown'})"


class NexumClient:
    """Thin async client. One instance per process; it owns an httpx pool."""

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        if not api_key:
            raise ProviderError("no API key configured — set it in Settings")
        self.api_key = api_key
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        # Injectable so the streaming path can be tested against a fake SSE
        # endpoint rather than by mocking this class's internals.
        self._transport = transport

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def list_models(self) -> list[dict]:
        """Return the raw /models entries, sorted by id."""
        async with httpx.AsyncClient(timeout=CATALOG_TIMEOUT_S, transport=self._transport) as client:
            try:
                res = await client.get(f"{self.base_url}/models", headers=self._headers())
            except httpx.RequestError as exc:
                raise ProviderError(f"cannot reach {self.base_url}: {exc}", retryable=True) from exc
        if res.status_code != 200:
            raise ProviderError(
                f"/models returned {res.status_code}: {res.text[:300]}", status=res.status_code
            )
        data = res.json().get("data") or []
        return sorted((m for m in data if m.get("id")), key=lambda m: m["id"])

    async def complete(
        self,
        model: str,
        prompt: str,
        *,
        system: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        attempts: int = 4,
    ) -> Completion:
        """One chat completion, retrying 429/5xx with jittered backoff.

        Retries matter more here than elsewhere: a rate-limited generation
        would otherwise land in the results table as a model failure and skew
        a leaderboard the operator reads as a quality signal.
        """
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        # Always stream. The router abandons a slow non-stream response with
        # "DialagramRouter ran out of time ... Retry with stream", which is
        # exactly what the slowest thinking models hit.
        payload: dict = {
            "model": model,
            "messages": messages,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens:
            payload["max_tokens"] = max_tokens

        last: ProviderError | None = None
        async with httpx.AsyncClient(timeout=CHAT_TIMEOUT, transport=self._transport) as client:
            for attempt in range(1, attempts + 1):
                started = time.monotonic()
                try:
                    return await self._stream_completion(client, payload, model, started)
                except ProviderError as exc:
                    last = exc
                except httpx.RequestError as exc:
                    last = ProviderError(f"request failed: {exc}", retryable=True)
                if not last.retryable or attempt == attempts:
                    raise last
                delay = min(30.0, 2.0 * (2 ** (attempt - 1))) + random.uniform(0, 1.5)
                log.warning("%s attempt %d failed (%s); retry in %.1fs", model, attempt, last, delay)
                await asyncio.sleep(delay)
        raise last or ProviderError("exhausted retries")

    async def _stream_completion(
        self, client: httpx.AsyncClient, payload: dict, model: str, started: float
    ) -> Completion:
        """Consume one SSE stream into a Completion.

        Streaming is not an optimisation here: the router times out on slow
        non-stream responses, and a thinking model is exactly the case that is
        slow. Reasoning deltas are counted but never concatenated into the
        answer — grading the scratchpad would measure the wrong text.
        """
        chunks: list[str] = []
        finish_reason = ""
        usage: dict = {}
        had_reasoning = False
        served_model = ""

        async with client.stream(
            "POST", f"{self.base_url}/chat/completions", headers=self._headers(), json=payload
        ) as res:
            if res.status_code != 200:
                body = (await res.aread()).decode(errors="replace")
                raise ProviderError(
                    f"{res.status_code}: {body[:300]}",
                    status=res.status_code,
                    retryable=res.status_code == 429 or res.status_code >= 500,
                )
            async for line in res.aiter_lines():
                line = line.strip()
                if not line or line.startswith(":"):
                    continue
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                try:
                    event = json.loads(data)
                except json.JSONDecodeError:
                    continue
                if isinstance(event.get("error"), dict):
                    message = str(event["error"].get("message", event["error"]))[:300]
                    # The router's own give-up message is worth retrying.
                    raise ProviderError(f"provider error: {message}", retryable=True)
                served_model = event.get("model") or served_model
                if event.get("usage"):
                    usage = event["usage"]
                for choice in event.get("choices") or []:
                    delta = choice.get("delta") or {}
                    if delta.get("content"):
                        chunks.append(str(delta["content"]))
                    if delta.get("reasoning") or delta.get("reasoning_content"):
                        had_reasoning = True
                    if choice.get("finish_reason"):
                        finish_reason = choice["finish_reason"]

        details = usage.get("completion_tokens_details") or {}
        return Completion(
            text=_strip_thinking("".join(chunks)),
            prompt_tokens=int(usage.get("prompt_tokens") or 0),
            completion_tokens=int(usage.get("completion_tokens") or 0),
            latency_ms=int((time.monotonic() - started) * 1000),
            model=served_model or model,
            finish_reason=finish_reason,
            reasoning_tokens=int(details.get("reasoning_tokens") or 0),
            had_reasoning=had_reasoning,
            raw_usage=usage,
        )


# Some models emit their scratchpad inline in the content instead of in a
# separate field. Scoring that as the answer would grade the thinking, not
# the writing.
_THINK_BLOCK = re.compile(r"<(think|thinking|reasoning)>.*?</\1>", re.S | re.I)
_UNCLOSED_THINK = re.compile(r"^\s*<(think|thinking|reasoning)>.*$", re.S | re.I)


def _strip_thinking(text: str) -> str:
    text = _THINK_BLOCK.sub("", text or "")
    return _UNCLOSED_THINK.sub("", text).strip()


def _parse_completion(body: dict, model: str, started: float) -> Completion:
    latency_ms = int((time.monotonic() - started) * 1000)
    choices = body.get("choices") or []
    if not choices:
        raise ProviderError(f"no choices in response: {str(body)[:300]}")
    message = choices[0].get("message") or {}
    text = _strip_thinking(str(message.get("content") or ""))

    # Reasoning goes in `reasoning` (OpenAI-compatible) or `reasoning_content`
    # (DeepSeek). It is NEVER used as the answer: a writing benchmark that
    # scored the scratchpad would be measuring the wrong text.
    had_reasoning = bool(message.get("reasoning") or message.get("reasoning_content"))

    usage = body.get("usage") or {}
    details = usage.get("completion_tokens_details") or {}
    return Completion(
        text=text,
        prompt_tokens=int(usage.get("prompt_tokens") or 0),
        completion_tokens=int(usage.get("completion_tokens") or 0),
        latency_ms=latency_ms,
        model=body.get("model") or model,
        finish_reason=choices[0].get("finish_reason") or "",
        reasoning_tokens=int(details.get("reasoning_tokens") or 0),
        had_reasoning=had_reasoning,
        raw_usage=usage,
    )


def cost_usd(prompt_tokens: int, completion_tokens: int, in_per_m: float, out_per_m: float) -> float:
    """Cost from operator-set rates. Nexum is flat-fee, so rates default to 0
    and reported cost is 0 until someone sets an effective rate."""
    return (prompt_tokens / 1_000_000) * float(in_per_m or 0) + (
        completion_tokens / 1_000_000
    ) * float(out_per_m or 0)
