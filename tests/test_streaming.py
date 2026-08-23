"""Streaming is load-bearing: the router abandons slow non-stream responses,
which is exactly what a thinking model produces. These tests drive the client
against a fake SSE endpoint rather than mocking its internals."""

import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "packages"))

import asyncio
import json
import unittest

import httpx

from azbench.nexum import NexumClient, ProviderError


def sse(*events) -> bytes:
    out = []
    for e in events:
        out.append(f"data: {json.dumps(e)}\n\n")
    out.append("data: [DONE]\n\n")
    return "".join(out).encode()


def client_with(handler) -> NexumClient:
    return NexumClient("test-key", "https://provider.test/v1",
                       transport=httpx.MockTransport(handler))


def run(coro):
    return asyncio.run(coro)


def delta(content=None, reasoning=None, finish=None):
    d = {}
    if content is not None:
        d["content"] = content
    if reasoning is not None:
        d["reasoning_content"] = reasoning
    return {"choices": [{"delta": d, "finish_reason": finish}]}


class TestStreaming(unittest.TestCase):
    def _complete(self, body: bytes, status: int = 200, **kw):
        def handler(request):
            return httpx.Response(status, content=body)
        c = client_with(handler)
        return run(c.complete("m", "prompt", attempts=1, **kw))

    def test_content_deltas_are_joined(self):
        body = sse(delta("Hörmətli "), delta("müştəri,"), delta(finish="stop"),
                   {"usage": {"prompt_tokens": 10, "completion_tokens": 5}})
        c = self._complete(body)
        self.assertEqual(c.text, "Hörmətli müştəri,")
        self.assertEqual(c.finish_reason, "stop")
        self.assertEqual(c.completion_tokens, 5)

    def test_reasoning_deltas_never_become_the_answer(self):
        body = sse(delta(reasoning="plan qururam"), delta(reasoning="hələ də"),
                   delta(finish="length"),
                   {"usage": {"completion_tokens": 1500,
                              "completion_tokens_details": {"reasoning_tokens": 1500}}})
        c = self._complete(body)
        self.assertEqual(c.text, "")
        self.assertTrue(c.had_reasoning)
        self.assertTrue(c.truncated)
        self.assertIn("truncated", c.emptiness_reason())

    def test_inline_think_block_is_stripped_across_chunks(self):
        body = sse(delta("<think>plan"), delta("ı yazıram</think>"), delta("Salam."),
                   delta(finish="stop"))
        self.assertEqual(self._complete(body).text, "Salam.")

    def test_router_timeout_event_is_retryable(self):
        body = sse({"error": {"message": "DialagramRouter ran out of time for this "
                                         "non-stream response"}})
        with self.assertRaises(ProviderError) as ctx:
            self._complete(body)
        self.assertTrue(ctx.exception.retryable)
        self.assertIn("ran out of time", str(ctx.exception))

    def test_http_429_is_retryable(self):
        with self.assertRaises(ProviderError) as ctx:
            self._complete(b"rate limited", status=429)
        self.assertEqual(ctx.exception.status, 429)
        self.assertTrue(ctx.exception.retryable)

    def test_http_400_is_not_retryable(self):
        with self.assertRaises(ProviderError) as ctx:
            self._complete(b"bad model", status=400)
        self.assertFalse(ctx.exception.retryable)

    def test_keepalive_comments_and_blank_lines_are_ignored(self):
        body = b": ping\n\n" + sse(delta("Salam."), delta(finish="stop"))
        self.assertEqual(self._complete(body).text, "Salam.")

    def test_the_request_asks_for_streaming(self):
        seen = {}

        def handler(request):
            seen.update(json.loads(request.content))
            return httpx.Response(200, content=sse(delta("ok"), delta(finish="stop")))

        run(client_with(handler).complete("m", "p", attempts=1))
        self.assertTrue(seen.get("stream"))
        self.assertEqual(seen.get("stream_options"), {"include_usage": True})


if __name__ == "__main__":
    unittest.main(verbosity=2)
