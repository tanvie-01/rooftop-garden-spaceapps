from datetime import date, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from database import Base

# প্রত্যেক ইউজারের গাছ, মাটির রিপোর্ট আর চ্যাট আলাদা (user_id দিয়ে)।
# লগইনের আগের পুরোনো গাছে user_id ফাঁকা থাকে; প্রথম যে লগইন করে সে এগুলো পায় (auth.py)।


class User(Base):
    """Google (Gmail) দিয়ে লগইন করা ইউজার। পাসওয়ার্ড রাখা হয় না।"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    google_sub = Column(String, unique=True, index=True)   # Google-এর স্থায়ী user id
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, default="")
    picture = Column(String, default="")
    created_at = Column(DateTime, default=datetime.now)
    last_login_at = Column(DateTime, default=datetime.now)


class AuthSession(Base):
    """লগইন সেশন। ব্রাউজারের cookie-তে শুধু token থাকে, ডেটাবেসে তার hash।"""
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now)
    expires_at = Column(DateTime, nullable=False)


class Plant(Base):
    __tablename__ = "plants"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, nullable=False)       # যেমন "Tomato"
    nickname = Column(String, default="")       # যেমন "বারান্দার টমেটো"
    name_bn = Column(String, default="")        # ক্যাটালগে থাকলে বাংলা নাম
    category = Column(String, default="")       # vegetables / fruits / flowers / other
    pot_liters = Column(Float, default=10)
    container = Column(String, default="")      # pot / tub / grow_bag / bed / other
    zone = Column(String, default="")           # ছাদের কোন জায়গায়, ইউজারের লেখা
    soil_type = Column(String, default="")      # Clay / Sandy / Loamy / Black / ফাঁকা = জানা নেই
    sunlight_hours = Column(Float, nullable=True)
    stage = Column(String, default="")          # seedling / growing / flowering / fruiting / mature
    planted_on = Column(Date, default=date.today)
    notes = Column(Text, default="")
    status = Column(String, default="active")   # active / archived
    created_at = Column(DateTime, default=datetime.now)

    reminders = relationship(
        "Reminder", back_populates="plant", cascade="all, delete-orphan"
    )
    observations = relationship(
        "Observation", back_populates="plant", cascade="all, delete-orphan",
        order_by="Observation.observed_at.desc()",
    )
    logs = relationship(
        "TaskLog", back_populates="plant", cascade="all, delete-orphan",
        order_by="TaskLog.logged_at.desc()",
    )


class Reminder(Base):
    """গাছের যত্নের একটা কাজ। every_days = 0 হলে একবারের কাজ।"""
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    task = Column(String, nullable=False)       # water / fertilize / prune / inspect / repot / other
    label = Column(String, default="")          # "other" কাজের নাম
    every_days = Column(Integer, nullable=False)
    last_done = Column(Date, nullable=True)  # ফাঁকা = কাজটা এখনো একবারও করা হয়নি
    due_on = Column(Date, nullable=True)        # snooze/reschedule/মাটি পরীক্ষার পর ঠিক হওয়া তারিখ
    enabled = Column(Boolean, default=True)

    plant = relationship("Plant", back_populates="reminders")


class Observation(Base):
    """মাটি বা গাছের স্বাস্থ্যের একটা পর্যবেক্ষণ: ইউজারের নিজের দেখা, বা পরে সেন্সর থেকে।"""
    __tablename__ = "observations"

    id = Column(Integer, primary_key=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    observed_at = Column(DateTime, default=datetime.now)
    soil_status = Column(String, nullable=True)     # dry / slightly_moist / moist / wet
    health_status = Column(String, nullable=True)   # healthy / monitor / attention
    symptoms = Column(String, default="")           # কমা দিয়ে আলাদা key
    notes = Column(Text, default="")
    source = Column(String, default="user")         # user / sensor

    plant = relationship("Plant", back_populates="observations")


class KnowledgeSource(Base):
    """Shared Plant Knowledge Base-এর একটা ডকুমেন্ট (chatbot ও রোগ শনাক্ত দুটোই এটা ব্যবহার করে)।
    শুধু status == "approved" হলে খোঁজায় আসে।"""
    __tablename__ = "knowledge_sources"

    id = Column(Integer, primary_key=True)
    file_name = Column(String, nullable=False, unique=True)
    file_hash = Column(String, nullable=False)
    title = Column(String, nullable=False)
    publisher = Column(String, default="")
    source_url = Column(String, default="")
    publication_year = Column(Integer, nullable=True)
    language = Column(String, default="")       # bn / en
    region = Column(String, default="")
    plant_species = Column(String, default="")  # কমা দিয়ে, যেমন "tomato,chili"
    topic = Column(String, default="")          # কমা দিয়ে, যেমন "disease,watering"
    license = Column(String, default="")
    version = Column(String, default="1")
    status = Column(String, default="pending")  # pending / approved / obsolete
    reviewed_by = Column(String, default="")
    reviewed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.now)

    chunks = relationship("KnowledgeChunk", back_populates="source", cascade="all, delete-orphan")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(Integer, primary_key=True)
    source_id = Column(Integer, ForeignKey("knowledge_sources.id"), nullable=False)
    page = Column(Integer, nullable=True)       # PDF-এর পাতা; জানা না থাকলে ফাঁকা
    section = Column(String, default="")
    text = Column(Text, nullable=False)
    embedding = Column(Text, nullable=True)     # JSON float list; না থাকলে শুধু keyword খোঁজা
    embedding_model = Column(String, default="")

    source = relationship("KnowledgeSource", back_populates="chunks")


class ChatFeedback(Base):
    __tablename__ = "chat_feedback"

    id = Column(Integer, primary_key=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    helpful = Column(Boolean, nullable=False)
    reason = Column(Text, default="")
    source_ids = Column(String, default="")
    plant_id = Column(Integer, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    # কোন উত্তরের ফিডব্যাক (chat_messages.id)। থাকলে প্রশ্ন-উত্তর সার্ভারের নিজের রাখা লেখা থেকে নেওয়া হয়।
    # ForeignKey নয়: কথোপকথন মুছলেও ফিডব্যাক আর শেখা উত্তর থেকে যায়।
    message_id = Column(Integer, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.now)


class LearnedAnswer(Base):
    """শেখার খাতা: মানুষ যে উত্তর কাজের বলেছে (👍), আমাদের উৎসভিত্তিক AI উত্তর।
    পরে একই ধরনের প্রশ্নে AI-কে দেখানো হয়; AI না থাকলে এটাই দেখানো হয়। নিয়ম learning.py-তে।"""
    __tablename__ = "learned_answers"

    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, nullable=False, unique=True)  # যে উত্তর থেকে শেখা (chat_messages.id)
    question = Column(Text, nullable=False)
    lang = Column(String, default="bn")
    payload = Column(Text, nullable=False)          # উত্তর, ধাপ, কেন, সতর্কতা, উৎস (JSON)
    embedding = Column(Text, nullable=True)         # প্রশ্নের embedding (JSON); না থাকলে শব্দ মিলিয়ে খোঁজা
    up = Column(Integer, default=0)                 # কতজন কাজের বলেছে (এটা বা এটা দেখে লেখা উত্তর)
    down = Column(Integer, default=0)               # কতজন কাজের নয় বলেছে
    status = Column(String, default="waiting", index=True)  # waiting / active / retired / blocked (দল হাতে বাদ দিয়েছে)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now)


class SoilReport(Base):
    """মাটির পরীক্ষার ফল (হাতের/বোতল পরীক্ষা; পুরোনোগুলো ছবির নমুনা মডেলের)।"""
    __tablename__ = "soil_reports"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    soil_type = Column(String, nullable=False)      # Clay / Sandy / Loamy / Black
    confidence = Column(Float, nullable=False)
    is_mock = Column(Boolean, default=True)         # শুধু পুরোনো ছবির নমুনা রিপোর্টে True
    model = Column(String, default="")              # পরীক্ষার বিবরণ, দেখুন soil.report_details
    created_at = Column(DateTime, default=datetime.now)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, default="")
    plant_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now)

    messages = relationship(
        "ChatMessage", back_populates="session", cascade="all, delete-orphan",
        order_by="ChatMessage.id",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role = Column(String, nullable=False)           # user / assistant
    content = Column(Text, nullable=False)          # মডেলকে আবার পাঠানোর জন্য সাদা লেখা
    payload = Column(Text, default="")              # assistant-এর পুরো উত্তর (JSON), UI-তে আবার দেখাতে
    created_at = Column(DateTime, default=datetime.now)

    session = relationship("ChatSession", back_populates="messages")


class UsageDay(Base):
    """দিনে কে কতবার চ্যাট করল আর কত token খরচ হলো (কোটা ও খরচের হিসাব)।"""
    __tablename__ = "usage_days"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    day = Column(Date, nullable=False, index=True)
    chats = Column(Integer, default=0)
    llm_calls = Column(Integer, default=0)
    fallback_answers = Column(Integer, default=0)   # AI ছাড়া গাইড থেকে দেওয়া উত্তর
    blocked = Column(Integer, default=0)            # বাগানের বাইরের প্রশ্ন
    prompt_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)


class TaskLog(Base):
    """কাজের ইতিহাস: done / snooze / reschedule / watered / observation।"""
    __tablename__ = "task_logs"

    id = Column(Integer, primary_key=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=False)
    reminder_id = Column(Integer, nullable=True)
    action = Column(String, nullable=False)
    detail = Column(String, default="")
    logged_at = Column(DateTime, default=datetime.now)

    plant = relationship("Plant", back_populates="logs")


# --------------------------------------------------------------------------- কমিউনিটি
class CommunityProfile(Base):
    """কমিউনিটির প্রোফাইল: একজন ইউজারের একটাই। ছবি আপলোড নয়, তৈরি অবতার আর পটভূমি থেকে বাছাই।"""
    __tablename__ = "community_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    avatar = Column(String, nullable=False)          # community_catalog.AVATARS-এর id, যেমন "tomato-3d"
    background = Column(String, nullable=False)      # community_catalog.BACKGROUNDS-এর id
    name = Column(String, nullable=False)            # এক শব্দ, বাংলা বা ইংরেজি; একই নাম অনেকের হতে পারে
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now)


class CommunityPost(Base):
    """ছবিসহ পোস্ট (শুধু লেখা চলে না)। ছবির ফাইল storage-এ, এখানে শুধু তার key।"""
    __tablename__ = "community_posts"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    caption = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.now, index=True)

    images = relationship("PostImage", cascade="all, delete-orphan", order_by="PostImage.position")
    reactions = relationship("PostReaction", cascade="all, delete-orphan")
    comments = relationship("PostComment", cascade="all, delete-orphan")
    saves = relationship("PostSave", cascade="all, delete-orphan")
    shares = relationship("PostShare", cascade="all, delete-orphan")


class PostImage(Base):
    __tablename__ = "community_post_images"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("community_posts.id"), nullable=False, index=True)
    position = Column(Integer, default=0)
    feed_key = Column(String, nullable=False)        # ফিডের জন্য ছোট WebP (লম্বা দিক ≤১০৮০px)
    full_key = Column(String, nullable=False)        # বড় করে দেখার WebP (লম্বা দিক ≤২০৪৮px)
    width = Column(Integer, nullable=False)          # full ছবির মাপ
    height = Column(Integer, nullable=False)


class PostReaction(Base):
    """এক পোস্টে একজনের একটাই রিঅ্যাকশন (like / love / care); বদলালে একই সারি বদলায়।"""
    __tablename__ = "community_reactions"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_reaction_post_user"),)

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("community_posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.now)


class PostComment(Base):
    __tablename__ = "community_comments"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("community_posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)


class PostSave(Base):
    """পরে পড়ার জন্য সেভ; একই পোস্ট দুবার সেভ হয় না।"""
    __tablename__ = "community_saves"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_save_post_user"),)

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("community_posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now)


class PostShare(Base):
    """শেয়ার: মূল পোস্ট অপরিবর্তিত থাকে, শুধু কে কখন শেয়ার করল তা রাখা হয়।"""
    __tablename__ = "community_shares"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_share_post_user"),)

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("community_posts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.now)
