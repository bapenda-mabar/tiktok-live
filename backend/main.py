import asyncio
import json
import time
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from config import config
from ai_processor import processor
from tts_handler import text_to_audio_base64
import tiktok_handler

app = FastAPI()

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

# Priority queue: (priority, timestamp, event_dict)
event_queue: asyncio.PriorityQueue = asyncio.PriorityQueue(maxsize=50)

# Active WebSocket connections
_connections: set[WebSocket] = set()

# Last join time — for idle-based join processing
_last_activity_time: float = time.monotonic()
_waiting_for_done: bool = False


async def broadcast(data: dict):
    dead = set()
    for ws in _connections:
        try:
            await ws.send_json(data)
        except Exception:
            dead.add(ws)
    _connections.difference_update(dead)


async def queue_worker():
    global _last_activity_time, _waiting_for_done

    while True:
        try:
            priority, ts, event = await asyncio.wait_for(event_queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            continue

        # Join events: only process when idle > 10s
        if event.get("type") == "join":
            if time.monotonic() - _last_activity_time < 10:
                event_queue.task_done()
                continue

        if not config.gemini_api_key:
            event_queue.task_done()
            continue

        try:
            reply = await processor.process(event)
        except Exception as e:
            print(f"[AI] Error: {e}")
            event_queue.task_done()
            continue

        if not reply:
            event_queue.task_done()
            continue

        try:
            audio_b64 = await text_to_audio_base64(reply)
        except Exception as e:
            print(f"[TTS] Error: {e}")
            event_queue.task_done()
            continue

        _last_activity_time = time.monotonic()
        _waiting_for_done = True

        await broadcast({
            "type": "speak",
            "text": reply,
            "event_type": event.get("type"),
            "sender": event.get("sender", ""),
            "audioBase64": audio_b64,
        })

        # Wait for frontend "done" signal (max 30s)
        for _ in range(300):
            await asyncio.sleep(0.1)
            if not _waiting_for_done:
                break

        _waiting_for_done = False
        event_queue.task_done()


@app.on_event("startup")
async def startup():
    asyncio.create_task(queue_worker())


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    global _waiting_for_done

    await ws.accept()
    _connections.add(ws)
    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "done":
                _waiting_for_done = False

            elif msg_type == "connect":
                username = msg.get("username", "").strip()
                if username:
                    config.update(tiktok_username=username)
                    ok = await tiktok_handler.connect(username, event_queue)
                    await ws.send_json({"type": "status", "connected": ok, "username": username})

            elif msg_type == "disconnect":
                await tiktok_handler.disconnect()
                await ws.send_json({"type": "status", "connected": False})

            elif msg_type == "config":
                config.update(
                    gemini_api_key=msg.get("gemini_key", ""),
                    system_prompt=msg.get("system_prompt", ""),
                    host_name=msg.get("host_name", ""),
                )
                await ws.send_json({"type": "config_saved"})

            elif msg_type == "simulate_comment":
                event_queue.put_nowait((2, time.monotonic(), {
                    "type": "comment",
                    "sender": msg.get("name", "Tester"),
                    "text": msg.get("text", "halo"),
                }))

            elif msg_type == "simulate_gift":
                event_queue.put_nowait((1, time.monotonic(), {
                    "type": "gift",
                    "sender": msg.get("name", "Tester"),
                    "gift": msg.get("gift", "Rose"),
                    "count": msg.get("count", 1),
                }))

    except WebSocketDisconnect:
        _connections.discard(ws)
    except Exception as e:
        print(f"[WS] Error: {e}")
        _connections.discard(ws)


app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")
