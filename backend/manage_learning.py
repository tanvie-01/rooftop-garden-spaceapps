"""শেখার খাতা আর প্রশ্নের রিপোর্ট, দলের জন্য (backend ফোল্ডার থেকে চালান)।

  venv\\Scripts\\python manage_learning.py report [দিন]   কী জিজ্ঞেস করছে, কোথায় তথ্য নেই, খাতায় কী শেখা হলো
  venv\\Scripts\\python manage_learning.py show <id>       খাতার একটা উত্তর পুরোটা দেখুন
  venv\\Scripts\\python manage_learning.py retire <id>     ভুল মনে হলে খাতা থেকে বাদ দিন
  venv\\Scripts\\python manage_learning.py restore <id>    বাদ দেওয়া উত্তর আবার চালু করুন

রিপোর্টের "উত্তরহীন প্রশ্ন" দেখে ঠিক করুন কোন বিষয়ে নতুন সরকারি লেখা (PDF) জ্ঞানভান্ডারে যোগ করবে
(manage_knowledge.py দিয়ে)। .env-এর DATABASE_URL যেটা, সেই ডেটাবেসেই চলে।
"""
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

from database import SessionLocal, init_db  # noqa: E402
from learning import _status, report  # noqa: E402
from models import LearnedAnswer  # noqa: E402
from plan import CROPS  # noqa: E402


def main(argv: list[str]):
    if not argv or argv[0] not in ("report", "show", "retire", "restore"):
        print(__doc__)
        return 1
    init_db()
    db = SessionLocal()
    try:
        if argv[0] == "report":
            days = int(argv[1]) if len(argv) > 1 else 30
            r = report(db, days, [(c["name"], c["bn"]) for c in CROPS])
            a = r["answers"]
            print(f"গত {days} দিন: মোট উত্তর {a['total']}, AI {a['ai']}, AI ছাড়া {a['without_ai']}, "
                  f"খাতা কাজে লেগেছে {a['used_learned']}, বিষয়ের বাইরে {a['refused']}")
            print("\nকোন ফসলে উত্তরহীন প্রশ্ন বেশি (জ্ঞানভান্ডারে লেখা যোগ করার জায়গা):")
            for crop, n in r["unanswered_by_crop"] or [("(নেই)", 0)]:
                print(f"  {crop}: {n}")
            print("\nউৎস ছাড়া উত্তর পাওয়া প্রশ্ন:")
            for q in r["unanswered_questions"]:
                print(f"  {q['count']}x  {q['question']}")
            print("\n👎 পাওয়া উত্তর:")
            for d in r["disliked"]:
                print(f"  {d['at']}  {d['question'][:80]}  কারণ: {d['reason'] or '-'}")
            lr = r["learned"]
            print(f"\nশেখার খাতা: চালু {lr['active']}, অপেক্ষায় {lr['waiting']}, বাদ {lr['retired']}")
            for t in lr["top"]:
                print(f"  #{t['id']} [{t['status']}] 👍{t['up']} 👎{t['down']}  {t['question'][:80]}")
            return 0

        la = db.get(LearnedAnswer, int(argv[1])) if len(argv) > 1 else None
        if la is None:
            print("এই id-তে খাতায় কিছু নেই")
            return 1
        if argv[0] == "show":
            print(f"#{la.id} [{la.status}] 👍{la.up} 👎{la.down}\nপ্রশ্ন: {la.question}")
            print(json.dumps(json.loads(la.payload), ensure_ascii=False, indent=2))
            return 0
        if argv[0] == "retire":
            la.status = "blocked"   # ভোটে আর চালু হবে না
        else:
            la.status = "waiting"
            _status(la)             # ভোট অনুযায়ী আবার হিসাব
        db.commit()
        print(f"#{la.id} এখন {la.status}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
