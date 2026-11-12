"""রোগ ডায়েরির ছবি, frontend/public/diary/-এ রাখা: Wikimedia Commons (CC0/PD/CC BY/BY-SA) আর
Bugwood.org (CC BY বা CC BY-NC 3.0 US; NC মানে শুধু অবাণিজ্যিক ব্যবহার, আমাদের ছাত্র-প্রকল্পে চলে)। সব ছবিতে credit লাগে।

প্রতিটা ছবি হাতে দেখে মেলানো হয়েছে। shown_on থাকলে ছবিটা একই রোগের, কিন্তু অন্য গাছের।
REUSE: যে রোগের নিজের ছবি নেই, একই রোগের অন্য ফসলের ছবি (shown_on দেখায় কোন গাছ)।
"""

IMAGES = {
    "tomato-early-blight": {
        "file": "/diary/tomato-early-blight.jpg",
        "title": "Alternaria solani - leaf lesions.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Alternaria_solani_-_leaf_lesions.jpg",
        "license": "CC BY 3.0 us",
        "license_url": "https://creativecommons.org/licenses/by/3.0/us/deed.en",
        "artist": "Clemson University - USDA Cooperative Extension Slide Series",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "tomato-late-blight": {
        "file": "/diary/tomato-late-blight.jpg",
        "title": "Tomato with Phytophthora infestans (late blight).jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Tomato_with_Phytophthora_infestans_(late_blight).jpg",
        "license": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0",
        "artist": "Downtowngal",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "tomato-septoria": {
        "file": "/diary/tomato-septoria.jpg",
        "title": "Septoria lycopersici malagutii leaf spot on tomato leaf.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Septoria_lycopersici_malagutii_leaf_spot_on_tomato_leaf.jpg",
        "license": "CC BY 3.0 us",
        "license_url": "https://creativecommons.org/licenses/by/3.0/us/deed.en",
        "artist": "Dr Parthasarathy Seethapathy, Tamil Nadu Agricultural University, Bugwood.org",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "tomato-bacterial-wilt": {
        "file": "/diary/tomato-bacterial-wilt.jpg",
        "title": "Tomato Bacterial wilt (Pathogen Ralstonia solanacearum) (12091835495).jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Tomato_Bacterial_wilt_(Pathogen_Ralstonia_solanacearum)_(12091835495).jpg",
        "license": "CC0",
        "license_url": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "artist": "Scot Nelson",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "brinjal-fsb": {
        "file": "/diary/brinjal-fsb.jpg",
        "title": "Leucinodes orbonalis (Brinjal Fruit Borer).jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Leucinodes_orbonalis_(Brinjal_Fruit_Borer).jpg",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0",
        "artist": "Chirag85",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "brinjal-little-leaf": {
        "file": "/diary/brinjal-little-leaf.jpg",
        "title": "Brinjal Little leaf phytoplasma.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Brinjal_Little_leaf_phytoplasma.jpg",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0",
        "artist": "Amityadav8",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "potato-late-blight": {
        "file": "/diary/potato-late-blight.jpg",
        "title": "Late blight on potato leaf 2.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Late_blight_on_potato_leaf_2.jpg",
        "license": "CC BY 3.0 us",
        "license_url": "https://creativecommons.org/licenses/by/3.0/us/deed.en",
        "artist": "Howard F. Schwartz, Colorado State University, United States",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "cucumber-downy": {
        "file": "/diary/cucumber-downy.jpg",
        "title": "Falscher Mehltau.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Falscher_Mehltau.jpg",
        "license": "CC BY-SA 3.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/3.0",
        "artist": "Christian Hummert (Ixitixel)",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "pumpkin-powdery": {
        "file": "/diary/pumpkin-powdery.jpg",
        "title": "Powdery mildew on pumpkin leaves 1.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Powdery_mildew_on_pumpkin_leaves_1.jpg",
        "license": "Public domain",
        "license_url": "",
        "artist": "Jeff Kubina",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "cabbage-black-rot": {
        "file": "/diary/cabbage-black-rot.jpg",
        "title": "Black rot of cabbage symptoms.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Black_rot_of_cabbage_symptoms.jpg",
        "license": "CC BY 3.0",
        "license_url": "https://creativecommons.org/licenses/by/3.0",
        "artist": "David B. Langston",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "cabbage-downy": {
        "file": "/diary/cabbage-downy.jpg",
        "title": "Hyaloperonospora brassicae.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Hyaloperonospora_brassicae.jpg",
        "license": "CC BY 2.5",
        "license_url": "https://creativecommons.org/licenses/by/2.5",
        "artist": "Michal Maňas",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "onion-downy": {
        "file": "/diary/onion-downy.jpg",
        "title": "Falscher Mehltau 2 (Peronospora destructor)-DLR-NW-jk.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Falscher_Mehltau_2_(Peronospora_destructor)-DLR-NW-jk.jpg",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0",
        "artist": "Jochen Kreiselmaier, Pflanzenschutzberater beim Dienstleistungszentrum Ländlicher Raum (DLR-Rheinpfalz) in Neustadt/Wstr",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "garlic-white-rot": {
        "file": "/diary/garlic-white-rot.jpg",
        "title": "Zwiebel Mehlkrankheit-2-Stromatinia cepivora-DLR-NW-jk.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Zwiebel_Mehlkrankheit-2-Stromatinia_cepivora-DLR-NW-jk.jpg",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0",
        "artist": "Jochen Kreiselmaier, Pflanzenschutzberater, Dienstleistungszentren Ländlicher Raum Rheinland-Pfalz (DLR Rheinpfalz) in N",
        "shown_on": "পেঁয়াজ",
        "site": "Wikimedia Commons"
    },
    "garlic-rust": {
        "file": "/diary/garlic-rust.jpg",
        "title": "Rust on garlic plant.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Rust_on_garlic_plant.jpg",
        "license": "Public domain",
        "license_url": "",
        "artist": "Downtowngal",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "bean-anthracnose": {
        "file": "/diary/bean-anthracnose.jpg",
        "title": "Bean anthracnose - Colletotrichum lindemuthianum (Sacc. & Magnus) Lams.-Scrib. - 5358881.png",
        "page": "https://commons.wikimedia.org/wiki/File:Bean_anthracnose_-_Colletotrichum_lindemuthianum_(Sacc._%26_Magnus)_Lams.-Scrib._-_5358881.png",
        "license": "CC BY 3.0 us",
        "license_url": "https://creativecommons.org/licenses/by/3.0/us/deed.en",
        "artist": "Howard F. Schwartz, Colorado State University, Bugwood.org -",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "mango-anthracnose": {
        "file": "/diary/mango-anthracnose.jpg",
        "title": "Mango anthracnose 1a.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Mango_anthracnose_1a.jpg",
        "license": "CC0",
        "license_url": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "artist": "Scot Nelson",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "mango-powdery": {
        "file": "/diary/mango-powdery.jpg",
        "title": "Mango powdery mildew flowers 2.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Mango_powdery_mildew_flowers_2.jpg",
        "license": "Public domain",
        "license_url": "",
        "artist": "Scot Nelson, Wayne Nishijima",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "banana-panama": {
        "file": "/diary/banana-panama.jpg",
        "title": "Banana (variety- Koa e' Kea)- Fusarium wilt (Panama disease).jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Banana_(variety-_Koa_e%27_Kea)-_Fusarium_wilt_(Panama_disease).jpg",
        "license": "CC0",
        "license_url": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "artist": "Scot Nelson",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "banana-sigatoka": {
        "file": "/diary/banana-sigatoka.jpg",
        "title": "Banana- Black leaf streak (Black sigatoka).jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Banana-_Black_leaf_streak_(Black_sigatoka).jpg",
        "license": "CC0",
        "license_url": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "artist": "Plant pests and diseases",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "papaya-prsv": {
        "file": "/diary/papaya-prsv.jpg",
        "title": "Papaya Ringspot Virus Symptoms.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Papaya_Ringspot_Virus_Symptoms.jpg",
        "license": "Public domain",
        "license_url": "",
        "artist": "APS",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "lemon-canker": {
        "file": "/diary/lemon-canker.jpg",
        "title": "Citrus canker Xanthomonas citri - symptoms on leaves UGA1262029.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Citrus_canker_Xanthomonas_citri_-_symptoms_on_leaves_UGA1262029.jpg",
        "license": "CC BY 3.0 us",
        "license_url": "https://creativecommons.org/licenses/by/3.0/us/deed.en",
        "artist": "Timothy Schubert - Florida Department of Agriculture and Consumer Services - Bugwood.org",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "strawberry-gray-mold": {
        "file": "/diary/strawberry-gray-mold.jpg",
        "title": "Aardbei Lambada vruchtrot Botrytis cinerea.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Aardbei_Lambada_vruchtrot_Botrytis_cinerea.jpg",
        "license": "CC BY-SA 3.0",
        "license_url": "http://creativecommons.org/licenses/by-sa/3.0/",
        "artist": "Rasbak",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "hibiscus-mealybug": {
        "file": "/diary/hibiscus-mealybug.jpg",
        "title": "Maconellicoccus hirsutus from CSIRO.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Maconellicoccus_hirsutus_from_CSIRO.jpg",
        "license": "Public domain",
        "license_url": "",
        "artist": "Unknown authorUnknown author",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "hibiscus-aphid": {
        "file": "/diary/hibiscus-aphid.jpg",
        "title": "Aphids on an Hibiscus flower bud - 9 Aug. 2016.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Aphids_on_an_Hibiscus_flower_bud_-_9_Aug._2016.jpg",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0",
        "artist": "Jacopo Werther",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "rose-black-spot": {
        "file": "/diary/rose-black-spot.jpg",
        "title": "Black spot.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Black_spot.jpg",
        "license": "Public domain",
        "license_url": "",
        "artist": "অজানা",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "rose-powdery": {
        "file": "/diary/rose-powdery.jpg",
        "title": "Rose Powdery Mildew.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Rose_Powdery_Mildew.jpg",
        "license": "CC BY 3.0",
        "license_url": "https://creativecommons.org/licenses/by/3.0",
        "artist": "Cesar Calderon, USDA APHIS PPQ, Bugwood.org",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "chili-leaf-curl": {
        "file": "/diary/chili-leaf-curl.jpg",
        "title": "Yellow curl leaf disease Pj IMG 3163.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Yellow_curl_leaf_disease_Pj_IMG_3163.jpg",
        "license": "CC0",
        "license_url": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "artist": "Kembangraps",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "okra-yvmv": {
        "file": "/diary/okra-yvmv.jpg",
        "title": "Bhendi vein clearingPhoto-0028.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Bhendi_vein_clearingPhoto-0028.jpg",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0",
        "artist": "Srigayu1996",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "pumpkin-downy": {
        "file": "/diary/pumpkin-downy.jpg",
        "title": "Pseudoperonospora cubensis 147541589.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Pseudoperonospora_cubensis_147541589.jpg",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0",
        "artist": "blastcat",
        "shown_on": "শসা-গোত্রের লতা",
        "site": "Wikimedia Commons"
    },
    "watermelon-anthracnose": {
        "file": "/diary/watermelon-anthracnose.jpg",
        "title": "Colletotrichum orbiculare 1.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Colletotrichum_orbiculare_1.jpg",
        "license": "CC BY 3.0 us",
        "license_url": "https://creativecommons.org/licenses/by/3.0/us/deed.en",
        "artist": "David B. Langston, University of Georgia, Bugwood.org",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "onion-purple-blotch": {
        "file": "/diary/onion-purple-blotch.jpg",
        "title": "Alternaria porri.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Alternaria_porri.jpg",
        "license": "CC BY 3.0",
        "license_url": "https://creativecommons.org/licenses/by/3.0",
        "artist": "New Zealand Fungal and Plant Disease Collection (PDD) - Landcare Research",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "amaranth-white-rust": {
        "file": "/diary/amaranth-white-rust.jpg",
        "title": "Wilsoniana bliti 48206519.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Wilsoniana_bliti_48206519.jpg",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0",
        "artist": "Sandy Wolkenberg",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "tomato-tylcv": {
        "file": "/diary/tomato-tylcv.jpg",
        "title": "tomato yellow leaf curl virus (TYLCV) on garden tomato (Bugwood 5077049)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=5077049",
        "license": "CC BY 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by/3.0/us/",
        "artist": "David B. Langston, University of Georgia",
        "shown_on": None,
        "site": "Bugwood.org"
    },
    "chili-anthracnose": {
        "file": "/diary/chili-anthracnose.jpg",
        "title": "anthracnose on pepper (Bugwood 5408846)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=5408846",
        "license": "CC BY-NC 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by-nc/3.0/us/",
        "artist": "Yuan-Min Shen, National Taiwan University",
        "shown_on": None,
        "site": "Bugwood.org"
    },
    "carrot-alternaria": {
        "file": "/diary/carrot-alternaria.jpg",
        "title": "Alternaria blight on carrot (Bugwood 5077068)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=5077068",
        "license": "CC BY 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by/3.0/us/",
        "artist": "David B. Langston, University of Georgia",
        "shown_on": None,
        "site": "Bugwood.org"
    },
    "bean-rust": {
        "file": "/diary/bean-rust.jpg",
        "title": "dry bean rust on common bean (Bugwood 5361410)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=5361410",
        "license": "CC BY 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by/3.0/us/",
        "artist": "Howard F. Schwartz, Colorado State University",
        "shown_on": "সাধারণ শিম (common bean)",
        "site": "Bugwood.org"
    },
    "watermelon-fusarium": {
        "file": "/diary/watermelon-fusarium.jpg",
        "title": "Fusarium root rot and wilt on watermelon (Bugwood 5561374)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=5561374",
        "license": "CC BY-NC 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by-nc/3.0/us/",
        "artist": "Cheng-Fang Hong, University of Georgia",
        "shown_on": None,
        "site": "Bugwood.org"
    },
    "spinach-downy": {
        "file": "/diary/spinach-downy.jpg",
        "title": "downy mildew on spinach (Bugwood 5609920)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=5609920",
        "license": "CC BY-NC 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by-nc/3.0/us/",
        "artist": "Gerald Holmes, Strawberry Center, Cal Poly San Luis Obispo",
        "shown_on": None,
        "site": "Bugwood.org"
    },
    "litchi-anthracnose": {
        "file": "/diary/litchi-anthracnose.jpg",
        "title": "bitter rot and anthracnose on lychee (Bugwood 5403527)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=5403527",
        "license": "CC BY-NC 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by-nc/3.0/us/",
        "artist": "Yuan-Min Shen, National Taiwan University",
        "shown_on": None,
        "site": "Bugwood.org"
    },
    "guava-wilt": {
        "file": "/diary/guava-wilt.jpg",
        "title": "Guava Wilt Disease on guava (Bugwood 5561370)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=5561370",
        "license": "CC BY-NC 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by-nc/3.0/us/",
        "artist": "Cheng-Fang Hong, University of Georgia",
        "shown_on": None,
        "site": "Bugwood.org"
    },
    "marigold-leaf-spot": {
        "file": "/diary/marigold-leaf-spot.jpg",
        "title": "Alternaria black molds / stem cankers on marigold (Bugwood 1634002)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=1634002",
        "license": "CC BY-NC 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by-nc/3.0/us/",
        "artist": "Penn State Department of Plant Pathology & Environmental Microbiology Archives, Penn State University",
        "shown_on": None,
        "site": "Bugwood.org"
    },
    "marigold-botrytis": {
        "file": "/diary/marigold-botrytis.jpg",
        "title": "gray molds on marigold (Bugwood 1525408)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=1525408",
        "license": "CC BY-NC 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by-nc/3.0/us/",
        "artist": "Ron Jones, North Carolina State University",
        "shown_on": None,
        "site": "Bugwood.org"
    },
    "zinnia-powdery": {
        "file": "/diary/zinnia-powdery.jpg",
        "title": "powdery mildew on zinnia (Bugwood 5479904)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=5479904",
        "license": "CC BY 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by/3.0/us/",
        "artist": "Elizabeth Bush, Virginia Polytechnic Institute and State University",
        "shown_on": None,
        "site": "Bugwood.org"
    },
    "zinnia-alternaria": {
        "file": "/diary/zinnia-alternaria.jpg",
        "title": "Alternaria blight on zinnia (Bugwood 5486959)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=5486959",
        "license": "CC BY-NC 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by-nc/3.0/us/",
        "artist": "Larry Osborne",
        "shown_on": None,
        "site": "Bugwood.org"
    },
    "jasmine-cercospora": {
        "file": "/diary/jasmine-cercospora.jpg",
        "title": "leaf spot on poet's jasmine (Bugwood 5585623)",
        "page": "https://www.ipmimages.org/browse/detail.cfm?imgnum=5585623",
        "license": "CC BY 3.0 US",
        "license_url": "https://creativecommons.org/licenses/by/3.0/us/",
        "artist": "Dr. Parthasarathy Seethapathy, Amrita School of Agricultural Sciences",
        "shown_on": "অন্য জাতের জুঁই (poet's jasmine)",
        "site": "Bugwood.org"
    }
}

IMAGES.update({
    "malta-canker": {
        "file": "/diary/malta-canker.jpg",
        "title": "Citrus canker Xanthomonas citri - symptoms on leaves UGA1262029.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Citrus_canker_Xanthomonas_citri_-_symptoms_on_leaves_UGA1262029.jpg",
        "license": "CC BY 3.0 us",
        "license_url": "https://creativecommons.org/licenses/by/3.0/us/deed.en",
        "artist": "Timothy Schubert - Florida Department of Agriculture and Consumer Services - Bugwood.org",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "malta-leafminer": {
        "file": "/diary/malta-leafminer.jpg",
        "title": "Larve di su Phyllocnistis citrella su Citrus hystrix.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Larve_di_su_Phyllocnistis_citrella_su_Citrus_hystrix.jpg",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0",
        "artist": "A.Ariosti",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "capsicum-bacterial-spot": {
        "file": "/diary/capsicum-bacterial-spot.jpg",
        "title": "Bacterial leaf spot of pepper (14954498489).jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Bacterial_leaf_spot_of_pepper_(14954498489).jpg",
        "license": "CC0",
        "license_url": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
        "artist": "Scot Nelson",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "lettuce-downy": {
        "file": "/diary/lettuce-downy.jpg",
        "title": "IJssla wit (Iceberg with Bremia lactucae).jpg",
        "page": "https://commons.wikimedia.org/wiki/File:IJssla_wit_(Iceberg_with_Bremia_lactucae).jpg",
        "license": "CC BY-SA 3.0",
        "license_url": "http://creativecommons.org/licenses/by-sa/3.0/",
        "artist": "Rasbak",
        "shown_on": None,
        "site": "Wikimedia Commons"
    },
    "mint-rust": {
        "file": "/diary/mint-rust.jpg",
        "title": "Puccinia menthae (12).jpeg",
        "page": "https://commons.wikimedia.org/wiki/File:Puccinia_menthae_(12).jpeg",
        "license": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0",
        "artist": "Lorin Timaeus",
        "shown_on": None,
        "site": "Wikimedia Commons"
    }
})

# রোগ -> (যে ছবি দেখাবে, ছবিতে কোন গাছ)
REUSE = {
    "capsicum-aphid": ["hibiscus-aphid", "জবা"],
    "lettuce-aphid": ["hibiscus-aphid", "জবা"],
    "chrysanthemum-aphid": ["hibiscus-aphid", "জবা"],
    "mint-powdery": ["zinnia-powdery", "জিনিয়া"],
    "chrysanthemum-leaf-spot": ["tomato-septoria", "টমেটো (একই ধরনের সেপ্টোরিয়া দাগ)"],
    "cucumber-powdery": [
        "pumpkin-powdery",
        "মিষ্টি কুমড়া"
    ],
    "bittergourd-powdery": [
        "pumpkin-powdery",
        "মিষ্টি কুমড়া"
    ],
    "snakegourd-powdery": [
        "pumpkin-powdery",
        "মিষ্টি কুমড়া"
    ],
    "bittergourd-downy": [
        "cucumber-downy",
        "শসা"
    ],
    "bottlegourd-downy": [
        "cucumber-downy",
        "শসা"
    ],
    "cauliflower-black-rot": [
        "cabbage-black-rot",
        "বাঁধাকপি"
    ],
    "potato-early-blight": [
        "tomato-early-blight",
        "টমেটো"
    ],
    "portulaca-aphid": [
        "hibiscus-aphid",
        "জবা"
    ]
}


# ওয়েব থেকে নেওয়া ছবি (শিক্ষামূলক ব্যবহার, মেন্টরের অনুমতিতে): লাইসেন্স জানা নেই, তাই শুধু উৎসের পাতা আর সাইটের নাম দেখানো হয়।
WEB_IMAGES = {
    "cauliflower-downy": {
        "file": "/diary/cauliflower-downy.jpg",
        "title": "Downy mildew – Pestoscope",
        "page": "https://pestoscope.com/product/downy-mildew/",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "pestoscope.com"
    },
    "radish-downy": {
        "file": "/diary/radish-downy.jpg",
        "title": "Radish: Radish Downy Mildew - Plant Guide",
        "page": "https://www.smartgardener.com/plants/7474-radish-radish/diseases/780-downy-mildew",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "smartgardener.com"
    },
    "bottlegourd-mosaic": {
        "file": "/diary/bottlegourd-mosaic.jpg",
        "title": "Bottle Gourd Leaf/ Vine Infected by Virus Stock Photo - Image of curl ...",
        "page": "https://www.dreamstime.com/bottle-gourd-leaf-vine-infected-virus-viral-disease-photoshoot-noon-bottle-gourd-leaf-vine-infected-virus-image159080204",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "dreamstime.com"
    },
    "ridgegourd-mosaic": {
        "file": "/diary/ridgegourd-mosaic.jpg",
        "title": "Mosaic Virus Diseases of Squash",
        "page": "https://www.vegetables.bayer.com/us/en-us/resources/growing-tips-and-innovation-articles/agronomic-spotlights/mosaic-virus-diseases-of-squash.html",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": "স্কোয়াশ",
        "site": "vegetables.bayer.com"
    },
    "ridgegourd-blight": {
        "file": "/diary/ridgegourd-blight.jpg",
        "title": "Crop diseases in ridge gourd | Community | Plantix",
        "page": "https://plantix.net/en/community/questions/cucumber/20200731/crop-diseases-in-ridge-gourd/",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "plantix.net"
    },
    "papaya-leaf-curl": {
        "file": "/diary/papaya-leaf-curl.jpg",
        "title": "Papaya Leaves Yellowing and Malformation from Viruses Infection Stock ...",
        "page": "https://www.dreamstime.com/papaya-leaves-yellowing-malformation-viruses-infection-leaf-curl-image115379060",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "dreamstime.com"
    },
    "guava-anthracnose": {
        "file": "/diary/guava-anthracnose.jpg",
        "title": "Anthracnose Disease on Mango Leave Stock Image - Image of ...",
        "page": "https://www.dreamstime.com/anthracnose-disease-mango-leave-anthracnose-disease-mango-leave-caused-colletotrichum-gloeosporioides-viet-nam-image186224051",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "dreamstime.com"
    },
    "strawberry-leaf-spot": {
        "file": "/diary/strawberry-leaf-spot.jpg",
        "title": "Post — nysbga.org",
        "page": "https://www.nysbga.org/berry-growers/2020/9/18/berry-disease-snapshot-mycosphaerella-leaf-spot-of-strawberry",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "nysbga.org"
    },
    "radish-alternaria": {
        "file": "/diary/radish-alternaria.jpg",
        "title": "What's wrong with my plant? : Garden : University of Minnesota Extension",
        "page": "https://apps.extension.umn.edu/garden/diagnose/plant/vegetable/radish/leavesspots.html",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "apps.extension.umn.edu"
    },
    "carrot-cercospora": {
        "file": "/diary/carrot-cercospora.jpg",
        "title": "What's wrong with my plant? : Garden : University of Minnesota Extension",
        "page": "https://apps.extension.umn.edu/garden/diagnose/plant/vegetable/carrot/leavesdiscolored.html",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "apps.extension.umn.edu"
    },
    "snakegourd-mosaic": {
        "file": "/diary/snakegourd-mosaic.jpg",
        "title": "Banana mosaic (100)",
        "page": "https://apps.lucidcentral.org/pppw_v11/text/web_full/entities/banana_mosaic_100.htm",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": "অন্য লতানো সবজি",
        "site": "apps.lucidcentral.org"
    },
    "coriander-stem-gall": {
        "file": "/diary/coriander-stem-gall.jpg",
        "title": "Stem Gall Of Coriander | Stem Galls – PZJH",
        "page": "https://clsl.hospital-times.co.uk/stem-gall-of-coriander-stem-galls/",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "clsl.hospital-times.co.uk"
    },
    "basella-cercospora": {
        "file": "/diary/basella-cercospora.jpg",
        "title": "521 Cercospora Leaf Spot Royalty-Free Images, Stock Photos & Pictures ...",
        "page": "https://www.shutterstock.com/search/cercospora-leaf-spot",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "shutterstock.com"
    },
    "ginger-soft-rot": {
        "file": "/diary/ginger-soft-rot.jpg",
        "title": "Frontiers | Molecular identification and pathogenic impact of Pythium ...",
        "page": "https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2025.1626700/full",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "frontiersin.org"
    },
    "ginger-bacterial-wilt": {
        "file": "/diary/ginger-bacterial-wilt.jpg",
        "title": "| Plantwise Knowledge Bank",
        "page": "https://plantwiseplusknowledgebank.org/doi/10.1079/PWKB.20177800662",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "plantwiseplusknowledgebank.org"
    },
    "litchi-twig-blight": {
        "file": "/diary/litchi-twig-blight.jpg",
        "title": "Pest Management Guide for Litchi Tree",
        "page": "https://krishijagran.com/agripedia/pest-management-guide-for-litchi-tree/",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "krishijagran.com"
    },
    "portulaca-root-rot": {
        "file": "/diary/portulaca-root-rot.jpg",
        "title": "Moss Rose, Common Portulaca | Herbaceous Plant Finder | Comprehensive ...",
        "page": "https://www.depts.ttu.edu/plantresources/Pages/directories/landscape-info-sheets/herbaceous-info/Portulaca_grandiflora.php",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "depts.ttu.edu"
    },
    "jasmine-blight": {
        "file": "/diary/jasmine-blight.jpg",
        "title": "How to Treat Leaf blight Disease on Star jasmine?",
        "page": "https://www.picturethisai.com/disease/Trachelospermum-jasminoides-Leaf-blight.html",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": "স্টার জুঁই (Trachelospermum)",
        "site": "picturethisai.com"
    },
    "coriander-powdery": {
        "file": "/diary/coriander-powdery.jpg",
        "title": "TNAU Agritech Portal :: Crop Protection",
        "page": "https://agritech.tnau.ac.in/crop_protection/coriander_diseases_2.html",
        "license": "",
        "license_url": "",
        "artist": "",
        "shown_on": None,
        "site": "agritech.tnau.ac.in"
    }
}
IMAGES.update(WEB_IMAGES)
