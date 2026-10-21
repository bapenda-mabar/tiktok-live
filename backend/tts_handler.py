import asyncio
import base64
import io
import edge_tts

VOICE = "id-ID-ArdiNeural"

async def text_to_audio_base64(text: str) -> str:
    communicate = edge_tts.Communicate(text, VOICE)
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")
