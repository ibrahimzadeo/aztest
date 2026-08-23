"""Starter task library.

Eighteen Azerbaijani writing tasks chosen to separate models rather than to
flatter them: registers that need real morphology, domains with settled
terminology, translation prompts where a calque is the obvious wrong answer,
and orthography traps where diacritics carry the meaning. Seeding is
idempotent by `code`, and editing a seeded task in the UI is expected — the
seed never overwrites an existing row.
"""

from __future__ import annotations

import asyncio
import logging

from .db import Database

log = logging.getLogger("azbench.seed")

TASKS = [
    {
        "code": "RESMI-01", "category": "Rəsmi yazışma", "register": "formal",
        "title": "Bank müştərisinə rəsmi cavab məktubu",
        "prompt": "Bir bankın müştəri xidmətləri şöbəsinin adından rəsmi cavab məktubu yaz. "
                  "Müştəri kart hesabından səhvən iki dəfə silinmiş 250 manat barədə şikayət edib. "
                  "Məktubda: müraciətə istinad, araşdırmanın nəticəsi, vəsaitin 3 iş günü ərzində "
                  "qaytarılacağı, üzrxahlıq və əlaqə məlumatı olmalıdır. 180-250 söz.",
        "guidance": "Rəsmi registr, klişe ifadələrin düzgün işlənməsi, hörmətli müraciət forması.",
    },
    {
        "code": "RESMI-02", "category": "Rəsmi yazışma", "register": "formal",
        "title": "Dövlət qurumuna ərizə",
        "prompt": "Dövlət qurumuna ünvanlanmış ərizə yaz: vətəndaş yaşadığı binanın həyətində "
                  "uzun müddət təmir olunmayan işıqlandırma sisteminin bərpasını xahiş edir. "
                  "Ərizənin strukturu (ünvanlanma, məsələnin izahı, xahiş, tarix, imza sətri) "
                  "gözlənilməlidir. 150-200 söz.",
        "guidance": "Kargüzarlıq üslubu, üçüncü şəxs müraciəti, hüquqi-inzibati leksika.",
    },
    {
        "code": "MEDIA-01", "category": "Media", "register": "neutral",
        "title": "Xəbər mətni yaz",
        "prompt": "Aşağıdaki faktlar əsasında 120-160 sözlük xəbər mətni yaz: Bakıda yeni metro "
                  "stansiyası açılıb; stansiya gündəlik 40 min sərnişinə xidmət edəcək; tikinti "
                  "iki il çəkib; nazir açılışda iştirak edib. Başlıq və birinci abzasda ən vacib "
                  "məlumat (lead) olmalıdır.",
        "guidance": "Jurnalist üslubu, hərəkətli fel formaları, faktların düzgün sıralanması.",
    },
    {
        "code": "MEDIA-02", "category": "Media", "register": "neutral",
        "title": "Mətni xülasə et",
        "prompt": "Aşağıdaki mətni Azərbaycan dilində 60-80 sözlə xülasə et:\n\n"
                  "\"Son on ildə ölkədə qeyri-neft sektorunun ümumi daxili məhsuldaki payı "
                  "tədricən artmışdır. Kənd təsərrüfatı, turizm və informasiya texnologiyaları "
                  "bu artımın əsas mənbələri olub. Bununla belə, ixracın strukturunda enerji "
                  "resurslarının payı hələ də üstünlük təşkil edir və bu, xarici bazarlardaki "
                  "qiymət dəyişmələrinə həssaslığı saxlayır. Ekspertlər emal sənayesinə "
                  "investisiyaların artırılmasını, kiçik və orta sahibkarlığa çıxış imkanlarının "
                  "genişləndirilməsini tövsiyə edirlər.\"",
        "guidance": "Sıxlıq, təkrarın olmaması, mənbə mətnə sadiqlik.",
    },
    {
        "code": "HUQUQ-01", "category": "Hüquq və maliyyə", "register": "formal",
        "title": "Müqavilə bəndi yaz",
        "prompt": "Xidmət müqaviləsi üçün 'Məxfilik' bəndini Azərbaycan dilində yaz. Bəndə "
                  "məxfi məlumatın tərifi, tərəflərin öhdəlikləri, istisnalar və məxfilik "
                  "müddətinin müqavilə bitdikdən sonra 3 il davam etməsi daxil edilməlidir. "
                  "Hüquqi dil, nömrələnmiş yarımbəndlər.",
        "guidance": "Hüquqi terminologiya, uzun cümlələrin düzgün qurulması, dəqiqlik.",
    },
    {
        "code": "HUQUQ-02", "category": "Hüquq və maliyyə", "register": "formal",
        "title": "Maliyyə hesabatı şərhi",
        "prompt": "Rüblük maliyyə hesabatına idarə heyəti şərhi yaz: gəlir əvvəlki rübə nisbətən "
                  "12% artıb, əməliyyat xərcləri 8% artıb, xalis mənfəət 15% artıb, borc yükü "
                  "dəyişməyib. Şərh peşəkar, ölçülü tonda olmalı, rəqəmləri şərh etməli və "
                  "növbəti rüb üzrə gözləntini bildirməlidir. 150-200 söz.",
        "guidance": "Maliyyə terminləri (gəlir, mənfəət, öhdəlik, marja), rəqəmlərin yazılışı.",
    },
    {
        "code": "TEXNIKI-01", "category": "Texniki", "register": "neutral",
        "title": "İstifadəçi təlimatı",
        "prompt": "Mobil bank tətbiqində kart blokunun açılması üçün addım-addım istifadəçi "
                  "təlimatı yaz. 6-8 addım, hər addım qısa əmr cümləsi. Sonda bir xəbərdarlıq "
                  "qeydi (bloklama səbəbi təhlükəsizliklə bağlı olduqda nə etmək lazımdır).",
        "guidance": "Əmr formaları, texniki terminlərin (bloklama, təsdiq kodu, hesab) düzgün seçimi.",
    },
    {
        "code": "TEXNIKI-02", "category": "Texniki", "register": "neutral",
        "title": "Termin izahı — qeyri-mütəxəssis üçün",
        "prompt": "\"İki faktorlu autentifikasiya\" nədir? Texniki hazırlığı olmayan oxucu üçün "
                  "Azərbaycan dilində izah et: nə olduğu, necə işlədiyi, nə üçün lazım olduğu və "
                  "bir gündəlik nümunə. 120-160 söz, anqlisizmlərdən mümkün qədər çəkinərək.",
        "guidance": "Sadələşdirmə bacarığı, terminin AZ qarşılığının tapılması.",
    },
    {
        "code": "TERCUME-01", "category": "Tərcümə", "register": "neutral",
        "title": "İngiliscədən tərcümə",
        "prompt": "Aşağıdaki mətni Azərbaycan dilinə tərcümə et. Hərfi tərcümədən çəkin, təbii "
                  "Azərbaycan dilində yaz:\n\n\"We regret to inform you that your application has "
                  "not been successful on this occasion. The panel was impressed by your "
                  "background, but the role required hands-on experience with regulatory "
                  "reporting, which other candidates demonstrated more directly. We would "
                  "encourage you to apply again for future openings.\"",
        "guidance": "Kalka cümlə quruluşundan qaçmaq, rəsmi HR registri.",
    },
    {
        "code": "TERCUME-02", "category": "Tərcümə", "register": "neutral",
        "title": "Rus dilindən tərcümə",
        "prompt": "Aşağıdaki mətni Azərbaycan dilinə tərcümə et, rusizmlərdən qaçaraq:\n\n"
                  "\"В связи с проведением плановых технических работ обслуживание клиентов "
                  "в отделении будет приостановлено с 10:00 до 14:00. Просим вас заранее "
                  "спланировать посещение или воспользоваться мобильным приложением.\"",
        "guidance": "Rus sintaksisinin təsirindən azad tərcümə, elan üslubu.",
    },
    {
        "code": "DANISIQ-01", "category": "Danışıq dili", "register": "colloquial",
        "title": "Təbii dialoq yaz",
        "prompt": "İki nəfər arasında qısa, təbii danışıq dilində dialoq yaz (10-12 replika): "
                  "biri internet provayderinə zəng edib evdə internetin kəsildiyini bildirir, "
                  "operator problemi aydınlaşdırır. Süni, kitab dili olmasın; eyni zamanda "
                  "rusizmlərlə dolu olmasın.",
        "guidance": "Canlı danışıq registri, təbii replika uzunluğu, ədəbi normanın saxlanması.",
    },
    {
        "code": "DANISIQ-02", "category": "Danışıq dili", "register": "colloquial",
        "title": "Sosial media postu",
        "prompt": "Bir kafenin sosial media səhifəsi üçün yeni səhər menyusunu tanıdan post yaz. "
                  "Dostyana, sıcaq ton, 60-90 söz, 2-3 emoji, sonda çağırış (call to action). "
                  "Azərbaycan dilində, tərcümə qoxusu olmadan.",
        "guidance": "Marketinq tonu, qısa cümlələr, təbii çağırış ifadələri.",
    },
    {
        "code": "REDAKTE-01", "category": "Redaktə", "register": "neutral",
        "title": "Səhvləri düzəlt və izah et",
        "prompt": "Aşağıdaki mətndə orfoqrafiya, qrammatika və üslub səhvlərini düzəlt, sonra "
                  "hər düzəlişi qısa izah et:\n\n\"Hormetli mustəri, sizin muracietiniz baxildi "
                  "ve netice olaraq bildiririk ki, hesabınıza olan vesait geri qaytarilacaq. "
                  "Bu mesele ile elaqedar əlave sual olarsa, bizimlə elaqe saxlaya bilərsiz.\"",
        "guidance": "Diakritikanın bərpası, şəkilçi səhvləri, izahın dəqiqliyi.",
    },
    {
        "code": "REDAKTE-02", "category": "Redaktə", "register": "neutral",
        "title": "Türkiyə türkcəsindən Azərbaycan dilinə uyğunlaşdır",
        "prompt": "Aşağıdaki mətn Türkiyə türkcəsində yazılmışdır. Onu Azərbaycan ədəbi dilinə "
                  "uyğunlaşdır (tərcümə deyil, uyğunlaşdırma):\n\n\"Değerli kullanıcı, talebiniz "
                  "için teşekkür ederiz. Şu anda sistemde bir güncelleme yapılıyor, bu yüzden "
                  "bazı işlemler geçici olarak kullanılamıyor. Nasıl bir sorun yaşadığınızı "
                  "bize bildirirseniz, en kısa sürede yardımcı olacağız.\"",
        "guidance": "TR-AZ leksik və qrammatik fərqlərin bilinməsi (değil/deyil, için/üçün, gibi/kimi).",
    },
    {
        "code": "YARADICI-01", "category": "Yaradıcı", "register": "neutral",
        "title": "Qısa hekayə başlanğıcı",
        "prompt": "Bakının köhnə bir məhəlləsində səhər saatlarını təsvir edən qısa hekayə "
                  "başlanğıcı yaz (150-200 söz). Bir personaj, bir konkret detal, bir cümlə "
                  "dialoq olsun. Klişelərdən çəkin.",
        "guidance": "Bədii dil, obrazlılıq, təsvir zənginliyi, klişe təhlili.",
    },
    {
        "code": "YARADICI-02", "category": "Yaradıcı", "register": "neutral",
        "title": "Reklam şüarları",
        "prompt": "Yeni açılan Azərbaycan dili onlayn kursu üçün 8 fərqli reklam şüarı yaz. Hər "
                  "biri 6 sözdən qısa olsun, biri atalar sözü üslubunda, biri sual formasında, "
                  "biri söz oyunu ilə. Hamısı təbii Azərbaycan dilində.",
        "guidance": "Qısalıq, söz oyunu bacarığı, təkrarsızlıq.",
    },
    {
        "code": "TELEB-01", "category": "Təlimata uyğunluq", "register": "neutral",
        "title": "Ciddi format tələbi",
        "prompt": "Azərbaycanda kiçik biznes üçün vergi uçotunun 5 addımını yaz. Format tələbləri: "
                  "hər addım tam olaraq bir cümlə; hər cümlə fellə bitsin; nömrələmə '1)' "
                  "formasında; başlıq olmasın; ümumi həcm 90 sözdən çox olmasın; heç bir "
                  "ingilis sözü işlədilməsin.",
        "guidance": "Təlimata dəqiq riayət — format pozuntusu birbaşa görünür.",
    },
    {
        "code": "TELEB-02", "category": "Təlimata uyğunluq", "register": "formal",
        "title": "Uzunluq və struktur nəzarəti",
        "prompt": "Şirkət daxili elan yaz: növbəti həftədən etibarən ofisə giriş yeni elektron "
                  "kartlarla həyata keçiriləcək. Tələblər: dəqiq üç abzas; birinci abzas 2 cümlə, "
                  "ikinci 3 cümlə, üçüncü 1 cümlə; heç bir siyahı və ya madde işarəsi olmasın; "
                  "rəsmi registr.",
        "guidance": "Struktur tələbinə riayət, rəsmi ton, artıq sözdən çəkinmə.",
    },
]

