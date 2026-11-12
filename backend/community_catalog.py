"""কমিউনিটির অবতার আর পটভূমির তালিকা (id)। ছবি আর রং frontend/lib/community.ts-এ; দুই জায়গার id এক (টেস্ট দেখে)।

অবতার: Microsoft Fluent Emoji (MIT লাইসেন্স), frontend/public/avatars/-এ 3D (webp) আর Flat (svg) দুই স্টাইলে।
"""

AVATAR_GROUPS = {
    "veg": ["tomato", "potato", "carrot", "eggplant", "pumpkin", "cabbage", "broccoli", "chili", "capsicum",
            "cucumber", "corn", "onion", "garlic", "ginger", "peas", "mushroom"],
    "fruit": ["strawberry", "watermelon", "mango", "banana", "lemon", "cherries", "grapes", "pineapple", "peach",
              "apple", "coconut", "avocado", "kiwi"],
    "flower": ["sunflower", "rose", "hibiscus", "tulip", "blossom", "sakura", "lotus", "bouquet"],
    "garden": ["seedling", "herb", "pot", "cactus", "clover", "tree", "leaf", "ladybug", "bee", "butterfly",
               "snail", "rice"],
}
AVATAR_STYLES = ["3d", "flat"]
AVATARS = {f"{a}-{s}" for g in AVATAR_GROUPS.values() for a in g for s in AVATAR_STYLES}

BACKGROUNDS = ["meadow", "sunrise", "mint", "lavender", "forest", "sky", "terracotta", "lemon", "leaves", "dots",
               "waves", "petals"]
