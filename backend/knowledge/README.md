# Shared Plant Knowledge Base

AI chatbot আর রোগ শনাক্ত (Plant Disease Detection & Guide) দুটোই এই একই knowledge base ব্যবহার করে।
দুটোর জন্য আলাদা KB বানাবে না।

## নতুন ডকুমেন্ট যোগ করা

1. ফাইল রাখো `files/` ফোল্ডারে (PDF, `.md` বা `.txt`)।
2. `sources.json`-এ তার তথ্য লেখো:

   ```json
   {
     "file": "brri-tomato-guide.pdf",
     "title": "টমেটো চাষ নির্দেশিকা",
     "publisher": "বাংলাদেশ কৃষি গবেষণা ইনস্টিটিউট",
     "source_url": "https://...",
     "publication_year": 2023,
     "language": "bn",
     "region": "Bangladesh",
     "plant_species": ["tomato"],
     "topic": ["watering", "fertilizer", "disease"],
     "license": "public",
     "version": "1"
   }
   ```

3. `backend` ফোল্ডার থেকে চালাও:

   ```
   venv\Scripts\python.exe manage_knowledge.py ingest
   venv\Scripts\python.exe manage_knowledge.py list
   ```

4. লেখাটা পড়ে যাচাই করে অনুমোদন দাও। **শুধু অনুমোদিত ডকুমেন্ট উত্তরে আসে।**

   ```
   venv\Scripts\python.exe manage_knowledge.py approve 1 --by "Munna"
   ```

5. খোঁজা ঠিক হচ্ছে কিনা দেখো:

   ```
   venv\Scripts\python.exe manage_knowledge.py search "টমেটো পাতায় বাদামি দাগ" --species tomato
   ```

## নিয়ম

- ফাইলের লেখা বদলালে ingest আবার চালাও। লেখা বদলালে ডকুমেন্ট আবার `pending` হয়ে যায়, নতুন করে approve দিতে হয়।
- ফাইল মুছে ingest চালালে ডকুমেন্টটা `obsolete` হয়ে যায়।
- স্ক্যান করা PDF থেকে লেখা ওঠে না; ingest সেই পাতাগুলোর কথা জানায়। আগে OCR করে নিতে হবে।
- অগ্রাধিকার: বাংলাদেশের সরকারি কৃষি/extension উৎস → FAO → বিশ্ববিদ্যালয় extension → peer-reviewed। ব্লগ বা ফোরাম ঢোকাবে না।
- `project-draft-disease-guide.md` প্রকল্পের নিজের খসড়া, বিশেষজ্ঞ দিয়ে যাচাই হয়নি। যাচাইয়ের আগে approve দিও না।

## API

- `POST /api/knowledge/search` — `{query, plant_species, topic, language, top_k}` → প্রাসঙ্গিক অংশ, উৎস, `kb_version`
- `POST /api/plant-disease/explain` — `{label, confidence, plant_species, symptoms}` → রোগ মডেলের ফলাফলের জন্য প্রমাণ
- `GET /api/knowledge/sources` — সব ডকুমেন্ট ও তাদের অবস্থা