DEFAULT_SUITE = {
    "code": "AZ-CORE",
    "name": "AZ Core — tam dəst",
    "description": "Bütün 18 tapşırıq: rəsmi yazışma, media, hüquq/maliyyə, texniki, tərcümə, "
                   "danışıq dili, redaktə, yaradıcı və təlimata uyğunluq.",
}

QUICK_SUITE = {
    "code": "AZ-QUICK",
    "name": "AZ Quick — sürətli yoxlama",
    "description": "Altı tapşırıqlıq qısa dəst: bir rəsmi, bir media, bir tərcümə, bir redaktə, "
                   "bir danışıq, bir təlimat testi. Yeni modeli tez süzgəcdən keçirmək üçün.",
    "codes": ["RESMI-01", "MEDIA-01", "TERCUME-01", "REDAKTE-02", "DANISIQ-01", "TELEB-01"],
}


async def seed(db: Database) -> dict:
    """Insert any missing seed tasks and the two default suites. Never
    overwrites an edited row — the operator owns the library after seeding."""
    existing = {t["code"]: t for t in await db.tasks()}
    created = []
    for spec in TASKS:
        if spec["code"] in existing:
            continue
        row = await db.create_task(
            code=spec["code"], title=spec["title"], category=spec["category"],
            register=spec["register"], prompt=spec["prompt"], guidance=spec["guidance"],
        )
        created.append(row["code"])
        existing[row["code"]] = row

    suites = {s["code"]: s for s in await db.suites()}
    suites_created = []
    if DEFAULT_SUITE["code"] not in suites:
        ids = [str(existing[s["code"]]["id"]) for s in TASKS if s["code"] in existing]
        await db.create_suite(DEFAULT_SUITE["code"], DEFAULT_SUITE["name"],
                              DEFAULT_SUITE["description"], ids)
        suites_created.append(DEFAULT_SUITE["code"])
    if QUICK_SUITE["code"] not in suites:
        ids = [str(existing[c]["id"]) for c in QUICK_SUITE["codes"] if c in existing]
        await db.create_suite(QUICK_SUITE["code"], QUICK_SUITE["name"],
                              QUICK_SUITE["description"], ids)
        suites_created.append(QUICK_SUITE["code"])

    return {"tasks_created": created, "suites_created": suites_created}


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    db = Database()
    await db.connect()
    try:
        result = await seed(db)
        print(f"Seed: {len(result['tasks_created'])} task(s), "
              f"{len(result['suites_created'])} suite(s) created.")
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
