/* ---------- Yerel yemek kütüphanesi ----------
   Plan dışı yenenleri yapay zekâya gitmeden kaydetmek için. Değerler yaklaşık, tipik bir porsiyon içindir.
   n ad · u porsiyon · k kcal · p protein (g) · a arama için eş adlar · i ikon kimliği (yoksa addan türetilir).
   Kullanıcının kendi kaydettikleri (S.foods) aramada bunların önüne geçer. */
const FOODS = [
  /* Kebap ve dışarıda */
  { n: 'İskender kebap', u: '1 porsiyon', k: 750, p: 40, a: ['bursa kebabı', 'iskender'] },
  { n: 'Adana kebap', u: '1 porsiyon, lavaşla', k: 700, p: 36, a: ['acılı kebap'] },
  { n: 'Urfa kebap', u: '1 porsiyon, lavaşla', k: 680, p: 36 },
  { n: 'Et şiş', u: '1 porsiyon, pilavsız', k: 450, p: 42, a: ['kuşbaşı şiş'] },
  { n: 'Tavuk şiş', u: '1 porsiyon, pilavsız', k: 420, p: 45 },
  { n: 'Tavuk kanat', u: '1 porsiyon (8 adet)', k: 550, p: 40 },
  { n: 'Izgara köfte', u: '1 restoran porsiyonu', k: 550, p: 40, a: ['kasap köfte', 'köfteci'] },
  { n: 'Köfte ekmek', u: 'yarım ekmek', k: 600, p: 30 },
  { n: 'Döner dürüm', u: '1 adet, et', k: 650, p: 32, a: ['et döner'] },
  { n: 'Tavuk döner dürüm', u: '1 adet', k: 550, p: 32, a: ['tavuk dürüm'] },
  { n: 'Pilav üstü döner', u: '1 porsiyon, et', k: 800, p: 38, a: ['porsiyon döner'] },
  { n: 'Pilav üstü tavuk döner', u: '1 porsiyon', k: 700, p: 36 },
  { n: 'Tavuk pilav', u: '1 porsiyon', k: 600, p: 30, a: ['nohutlu pilav'] },
  { n: 'Lahmacun', u: '1 adet', k: 300, p: 13 },
  { n: 'Kıymalı pide', u: '1 adet', k: 750, p: 35 },
  { n: 'Kaşarlı pide', u: '1 adet', k: 800, p: 32 },
  { n: 'Kuşbaşılı pide', u: '1 adet', k: 800, p: 40 },
  { n: 'Tantuni', u: '1 dürüm', k: 500, p: 28 },
  { n: 'Kokoreç', u: 'yarım ekmek', k: 600, p: 22 },
  { n: 'Çiğ köfte dürüm', u: '1 adet', k: 350, p: 8 },
  { n: 'Islak hamburger', u: '1 adet', k: 300, p: 12 },
  { n: 'Kumru', u: '1 adet', k: 650, p: 30 },
  { n: 'Sucuk ekmek', u: '1 adet', k: 500, p: 20 },
  { n: 'Balık ekmek', u: '1 adet', k: 450, p: 28 },
  { n: 'Midye dolma', u: '1 adet', k: 45, p: 2 },
  { n: 'Kumpir', u: '1 adet', k: 800, p: 22 },
  { n: 'Mantı', u: '1 porsiyon, yoğurtlu', k: 600, p: 24 },
  { n: 'Hünkar beğendi', u: '1 porsiyon', k: 650, p: 35 },
  { n: 'Etli kuru fasulye', u: '1 porsiyon', k: 350, p: 16, a: ['kuru fasulye'] },
  { n: 'Kuru fasulye pilav', u: '1 porsiyon', k: 650, p: 22 },

  /* Dünya mutfağı ve hızlı yemek */
  { n: 'Hamburger', u: '1 adet', k: 550, p: 28, a: ['burger'] },
  { n: 'Cheeseburger', u: '1 adet', k: 600, p: 31 },
  { n: 'Tavuk burger', u: '1 adet', k: 500, p: 25 },
  { n: 'Patates kızartması', u: '1 orta porsiyon', k: 350, p: 4, a: ['cips patates'] },
  { n: 'Pizza', u: '1 dilim', k: 280, p: 12 },
  { n: 'Tavuk nugget', u: '6 adet', k: 280, p: 14 },
  { n: 'Wrap', u: '1 adet', k: 500, p: 25, a: ['dürüm wrap'] },
  { n: 'Sandviç', u: '1 adet', k: 400, p: 20 },
  { n: 'Sushi', u: '8 parça', k: 350, p: 14 },
  { n: 'Sezar salata', u: '1 porsiyon', k: 450, p: 25 },
  { n: 'Makarna, sade', u: '1 porsiyon', k: 320, p: 11 },
  { n: 'Makarna, soslu', u: '1 porsiyon', k: 550, p: 20, a: ['bolonez', 'spagetti'] },

  /* Ev yemekleri */
  { n: 'Pirinç pilavı', u: '1 porsiyon', k: 300, p: 5, a: ['pilav'] },
  { n: 'Bulgur pilavı', u: '1 porsiyon', k: 250, p: 7 },
  { n: 'Tavuk sote', u: '1 porsiyon', k: 300, p: 30 },
  { n: 'Fırın tavuk but', u: '1 adet', k: 300, p: 28 },
  { n: 'Izgara tavuk göğsü', u: '150 g', k: 250, p: 35 },
  { n: 'Biftek', u: '200 g', k: 450, p: 50, a: ['bonfile', 'antrikot', 'steak'] },
  { n: 'Kuzu pirzola', u: '4 adet', k: 450, p: 35 },
  { n: 'Somon', u: '200 g', k: 400, p: 40 },
  { n: 'Levrek ızgara', u: '1 adet', k: 350, p: 45, a: ['çupra'] },
  { n: 'Hamsi tava', u: '1 porsiyon', k: 450, p: 28 },
  { n: 'Etli nohut', u: '1 porsiyon', k: 350, p: 18 },
  { n: 'Karnıyarık', u: '1 adet', k: 350, p: 14 },
  { n: 'İmam bayıldı', u: '1 adet', k: 250, p: 3 },
  { n: 'Zeytinyağlı taze fasulye', u: '1 porsiyon', k: 180, p: 4 },
  { n: 'Etli biber dolması', u: '1 adet', k: 180, p: 9, a: ['dolma'] },
  { n: 'Yaprak sarma', u: '5 adet', k: 200, p: 3, a: ['sarma'] },
  { n: 'İçli köfte', u: '1 adet', k: 220, p: 9 },
  { n: 'Mercimek köftesi', u: '3 adet', k: 200, p: 7 },
  { n: 'Kısır', u: '1 porsiyon', k: 200, p: 5 },
  { n: 'Sigara böreği', u: '3 adet', k: 270, p: 8 },
  { n: 'Humus', u: '1 porsiyon', k: 250, p: 8 },
  { n: 'Cacık', u: '1 kase', k: 90, p: 5 },
  { n: 'Çoban salata', u: '1 kase', k: 120, p: 2, a: ['mevsim salata', 'salata'] },
  { n: 'Ton balığı', u: '1 kutu, süzülmüş', k: 220, p: 40 },

  /* Çorba */
  { n: 'Mercimek çorbası', u: '1 kase', k: 180, p: 9 },
  { n: 'Ezogelin çorbası', u: '1 kase', k: 170, p: 8 },
  { n: 'Tavuk suyu çorba', u: '1 kase', k: 150, p: 10, a: ['tavuk çorbası'] },
  { n: 'Yayla çorbası', u: '1 kase', k: 160, p: 6 },
  { n: 'Tarhana çorbası', u: '1 kase', k: 150, p: 5 },
  { n: 'İşkembe çorbası', u: '1 kase', k: 250, p: 14 },

  /* Kahvaltı ve hamur işi */
  { n: 'Simit', u: '1 adet', k: 300, p: 9 },
  { n: 'Poğaça', u: '1 adet', k: 280, p: 6 },
  { n: 'Açma', u: '1 adet', k: 330, p: 6 },
  { n: 'Su böreği', u: '1 dilim', k: 300, p: 12, a: ['börek'] },
  { n: 'Kol böreği', u: '1 dilim', k: 330, p: 9 },
  { n: 'Peynirli gözleme', u: '1 adet', k: 450, p: 18, a: ['gözleme'] },
  { n: 'Kaşarlı tost', u: '1 adet', k: 350, p: 16, a: ['tost'] },
  { n: 'Karışık tost', u: '1 adet', k: 420, p: 20 },
  { n: 'Bazlama', u: '1 adet', k: 300, p: 9 },
  { n: 'Lavaş', u: '1 adet', k: 250, p: 8 },
  { n: 'Beyaz ekmek', u: '1 dilim (30 g)', k: 80, p: 2.5, a: ['ekmek', 'francala'] },
  { n: 'Tam buğday ekmeği', u: '1 dilim (25 g)', k: 62, p: 2.5 },
  { n: 'Serpme kahvaltı', u: '1 kişilik', k: 900, p: 35, a: ['köy kahvaltısı', 'kahvaltı tabağı'] },
  { n: 'Menemen', u: '2 yumurtalı', k: 280, p: 14 },
  { n: 'Sucuklu yumurta', u: '2 yumurtalı', k: 450, p: 24 },
  { n: 'Omlet', u: '2 yumurtalı', k: 200, p: 13 },
  { n: 'Haşlanmış yumurta', u: '1 adet', k: 75, p: 6.5, a: ['yumurta'] },
  { n: 'Beyaz peynir', u: '1 dilim (30 g)', k: 80, p: 5, a: ['peynir'] },
  { n: 'Kaşar peyniri', u: '1 dilim (20 g)', k: 75, p: 5, a: ['kaşar'] },
  { n: 'Zeytin', u: '5 adet', k: 40, p: 0 },
  { n: 'Sucuk', u: '3 dilim', k: 120, p: 6 },
  { n: 'Bal', u: '1 tatlı kaşığı', k: 30, p: 0 },
  { n: 'Reçel', u: '1 tatlı kaşığı', k: 30, p: 0 },
  { n: 'Tereyağı', u: '1 tatlı kaşığı', k: 35, p: 0 },
  { n: 'Fındık kreması', u: '1 yemek kaşığı', k: 100, p: 1, a: ['nutella'] },
  { n: 'Yulaf lapası', u: '1 kase, sütlü', k: 280, p: 12, a: ['yulaf'] },
  { n: 'Granola', u: '1 kase, yoğurtlu', k: 350, p: 12, a: ['müsli'] },

  /* Süt ürünleri */
  { n: 'Yoğurt', u: '1 kase (200 g)', k: 120, p: 7 },
  { n: 'Süzme yoğurt', u: '150 g', k: 140, p: 14 },
  { n: 'Skyr', u: '1 kutu (150 g)', k: 100, p: 16 },
  { n: 'Süt', u: '1 bardak, yarım yağlı', k: 120, p: 8 },
  { n: 'Kefir', u: '1 bardak', k: 120, p: 7 },
  { n: 'Ayran', u: '1 bardak', k: 75, p: 4 },
  { n: 'Protein shake', u: '1 ölçü whey, suyla', k: 120, p: 24, a: ['whey'] },

  /* İçecek */
  { n: 'Kola', u: '1 kutu (330 ml)', k: 140, p: 0, a: ['gazlı içecek'] },
  { n: 'Kola zero', u: '1 kutu', k: 1, p: 0, a: ['light', 'şekersiz kola'] },
  { n: 'Meyve suyu', u: '1 bardak', k: 110, p: 1 },
  { n: 'Şekerli çay', u: '1 bardak, 2 şeker', k: 35, p: 0 },
  { n: 'Türk kahvesi, şekerli', u: '1 fincan', k: 25, p: 0, i: 'turk-kahvesi' },
  { n: 'Latte', u: '1 büyük', k: 200, p: 10 },
  { n: 'Cappuccino', u: '1 orta', k: 120, p: 6 },
  { n: 'Salep', u: '1 bardak', k: 200, p: 6 },
  { n: 'Boza', u: '1 bardak', k: 200, p: 2 },
  { n: 'Bira', u: '1 kutu (500 ml)', k: 210, p: 2 },
  { n: 'Şarap', u: '1 kadeh', k: 125, p: 0 },
  { n: 'Rakı', u: '1 tek', k: 120, p: 0 },

  /* Tatlı */
  { n: 'Baklava', u: '1 dilim', k: 170, p: 3 },
  { n: 'Künefe', u: '1 porsiyon', k: 600, p: 14 },
  { n: 'Sütlaç', u: '1 kase', k: 250, p: 7 },
  { n: 'Kazandibi', u: '1 porsiyon', k: 280, p: 7 },
  { n: 'Profiterol', u: '1 porsiyon', k: 450, p: 7 },
  { n: 'Revani', u: '1 dilim', k: 300, p: 4 },
  { n: 'Trileçe', u: '1 dilim', k: 350, p: 7 },
  { n: 'Cheesecake', u: '1 dilim', k: 400, p: 7 },
  { n: 'Tulumba', u: '1 adet', k: 70, p: 1 },
  { n: 'Lokum', u: '1 adet', k: 40, p: 0 },
  { n: 'Tahin helvası', u: '50 g', k: 260, p: 6, a: ['helva'] },
  { n: 'Dondurma', u: '1 top', k: 120, p: 2 },
  { n: 'Sütlü çikolata', u: '30 g', k: 160, p: 2, a: ['çikolata'] },
  { n: 'Kek', u: '1 dilim', k: 250, p: 4 },
  { n: 'Kurabiye', u: '1 adet', k: 80, p: 1 },
  { n: 'Waffle', u: '1 adet', k: 600, p: 9 },

  /* Atıştırmalık */
  { n: 'Cips', u: '1 küçük paket (40 g)', k: 210, p: 2.5 },
  { n: 'Karışık kuruyemiş', u: '1 avuç (30 g)', k: 180, p: 5, a: ['kuruyemiş'] },
  { n: 'Leblebi', u: '1 avuç', k: 110, p: 6 },
  { n: 'Badem', u: '10 adet', k: 70, p: 2.5 },
  { n: 'Ceviz', u: '2 tam', k: 130, p: 3 },
  { n: 'Fındık', u: '10 adet', k: 90, p: 2 },
  { n: 'Kraker', u: '1 paket', k: 150, p: 3 },
  { n: 'Bisküvi', u: '3 adet', k: 140, p: 2 },
  { n: 'Gofret', u: '1 adet', k: 150, p: 2 },
  { n: 'Protein bar', u: '1 adet', k: 200, p: 20 },
  { n: 'Patlamış mısır', u: '1 kase', k: 100, p: 3 },
  { n: 'Kuru incir', u: '2 adet', k: 100, p: 1 },
  { n: 'Hurma', u: '2 adet', k: 130, p: 1 },

  /* Meyve */
  { n: 'Elma', u: '1 orta', k: 80, p: 0 },
  { n: 'Muz', u: '1 orta', k: 105, p: 1 },
  { n: 'Portakal', u: '1 orta', k: 90, p: 1 },
  { n: 'Mandalina', u: '2 adet', k: 90, p: 1 },
  { n: 'Armut', u: '1 orta', k: 100, p: 1 },
  { n: 'Üzüm', u: '1 kase', k: 100, p: 1 },
  { n: 'Karpuz', u: '1 dilim', k: 90, p: 2 },
  { n: 'Kavun', u: '1 dilim', k: 60, p: 1 },
  { n: 'Çilek', u: '1 kase', k: 50, p: 1 },
  { n: 'Kiraz', u: '1 kase', k: 90, p: 1 },
  { n: 'Şeftali', u: '1 orta', k: 60, p: 1 },
];

