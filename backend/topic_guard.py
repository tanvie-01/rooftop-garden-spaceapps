"""চ্যাটবট শুধু বাগান নিয়ে: backend-এর নিজস্ব যাচাই (শুধু prompt-এর উপর ভরসা নয়)।

ধাপ:
1. নির্দেশনা ভাঙার চেষ্টা ("ignore previous instructions", "system prompt", "api key") → আটকানো
2. বাগানের শব্দ (বাংলা / ইংরেজি / Banglish, ক্যাটালগের গাছের নাম) → চলবে
3. স্পষ্টভাবে অন্য বিষয়ের শব্দ (খেলা, রাজনীতি, কোডিং...) → আটকানো, মডেল ডাকা হয় না
4. চলমান কথোপকথনে ছোট পাল্টা প্রশ্ন ("keno?", "how much?") → চলবে
5. বাকিগুলো: embedding দিয়ে বাগান বনাম অন্য বিষয়ের উদাহরণের সাথে মিল। স্পষ্টভাবে অন্য বিষয়
   হলে আটকানো; সন্দেহ হলে মডেলের কাছে যায়, আর মডেলের in_scope উত্তর কোডে আবার মেলানো হয়।
আসল বাগানের প্রশ্ন ভুল করে আটকানো এড়াতে সন্দেহের ক্ষেত্রে "চলবে" দিকে ঝোঁকা হয়েছে।
"""
import re
from dataclasses import dataclass
from typing import Optional

import llm
from plants import CATALOG

INJECTION = re.compile(
    r"ignore (all |the )?(previous|above|prior|earlier) (instructions|rules|prompts?)|"
    r"system prompt|hidden (instructions|prompt)|developer mode|jailbreak|"
    r"api[ _-]?key|secret key|\.env\b|reveal (your|the) (instructions|prompt|rules)|"
    r"(আগের|উপরের) (সব )?(নির্দেশ|নিয়ম) (ভুলে|বাদ|মানবে না)|তোমার (গোপন |ভেতরের )?(নির্দেশনা|prompt) (দেখাও|বলো)|"
    r"ager (sob )?(nirdesh|niyom) (bhule|vule|bad)",
    re.IGNORECASE,
)

_crop_names = "|".join(
    sorted({re.escape(n) for c in CATALOG for n in (c["name"].split(" (")[0], c["name_bn"]) if n}, key=len, reverse=True)
)

GARDEN = re.compile(
    # বাংলা
    r"গাছ|চারা|বীজ|পাতা|ফুল|ফল|সবজি|শাক|মাটি|সার|কম্পোস্ট|সেচ|টব|ছাদ|বাগান|রোপণ|লাগা|ছাঁট|কলম|"
    r"পোকা|রোগ|ছত্রাক|আগাছা|ফসল|কীট|জৈব|গোবর|কেঁচো|মালচ|অঙ্কুর|শিকড়|ডাল|কুঁড়ি|ফলন|চাষ|পানি দ|"
    # English
    r"\b(plants?|planting|garden\w*|seeds?|seedlings?|lea(f|ves)|flowers?|fruits?|vegetables?|veggies?|"
    r"soil|compost\w*|fertili[sz]\w*|manure|watering|irrigat\w*|pots?|potting|containers?|rooftop|terrace|"
    r"balcony|prun\w*|graft\w*|propagat\w*|pests?|insects?|aphids?|mealybugs?|whitefl\w*|mites?|"
    r"diseases?|fung\w*|blight|mildew|rot|weeds?|crops?|harvest\w*|grow\w*|sow\w*|transplant\w*|mulch\w*|"
    r"ph|nitrogen|npk|roots?|stems?|buds?|bloom\w*|germinat\w*|sunlight|shade|cocopeat|vermi\w*|herbs?)\b|"
    # Banglish
    r"\b(gach\w*|gas\b|chara|bij|pata|phul|ful|fol|phol|shobji|sobji|shak|mati|sar|tob|chad|chhad|bagan|"
    r"pani|poka|rog|lagabo|lagano|lagaite|chash|foshol|fosol|gobor|kompost)\b|"
    rf"{_crop_names}",
    re.IGNORECASE,
)

OFF_TOPIC = re.compile(
    r"\b(politic\w*|election\w*|president|prime minister|cricket|football|world cup|movies?|films?|songs?|"
    r"music|actor|actress|celebrity|coding|code|python|javascript|java|programming|html|css|sql|bitcoin|"
    r"crypto\w*|stocks?|forex|homework|exam|essay|math\w*|equation|poem|joke|bet(ting)?|"
    r"khela|rajniti|cinema|gaan|natok)\b|"
    r"রাজনীতি|নির্বাচন|খেলা|ক্রিকেট|ফুটবল|সিনেমা|গান|নাটক|প্রোগ্রামিং|কোড|অংক|গণিত|কবিতা|কৌতুক",
    re.IGNORECASE,
)

BANGLISH = re.compile(
    r"\b(ami|amar|tumi|tomar|apni|ki|kivabe|kibhabe|keno|kemon|koto|kobe|kothay|dibo|debo|korbo|korte|"
    r"hobe|hoy|hoyeche|hocche|ache|nai|valo|bhalo|ekhon|aj|kal|din|bolo|dao|er|e|te|"
    r"gach\w*|chara|pata|patar|phul|ful|fol|phol|shobji|sobji|shak|mati|sar|tob|chad|chhad|bagan|pani|poka|rog|"
    r"morich|begun|lebu|golap|holud|kokrano|shukiye|pocha|lagabo|lagano)\b",
    re.IGNORECASE,
)
ENGLISH = re.compile(
    r"\b(the|a|an|is|are|my|your|how|what|why|when|which|should|can|do|does|i|to|of|in|on|and|for|with|it)\b",
    re.IGNORECASE,
)

