import re
from collections import deque, defaultdict
from google import genai
from google.genai import types
from config import config


def _is_spam(text: str) -> bool:
    stripped = text.strip()
    if len(stripped) <= 2:
        return True
    # Only emojis / non-alphabetic characters
    clean = re.sub(r'[^\w\s]', '', stripped, flags=re.UNICODE)
    if len(clean.strip()) == 0:
        return True
    return False


class GeminiProcessor:
    def __init__(self):
        self._memory: deque = deque(maxlen=5)
        self._user_spam_tracker: dict = defaultdict(deque)

    def _check_user_spam(self, username: str, text: str) -> bool:
        history = self._user_spam_tracker[username]
        if list(history).count(text) >= 2:
            return True
        history.append(text)
        if len(history) > 10:
            history.popleft()
        return False

    def _build_prompt(self, event: dict) -> str:
        host = config.host_name
        system = config.system_prompt.format(host_name=host)

        memory_ctx = ""
        if self._memory:
            lines = [f"- {m}" for m in self._memory]
            memory_ctx = "\nKonteks percakapan sebelumnya:\n" + "\n".join(lines) + "\n"

        event_type = event.get("type")
        sender = event.get("sender", "seseorang")

        if event_type == "gift":
            gift_name = event.get("gift", "hadiah")
            count = event.get("count", 1)
            user_msg = (
                f"{sender} mengirim gift '{gift_name}' sebanyak {count}x. "
                f"Beri ucapan terima kasih yang antusias, sebut nama dan giftnya."
            )
        elif event_type == "comment":
            text = event.get("text", "")
            user_msg = f"{sender} berkomentar: \"{text}\". Jawab langsung dan nyambung."
        else:  # join
            user_msg = f"{sender} baru saja bergabung. Sapa dan ajak mereka berinteraksi."

        prompt = f"{system}\n{memory_ctx}\nEvent: {user_msg}\nBalas singkat (max 25 kata):"
        return prompt

    async def process(self, event: dict) -> str | None:
        if event.get("type") == "comment":
            text = event.get("text", "")
            sender = event.get("sender", "")
            if _is_spam(text):
                return None
            if self._check_user_spam(sender, text):
                return None

        client = genai.Client(api_key=config.gemini_api_key)
        prompt = self._build_prompt(event)

        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=60,
                temperature=0.9,
            ),
        )

        reply = response.text.strip()
        self._memory.append(f"{event.get('sender')}: {reply}")
        return reply


processor = GeminiProcessor()