/* ---------- Gıda ikonları ----------
   img/f/<kimlik>-160.webp ve -320.webp; kaynakları ve üretim hattı design/ikon/ içinde. Kimlik adın fold'u, boşluklar tire
   ("Kaşarlı pide" → kasarli-pide). Bir yemeğin adı, eş adı ya da i alanı bu listedekilerden birine denk gelirse kartında ikonu çıkar. */
const ICONS = (
  'acik-cay acma adana-kebap armut avokado ayran badem baklava bal balik-ekmek bazlama beyaz-ekmek beyaz-peynir ' +
  'biftek bira biskuvi boza bulgur-pilavi cacik cappuccino ceviz cheeseburger cheesecake cig-kofte-durum cilek ' +
  'cips coban-salata cokelek dondurma doner-durum elma esmer-pirinc et-sis etli-biber-dolmasi etli-kuru-fasulye ' +
  'etli-nohut ezogelin-corbasi findik findik-kremasi firin-tavuk-but galeta gofret granola hamburger hamsi-tava ' +
  'haslanmis-patates haslanmis-yumurta humus hunkar-begendi hurma icli-kofte imam-bayildi iskembe-corbasi ' +
  'iskender-kebap islak-hamburger izgara-kofte izgara-tavuk-gogsu kabak-cekirdegi kahve karisik-kuruyemis ' +
  'karisik-tost karniyarik karpuz kasar-peyniri kasarli-pide kasarli-tost kavun kayisi kazandibi kefir kek ' +
  'keten-tohumu kiraz kisir kivi kiymali-pide kofte-ekmek kokorec kol-boregi kola kola-zero kraker kumpir kumru ' +
  'kunefe kurabiye kuru-fasulye-pilav kuru-incir kusbasili-pide kuzu-pirzola lahmacun latte lavas leblebi ' +
  'levrek-izgara limonlu-su lokum lor makarna-sade makarna-soslu mandalina manti menemen mercimek-corbasi ' +
  'mercimek-koftesi meyve-suyu midye-dolma muz omlet patates-kizartmasi patlamis-misir peynirli-gozleme ' +
  'pilav-ustu-doner pilav-ustu-tavuk-doner pirinc-patlagi pirinc-pilavi pizza pogaca portakal profiterol ' +
  'protein-bar protein-shake protein-sut quark raki recel revani salep sandvic sarap seftali sekerli-cay ' +
  'serpme-kahvalti sezar-salata sigara-boregi simit skyr sogus somon su su-boregi sucuk sucuk-ekmek ' +
  'sucuklu-yumurta sushi sut sutlac sutlu-cikolata suzme-yogurt tahin-helvasi tam-bugday-ekmegi ' +
  'tam-bugday-makarna tantuni tarhana-corbasi tavuk-burger tavuk-doner-durum tavuk-kanat tavuk-nugget tavuk-pilav ' +
  'tavuk-sis tavuk-sote tavuk-suyu-corba tereyagi ton-baligi trilece tulumba turk-kahvesi urfa-kebap uzum waffle ' +
  'wrap yaprak-sarma yayla-corbasi yesil-salata yogurt yulaf-ezmesi yulaf-lapasi zeytin zeytinyagi ' +
  'zeytinyagli-taze-fasulye'
).split(' ');
