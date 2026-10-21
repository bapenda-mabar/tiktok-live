from dataclasses import dataclass, field
from dotenv import load_dotenv
import os

load_dotenv()

@dataclass
class Config:
    gemini_api_key: str = field(default_factory=lambda: os.getenv("GEMINI_API_KEY", ""))
    tiktok_username: str = field(default_factory=lambda: os.getenv("TIKTOK_USERNAME", ""))
    host_name: str = field(default_factory=lambda: os.getenv("HOST_NAME", "AI Host"))
    system_prompt: str = field(default_factory=lambda: (
        "Kamu adalah {host_name}, AI host TikTok Live yang energik dan ramah. "
        "Gunakan bahasa Indonesia santai/gaul. Jawab SINGKAT maksimal 1-2 kalimat (15-25 kata). "
        "Selalu sebut nama penonton. Jadilah natural seperti streamer sungguhan."
    ))

    def update(self, **kwargs):
        for key, value in kwargs.items():
            if hasattr(self, key) and value:
                setattr(self, key, value)

config = Config()