GARDEN_EXAMPLES = [
    "How often should I water tomato plants in pots?",
    "Which vegetables can I grow on my rooftop in summer?",
    "My chili leaves are curling, what should I do?",
    "What is the best potting mix for a terrace garden?",
    "টমেটো গাছের পাতা হলুদ হয়ে যাচ্ছে কেন?",
    "ছাদে কোন ফুল গাছ লাগানো যায়?",
    "টবের মাটিতে কতদিন পরপর জৈব সার দেব?",
    "morich gache koto din por por pani dibo?",
    "chader bagane ki ki shobji lagano jay?",
    "Will heavy rain tomorrow harm my seedlings?",
]
OFF_EXAMPLES = [
    "Who won the football world cup?",
    "Write a Python function to sort a list.",
    "Explain the latest election results.",
    "Tell me a joke about cats.",
    "Solve this math equation for x.",
    "বাংলাদেশের প্রধানমন্ত্রী কে?",
    "একটা ভালো সিনেমার নাম বলো।",
    "আমার পরীক্ষার রচনা লিখে দাও।",
    "ajker cricket match er score koto?",
    "Translate this paragraph into French.",
]
SEMANTIC_MARGIN = 0.03   # অন্য-বিষয়ের মিল এতটা বেশি হলে তবেই আটকানো
SEMANTIC_GARDEN_OK = 0.62  # বাগানের উদাহরণের সাথে মিল এর বেশি হলে চলবে
FOLLOWUP_MAX_WORDS = 6

REFUSAL = {
    "bn": "আমি শুধু ছাদবাগান আর গাছের যত্ন নিয়ে সাহায্য করতে পারি। গাছ, মাটি, সার, পানি, পোকা-রোগ, ফসল বা বাগানের আবহাওয়া নিয়ে প্রশ্ন করো।",
    "en": "I can only help with rooftop gardening and plant care. Please ask about plants, soil, fertilizer, watering, pests, diseases, crops or garden weather.",
}
INJECTION_REPLY = {
    "bn": "আমি আমার ভেতরের নির্দেশনা বা কোনো গোপন তথ্য দেখাতে পারি না। বাগান নিয়ে কোনো প্রশ্ন থাকলে করো।",
    "en": "I can't share my internal instructions or any secrets. Feel free to ask a gardening question.",
}


@dataclass
class GuardResult:
    allowed: bool
    reason: str      # injection / garden_keyword / off_keyword / followup / semantic_garden / semantic_off / unsure
    lang: str        # bn / en (Banglish প্রশ্নের উত্তর বাংলায়)
    message: str = ""


def detect_lang(text: str) -> str:
    letters = [ch for ch in text if ch.isalpha()]
    bangla = sum(1 for ch in letters if "ঀ" <= ch <= "৿")
    if letters and bangla / len(letters) >= 0.3:
        return "bn"
    # Banglish: রোমান হরফে বাংলা। ইংরেজির সাধারণ শব্দ না থাকলে একটা বাংলা শব্দই যথেষ্ট
    bn_words, en_words = len(BANGLISH.findall(text)), len(ENGLISH.findall(text))
    return "bn" if (bn_words >= 2 and bn_words > en_words) or (bn_words >= 1 and en_words == 0) else "en"


_example_vecs: Optional[tuple[list, list]] = None


async def _examples():
    global _example_vecs
    if _example_vecs is None:
        import asyncio
        vecs = await asyncio.to_thread(llm.embed, GARDEN_EXAMPLES + OFF_EXAMPLES, "RETRIEVAL_QUERY")
        _example_vecs = (vecs[:len(GARDEN_EXAMPLES)], vecs[len(GARDEN_EXAMPLES):])
    return _example_vecs


def _best(qv, vecs) -> float:
    return max(sum(a * b for a, b in zip(qv, v)) for v in vecs)


def quick_check(question: str, has_history: bool) -> Optional[GuardResult]:
    """শব্দ দেখে সিদ্ধান্ত (নেটওয়ার্ক লাগে না)। সিদ্ধান্ত না হলে None।"""
    lang = detect_lang(question)
    if INJECTION.search(question):
        return GuardResult(False, "injection", lang, INJECTION_REPLY[lang])
    if GARDEN.search(question):
        return GuardResult(True, "garden_keyword", lang)
    if OFF_TOPIC.search(question):
        return GuardResult(False, "off_keyword", lang, REFUSAL[lang])
    if has_history and len(question.split()) <= FOLLOWUP_MAX_WORDS:
        return GuardResult(True, "followup", lang)
    return None


async def check(question: str, has_history: bool, query_vector=None) -> GuardResult:
    """query_vector: knowledge base খোঁজার জন্য যে embedding লাগে সেটাই (একবারই বানানো হয়)।"""
    quick = quick_check(question, has_history)
    if quick:
        return quick
    lang = detect_lang(question)
    try:
        qv = query_vector or await llm.embed_query(question)
        garden_vecs, off_vecs = await _examples()
    except Exception as e:  # embedding না এলে মডেলই সিদ্ধান্ত নেবে
        print("Topic guard embedding error:", str(e)[:200])
        return GuardResult(True, "unsure", lang)
    g, o = _best(qv, garden_vecs), _best(qv, off_vecs)
    if g >= SEMANTIC_GARDEN_OK and g >= o:
        return GuardResult(True, "semantic_garden", lang)
    if o - g >= SEMANTIC_MARGIN:
        return GuardResult(False, "semantic_off", lang, REFUSAL[lang])
    return GuardResult(True, "unsure", lang)
