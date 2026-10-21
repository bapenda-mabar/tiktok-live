import asyncio
import time
from TikTokLive import TikTokLiveClient
from TikTokLive.events import ConnectEvent, DisconnectEvent, CommentEvent, GiftEvent, FollowEvent

_client: TikTokLiveClient | None = None
_queue: asyncio.PriorityQueue | None = None


def _push(priority: int, event_dict: dict):
    if _queue is not None:
        try:
            _queue.put_nowait((priority, time.monotonic(), event_dict))
        except asyncio.QueueFull:
            pass


async def connect(username: str, queue: asyncio.PriorityQueue) -> bool:
    global _client, _queue
    _queue = queue

    if _client is not None:
        try:
            await _client.disconnect()
        except Exception:
            pass

    _client = TikTokLiveClient(unique_id=username)

    @_client.on(ConnectEvent)
    async def on_connect(event: ConnectEvent):
        print(f"[TikTok] Connected to @{username}")

    @_client.on(CommentEvent)
    async def on_comment(event: CommentEvent):
        _push(2, {
            "type": "comment",
            "sender": event.user.nickname or event.user.unique_id,
            "text": event.comment,
        })

    @_client.on(GiftEvent)
    async def on_gift(event: GiftEvent):
        if event.gift.repeat_end:
            _push(1, {
                "type": "gift",
                "sender": event.user.nickname or event.user.unique_id,
                "gift": event.gift.name,
                "count": event.repeat_count,
            })

    @_client.on(FollowEvent)
    async def on_join(event: FollowEvent):
        _push(3, {
            "type": "join",
            "sender": event.user.nickname or event.user.unique_id,
        })

    try:
        asyncio.create_task(_client.start())
        return True
    except Exception as e:
        print(f"[TikTok] Connect error: {e}")
        return False


async def disconnect():
    global _client
    if _client is not None:
        try:
            await _client.disconnect()
        except Exception:
            pass
        _client = None
