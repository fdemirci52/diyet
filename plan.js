/* ---------- Diyetisyen programı ----------
   Uygulama ile diyetisyen paneli arasındaki sözleşme bu nesnedir. Saf JSON olmalı
   (işlev, paylaşılan referans yok); panel aynı biçimi üretecek, uygulama da olduğu gibi okuyacak.
   Kimlikler (öğün, kalem, ana yemek) kayıtlarda anahtar olarak saklanır: yayındaki bir
   planda değiştirilmez, yalnızca yenisi eklenir.

   k: tahmini kcal, p: tahmini protein (g). Kalemlerde:
   name ana ad · opts eşdeğer seçenekler (ilki gösterilir) · meta alt satır · subs muadiller
   chip kısa ad (öğün özetinde) · optional sayılmaz, işaretlenmesi gerekmez. */
const PLAN_DEFAULT = {
  v: 1,
  id: 'plan-2026-11-13',
  date: '2026-11-13',
  dietitian: { name: '', phone: '' },
  /* Diyetisyenin danışan için seçtikleri. kcal: danışan kalori sayılarını görür mü (motor her durumda hesaplar).
     tune: plandan sapınca kalan öğünlere telafi önerilsin mi. */
  prefs: { kcal: true, tune: true },
  client: { name: '' },
  goal: { kg: 85, text: 'Göbeksiz, kas ağırlıklı. Önce yağ ver, sonra kaloriyi artırıp tırman.' },

  /* Kalem kataloğu: öğünler buradan kimlikle seçer. */
  items: {
    limon: { k: 0, p: 0, chip: 'Ilık limonlu su', name: '2 bardak ılık su', meta: 'İçine 2-3 damla limon' },
    peynir: { k: 160, p: 10, chip: 'Peynir', name: 'Peynir', opts: ['2 dilim beyaz peynir (60 g)', '4 yk tuzsuz lor', '4 yk çökelek'], subs: ['60 g az tuzlu kaşar', '1 yumurta + 1 dilim peynir'] },
    yumurta: { k: 150, p: 13, chip: '2 yumurta', name: '2 haşlanmış yumurta', meta: 'Tuzsuz', subs: ['2 yumurtalı yağsız omlet', 'Yağsız menemen (2 yumurta)'] },
    sebze: { k: 30, p: 1, chip: 'Söğüş', name: 'Domates, salatalık, yeşillik', meta: 'Tuzsuz, yağsız' },
    yag: { k: 110, p: 2, chip: 'Avokado ya da ceviz', name: 'Avokado veya ceviz', opts: ['Yarım avokado', '2-3 tam ceviz'], subs: ['6-8 çiğ badem / fındık', '1 tatlı kaşığı zeytinyağı', '5-6 zeytin'] },
    ekmek: { k: 125, p: 5, chip: 'Ekmek', name: '2 dilim tam buğday ekmeği', meta: '50 g · eksik yeme', subs: ['4 yk yulaf ezmesi (40 g)', '6 yk bulgur pilavı', '6 yk tam buğday makarna / esmer pirinç', '1 orta boy haşlanmış patates (~180 g)', '1 küçük tam buğday lavaş (50 g)'] },
    cay: { k: 0, p: 0, name: '1 fincan açık şekersiz çay', meta: 'İsteğe bağlı', optional: true },
    yogurt: { k: 45, p: 3, chip: 'Yoğurt', name: 'Yoğurt veya ayran', opts: ['3-4 yk yoğurt + 1 çk keten tohumu', '1 bardak ayran'], subs: ['1 küçük kase cacık (yağsız)', '1 çay bardağı kefir'] },
    salata: { k: 70, p: 1, chip: 'Salata', name: 'Bol salata', meta: '1 tatlı kaşığı sıvıyağ', subs: ['Haşlama / ızgara sebze (1 tatlı kaşığı yağ)', 'Yağsız söğüş + 5 zeytin'] },
    galeta: { k: 100, p: 3, chip: 'Galeta', name: 'Galeta veya leblebi', opts: ['5 karabuğdaylı-yulaflı galeta', '5-6 minik kepekli galeta', '2 kalın uzun kepekli galeta', '½ çay bardağı leblebi'], subs: ['1 dilim tam buğday ekmeği (25 g)', '2 yk yulaf ezmesi', '2 pirinç patlağı'] },
    meyve: { k: 70, p: 1, chip: 'Meyve', name: '1 porsiyon meyve', meta: '1 küçük elma · 1 portakal · 2 mandalina · 1 küçük muz', subs: ['10-12 çilek', '3 kayısı / 2 kivi', '1 ince dilim kavun / karpuz', '15 üzüm'] },
    bar: { k: 200, p: 20, chip: 'Protein bar', name: '1 protein bar' },
    psut: { k: 160, p: 22, chip: 'Protein süt', name: 'Protein süt veya quark', opts: ['1 bardak protein süt', '1 kutu sek quark protein'], subs: ['200 g yüksek proteinli yoğurt (skyr)', '1 ölçü whey + su'] },
    kabak: { k: 115, p: 6, chip: 'Kabak çekirdeği', name: '1 avuç içi çiğ kabak çekirdeği', subs: ['6-8 çiğ badem / fındık', '2 tam ceviz'] },
  },

  /* Ana yemekler (main: true olan öğünlere düşer). g: kota grubu · ai: yapay zekâya tarif
     · noSalad: salatayı öğünden çıkarır (yemeğin içinde). */
  mains: [
    { id: 'bakla', g: 'bakla', k: 250, p: 15, chip: 'Kurubaklagil', ai: 'kurubaklagil yemeği', name: '8 yk kurubaklagil yemeği', meta: 'Susuz · kurufasulye, nohut, barbunya', subs: ['8 yk yeşil mercimek yemeği', '8 yk börülce / bakla'] },
    { id: 'kofte', g: 'kofte', k: 330, p: 27, chip: 'Köfte', ai: 'ızgara köfte', name: '5 ızgara köfte', meta: 'Izgara veya tost makinesinde', subs: ['150 g yağsız ızgara et (bonfile, antrikot)', '150 g hindi / tavuk köfte'] },
    { id: 'tavuk', g: 'tb', k: 250, p: 35, chip: 'Tavuk', name: '150 g tavuk', meta: 'Izgara, haşlama veya fırın', subs: ['150 g hindi göğsü', '5 ızgara köfte'] },
    { id: 'balik', g: 'tb', k: 330, p: 40, chip: 'Balık', name: '250 g balık', meta: 'Izgara, buğulama veya fırın', subs: ['150 g tavuk', '160 g ton balığı'] },
    { id: 'ton', g: 'ton', k: 260, p: 35, chip: 'Ton balıklı', ai: 'ton balıklı salata', name: '160 g ton balıklı salata', meta: 'Salatası içinde', noSalad: true, subs: ['150 g tavuklu salata', '3 haşlanmış yumurtalı salata'] },
  ],
  /* Her ana yemek öğünü için haftalık kota (sıra, eşitlikte öncelik sırasıdır). */
  groups: { bakla: { name: 'Kurubaklagil', perWeek: 2 }, kofte: { name: 'Köfte', perWeek: 2 }, tb: { name: 'Tavuk / balık', perWeek: 2 }, ton: { name: 'Ton balıklı salata', perWeek: 1 } },
  /* Pazartesi'den Pazar'a varsayılan dağılım: her öğün kendi kotasını tutturur. */
  rota: { ogle: ['bakla', 'tavuk', 'kofte', 'bakla', 'balik', 'kofte', 'ton'], aksam: ['kofte', 'bakla', 'balik', 'ton', 'kofte', 'tavuk', 'bakla'] },

  /* Öğünler. time hafta içi, wknd hafta sonu saati; saati olmayan öğün tek dokunuşla işaretlenir.
     modes + alt: öğünün ikinci biçimi (ör. galeta + meyve yerine protein bar). */
  meals: [
    { id: 'sabah', title: 'Uyanınca', items: ['limon'] },
    { id: 'kahvalti', title: 'Kahvaltı', time: '11:00', wknd: '10:00', items: ['peynir', 'yumurta', 'sebze', 'yag', 'ekmek', 'cay'] },
    { id: 'ogle', title: 'Öğle', time: '14:00', wknd: '14:00', main: true, items: ['yogurt', 'ekmek', 'salata'] },
    { id: 'ikindi', title: 'İkindi', time: '16:00', wknd: '16:30', modes: ['Galeta + meyve', 'Protein bar'], items: ['galeta', 'meyve'], alt: ['bar'] },
    { id: 'aksam', title: 'Akşam', time: '20:00', wknd: '19:00', main: true, items: ['yogurt', 'ekmek', 'salata'] },
    { id: 'gece', title: 'Gece', time: '21:00', wknd: '21:00', items: ['psut', 'kabak'] },
  ],

  rules: [
    ['Çay açık ve şekersiz', 'Yemekten en az 40 dk sonra; demir emilimini bozmasın diye'],
    ['Kahve günde en fazla 2 fincan', 'Sade; her fincanla birlikte 2 bardak su'],
    ['Ara öğün atlama', ''], ['Ekmekleri eksik yeme', ''],
    ['Bir öğün sebze, diğer öğün et ya da kurubaklagil', 'Öğle ve akşam haftada en çok 2 gün yer değiştirebilir'],
    ['Her gün tartılma', ''], ['Günde 2-2,5 litre su', ''],
    ['Haftada 3 gün 45 dk yürüyüş', 'veya 5K / 3 mil Leslie'],
    ['Yazanları ne eksik ne fazla ye', ''],
  ],
  swaps: [
    ['2 dilim tam buğday ekmeği (50 g)', '4 yk yulaf ezmesi (40 g) · 6 yk bulgur pilavı · 6 yk tam buğday makarna / esmer pirinç · 1 orta boy haşlanmış patates (~180 g) · 1 küçük tam buğday lavaş (50 g)'],
    ['30 g et / tavuk / balık', '1 köfte · 1 yumurta · 1 dilim (30 g) peynir · 2 yk lor'],
    ['3-4 yk yoğurt', '1 bardak ayran · 1 çay bardağı kefir · 1 küçük kase cacık'],
    ['1 tatlı kaşığı sıvıyağ', '5-6 zeytin · 2 ceviz içi · 6 badem / fındık'],
    ['1 porsiyon meyve', '1 küçük elma · 1 portakal · 2 mandalina · 1 küçük muz · 10-12 çilek'],
    ['1 bardak protein süt', '1 kutu quark · 200 g skyr · 1 ölçü whey'],
  ],
  body: { date: '2026-11-13', fat: '%14,5', rows: [['Kilo', '83,9 kg'], ['Boy', '188 cm'], ['BMI', '23,7'], ['Yağ', '%14,5 · 12,2 kg'], ['Kas', '68,2 kg'], ['İç yağlanma', '3 (1-13)'], ['Bazal metabolizma', '2.093 kcal'], ['Metabolik yaş', '24'], ['Bel', '86 cm'], ['Fit puanı', '95 / 100']] },

  /* Gün boyu hedefler. water.goal bardak, water.ml bardak başına. */
  daily: { water: { goal: 10, ml: 250 }, coffee: { max: 2, note: 'En fazla 2 fincan, sade' }, walk: { perWeek: 3, name: '45 dk yürüyüş' } },

  /* Ağırlık antrenmanı. days anahtarı haftanın günü (0 Paz, 1 Pzt … 6 Cmt); after: zaman çizelgesinde
     hangi öğünden sonra durduğu; notes: antrenman günü o öğünün üstünde görünen not. */
  training: { perWeek: 3, time: '18:00', after: 'ikindi', lead: 'Haftada üç gün, akşam 18:00-19:00.',
    notes: { ikindi: 'Antrenmandan önce: galeta ve meyveyi seç, karbonhidrat işe yarar.', aksam: 'Antrenmandan sonra: bu öğünü ve ekmeğini atlama.' },
    days: {
      1: { name: 'Üst', pre: 'İp 6 dk: 60 sn rahat tempo, 30 sn dinlenme, 4 tur', post: '10-15 dk Zone 2 · bisiklet ya da %5-10 eğimli yürüyüş', ex: [
        ['Bench', '3×5-8'], ['Ağırlıklı barfiks', '3×5-8'], ['OHP', '2×6-10'], ['Row', '3×8-10'], ['Peck Deck', '2×10-15'], ['Hammer Curl', '2×8-12'], ['Lateral Raise', '3×12-20']] },
      3: { name: 'Alt', pre: 'İp yok; istersen 2 dk çok rahat ısınma', post: '8-10 dk çok hafif bisiklet · koşu yok', ex: [
        ['Zercher Squat', '3×5-8'], ['RDL', '3×6-10'], ['Bulgarian Split Squat', '2×8-12'], ['Leg Curl', '2×10-15'], ['Calf Raise', '3×12-20'], ['Boyun 4 yön', '1×15-20'], ['Ab Roller', '2×8-15']] },
      5: { name: 'Full body', pre: 'İp: 90 sn orta tempo, 60 sn dinlenme, 3 tur', post: '10-15 dk Zone 2 · tercihen bisiklet; sert koşu ya da interval yok', ex: [
        ['Barbell Squat', '3×5'], ['Paused Bench', '2×6-8'], ['Weighted Dips', '3×6-10'], ['Lat Pulldown', '3×8-12'], ['Leg Curl', '2×10-15'], ['Face Pull', '2×15-20'], ['Lateral Raise', '2×12-20']] },
    } },

  /* Telafi: motorun önerebileceği eklemeler ve azaltmalar. Diyetisyen bunları onaylar.
     at: önerinin düşeceği öğün; liste ise ilk açık olan. 'main' ana yemekli öğün, 'first' ilk açık
     öğün, 'last' son açık öğün. Adlarda {n} adet, {g} adet × g gram. k ve p birim başınadır. */
  tune: {
    protein: [
      { at: 'main', name: '+{g} g et / tavuk ({n} köfte kadar)', g: 30, k: 55, p: 7, max: 3 },
      { at: 'gece', name: '+2 haşlanmış yumurta ya da 1 kutu quark', k: 150, p: 14 },
      { at: 'first', name: '+1 haşlanmış yumurta', k: 75, p: 6.5 },
    ],
    carb: { at: 'first', name: '+{n} dilim tam buğday ekmeği', k: 62, p: 2.5, max: 2 },
    snack: { at: ['ikindi', 'gece', 'last'], name: '+1 porsiyon meyve ya da 2 ceviz', k: 80, p: 1 },
    /* Fazlada sırayla azaltılacak kalemler; protein kalemleri burada yer almaz. k ve p azalan miktar. */
    cuts: [
      { item: 'salata', name: 'Bol salata, yağsız', k: 45, p: 0 },
      { item: 'kabak', name: '½ avuç kabak çekirdeği', k: 57, p: 3 },
      { item: 'yag', name: '¼ avokado veya 1 ceviz', k: 55, p: 1 },
      { item: 'ekmek', name: '1 dilim tam buğday ekmeği', k: 62, p: 2.5 },
    ],
  },
};
