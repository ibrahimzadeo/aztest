"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// Two languages, one dictionary, no library. The tool is used by Azerbaijani
// reviewers and by admins who do not read Azerbaijani, so both have to be
// first-class rather than one being a machine-translated afterthought.
export const LANGS = { az: "AZ", en: "EN" };
const DEFAULT = "az";
const STORAGE_KEY = "aztest_lang";

const DICT = {
  common: {
    save: ["Yadda saxla", "Save"],
    saving: ["Yazılır…", "Saving…"],
    cancel: ["Ləğv et", "Cancel"],
    close: ["Bağla", "Close"],
    delete: ["Sil", "Delete"],
    edit: ["Redaktə", "Edit"],
    add: ["Əlavə et", "Add"],
    loading: ["Yüklənir…", "Loading…"],
    all: ["Hamısı", "All"],
    none: ["—", "—"],
    model: ["Model", "Model"],
    models: ["Modellər", "Models"],
    task: ["Tapşırıq", "Task"],
    tasks: ["Tapşırıqlar", "Tasks"],
    status: ["Status", "Status"],
    date: ["Tarix", "Date"],
    cost: ["Xərc", "Cost"],
    answer: ["Cavab", "Answer"],
    answers: ["Cavablar", "Answers"],
    score: ["Bal", "Score"],
    judge: ["Hakim", "Judge"],
    prompt: ["Prompt", "Prompt"],
    selected: ["seçilib", "selected"],
    optional: ["istəyə bağlı", "optional"],
    enabled: ["aktivdir", "enabled"],
    disabled: ["söndürülüb", "disabled"],
    active: ["aktiv", "active"],
    error: ["xəta", "error"],
    running: ["işləyir", "running"],
    queued: ["gözləyir", "queued"],
    truncated: ["kəsilib", "cut off"],
    empty_answer: ["(boş cavab)", "(empty answer)"],
    thinking_tokens: ["düşünmə", "reasoning"],
    tokens: ["token", "tokens"],
    mechanics_short: ["mex", "mech"],
    mechanics: ["Mexanika", "Mechanics"],
    analysis: ["Təhlil", "Analysis"],
    report_a4: ["A4 hesabat", "A4 report"],
    launch: ["İşə sal", "Run"],
    new: ["Yeni", "New"],
    code: ["Kod", "Code"],
    title: ["Başlıq", "Title"],
    category: ["Kateqoriya", "Category"],
    register: ["Registr", "Register"],
    name: ["Ad", "Name"],
    description: ["Təsvir", "Description"],
    note: ["Qeyd", "Note"],
    hint_note: ["Qeyd (istəyə bağlı)", "Note (optional)"],
    language: ["Dil", "Language"],
  },
  nav: {
    bench: ["Bench", "Bench"],
    bench_blurb: [
      "Prompt yaz, tapşırıq kitabxanası saxla, modelləri işə sal.",
      "Write a prompt, keep a task library, run the models.",
    ],
    playground: ["Playground", "Playground"],
    playground_desc: [
      "Bir prompt, bir neçə model, yan-yana",
      "One prompt, several models, side by side",
    ],
    tasks_desc: ["Yazı tapşırıqları kitabxanası", "Library of writing tasks"],
    suites: ["Dəstlər", "Suites"],
    suites_desc: [
      "Bir işə salma üçün qruplaşdırılmış tapşırıqlar",
      "Tasks grouped into one run",
    ],
    results: ["Nəticələr", "Results"],
    results_blurb: [
      "Modelləri müqayisə et, cavabları oxu, hakimi insan qiyməti ilə yoxla.",
      "Compare models, read the answers, check the judge against human ratings.",
    ],
    leaderboard: ["Reytinq", "Leaderboard"],
    leaderboard_desc: ["Model üzrə ortalama ballar", "Average scores per model"],
    runs: ["İşə salmalar", "Runs"],
    runs_desc: ["Hər run və onun cavabları", "Every run and its answers"],
    review: ["Kor qiymətləndirmə", "Blind review"],
    review_desc: ["Model adı gizli, insan balı", "Model hidden, human score"],
    settings: ["Parametrlər", "Settings"],
    settings_blurb: [
      "Provayder açarı, model siyahısı, hakim modeli və run defoltları.",
      "Provider key, model roster, judge model and run defaults.",
    ],
    provider_judge: ["Provayder və hakim", "Provider & judge"],
    provider_judge_desc: ["Nexum açarı, judge modeli", "Nexum key, judge model"],
    models_desc: ["Test edilən modellərin siyahısı", "The models under test"],
  },
  login: {
    key_label: ["API açarı", "API key"],
    title: ["Giriş açarı", "Access key"],
    desc: [
      "Paylaşılan açarı daxil et. Açar yalnız bu brauzerdə saxlanılır.",
      "Enter the shared key. It is stored only in this browser.",
    ],
    submit: ["Daxil ol", "Sign in"],
  },
  pg: {
    eyebrow: ["Playground", "Playground"],
    h1: [
      "Bir prompt, bir neçə model, yan-yana",
      "One prompt, several models, side by side",
    ],
    lede_1: [
      "Sürətli yoxlama üçün: promptu yaz, modelləri seç, cavabları eyni ekranda müqayisə et. Təkrar ölçmə üçün tapşırığı",
      "For a quick probe: write the prompt, pick the models, compare the answers on one screen. For repeatable measurement, add the task to the",
    ],
    lede_library: ["kitabxanaya", "library"],
    lede_2: ["əlavə et və", "and run it as a"],
    lede_suite: ["dəst", "suite"],
    lede_3: ["kimi işə sal.", "."],
    placeholder: [
      "Modelə Azərbaycan dilində tapşırıq ver…",
      "Give the model a task in Azerbaijani…",
    ],
    example: ["nümunə", "example"],
    system_prompt: ["Sistem promptu (istəyə bağlı)", "System prompt (optional)"],
    system_placeholder: [
      "Məsələn: Sən Azərbaycan dilinin redaktorusan.",
      "For example: You are an editor of Azerbaijani.",
    ],
    sending: ["Göndərilir…", "Sending…"],
    judge_toggle: ["hakim qiyməti", "judge scoring"],
    run_page: ["Run səhifəsi", "Run page"],
    mech_checks: ["Mexaniki yoxlamalar", "Mechanical checks"],
    no_flags: [
      "Mexaniki yoxlamalarda problem tapılmadı.",
      "No problems found by the mechanical checks.",
    ],
    judge_off: ["Bu run üçün hakim söndürülüb.", "The judge is off for this run."],
    judge_error: ["Hakim xətası:", "Judge error:"],
    judge_pending: ["Hakim qiyməti hələ yoxdur.", "No judge score yet."],
    judge_errors_found: ["Tapılan səhvlər", "Errors found"],
    words: ["söz", "words"],
    sentences: ["cümlə", "sentences"],
    avg_sentence: ["orta", "avg"],
    per_sentence: ["söz/cümlə", "words/sentence"],
    az_letters: ["AZ hərf", "AZ letters"],
    truncated_hint: [
      "Cavab token həddində kəsilib — modelin 'Maks output token' dəyərini artır",
      "The answer hit the token ceiling — raise this model's max output tokens",
    ],
    thinking_hint: ["Düşünməyə xərclənən token", "Tokens spent reasoning"],
    no_models: [
      "Model siyahısı boşdur — Parametrlər → Modellər bölməsində provayder kataloqundan model əlavə et.",
      "The model roster is empty — add models from the provider catalog under Settings → Models.",
    ],
  },
  tasks: {
    eyebrow: ["Kitabxana", "Library"],
    h1: ["Yazı tapşırıqları", "Writing tasks"],
    lede: [
      "Ölçmə bu tapşırıqlar üzərində qurulur. Başlanğıc dəst redaktə üçün açıqdır — öz tapşırıqlarını əlavə et, işə yaramayanı sıradan çıxar.",
      "Measurement rests on these tasks. The starter set is yours to edit — add your own, disable what does not earn its place.",
    ],
    reseed: ["Başlanğıc dəsti bərpa et", "Restore starter set"],
    new_task: ["Yeni tapşırıq", "New task"],
    empty: ["Tapşırıq yoxdur.", "No tasks."],
    empty_hint: [
      "“Başlanğıc dəsti bərpa et” 18 hazır tapşırıq yükləyir.",
      "“Restore starter set” loads 18 ready-made tasks.",
    ],
    seeded: ["tapşırıq əlavə edildi.", "task(s) added."],
    seeded_none: [
      "Bütün başlanğıc tapşırıqları artıq mövcuddur — heç nə dəyişməyib.",
      "Every starter task already exists — nothing changed.",
    ],
    confirm_delete: [
      "silinsin? Bu tapşırığın keçmiş nəticələri qalır.",
      "delete this? Its past results are kept.",
    ],
    code_hint: [
      "Qısa, unikal identifikator — nəticələrdə bu görünür.",
      "Short, unique identifier — this is what shows in results.",
    ],
    prompt_hint: [
      "Modelə verilən mətn. Uzunluq, format və registr tələblərini prompta yazsan, “təlimata uyğunluq” meyarı ölçülə bilən olur.",
      "The text sent to the model. Put length, format and register requirements in the prompt and task compliance becomes measurable.",
    ],
    guidance: ["Qeyd — nə ölçülür", "Note — what this measures"],
    guidance_hint: [
      "Yalnız insanlar üçün: bu tapşırıq hansı bacarığı yoxlayır. Modelə göndərilmir.",
      "For humans only: which skill this task probes. Never sent to the model.",
    ],
    enabled_label: [
      "aktivdir (dəstlərdə işə salınır)",
      "enabled (runs as part of suites)",
    ],
  },
  suites: {
    eyebrow: ["Dəstlər", "Suites"],
    h1: ["Tapşırıq dəstləri", "Task suites"],
    lede: [
      "Bir dəst = bir işə salmada icra olunan tapşırıqlar. Eyni dəsti müxtəlif modellərlə işə salmaq nəticələri müqayisə olunan edir.",
      "A suite is the set of tasks executed in one run. Running the same suite across models is what makes results comparable.",
    ],
    new_suite: ["Yeni dəst", "New suite"],
    empty: ["Dəst yoxdur.", "No suites."],
    empty_hint: [
      "Tapşırıqlar səhifəsində başlanğıc dəsti bərpa etsən, AZ-CORE və AZ-QUICK yaranır.",
      "Restore the starter set on the Tasks page and AZ-CORE and AZ-QUICK appear.",
    ],
    task_count: ["Tapşırıq", "Tasks"],
    confirm_delete: ["dəsti silinsin?", "delete this suite?"],
    launch_title: ["işə sal", "run"],
    answers_planned: ["Cavab sayı", "Answers"],
    judge_calls: ["hakim çağırışı", "judge calls"],
    judge_off: ["hakim söndürülüb", "judge off"],
    concurrency: ["Paralellik", "Concurrency"],
    concurrency_caption: [
      "Nexum 4-də 429 qaytarır — 3 təhlükəsiz həddir.",
      "Nexum returns 429 at 4 — three is the safe ceiling.",
    ],
    time_note_label: ["Vaxt gözləntisi:", "What to expect:"],
    time_note: [
      "cavab (+hakim) paralellik ilə ardıcıl icra olunur. Böyük dəstlər üçün run səhifəsini açıq saxla — nəticələr gəldikcə görünür. Düşünən modellər bir tapşırığa 80–165 saniyə sərf edir.",
      "answers (plus judging) run at that concurrency. Keep the run page open for big suites — results appear as they land. Thinking models spend 80–165s per task.",
    ],
    judge_model_unset: ["model təyin edilməyib", "no model set"],
    launch_n: ["cavabı işə sal", "answers — run"],
  },
  runs: {
    eyebrow: ["İşə salmalar", "Runs"],
    h1: ["Run tarixçəsi", "Run history"],
    lede: [
      "Hər run bir dəstin (və ya ad-hoc promptun) seçilmiş modellərdə icrasıdır.",
      "Each run executes a suite (or an ad-hoc prompt) across the selected models.",
    ],
    type: ["Tip", "Type"],
    suite: ["Dəst", "Suite"],
    empty: ["Hələ run yoxdur.", "No runs yet."],
    empty_hint: [
      "Dəstlər səhifəsindən bir dəst işə sal.",
      "Launch a suite from the Suites page.",
    ],
    progress: ["Tərəqqi", "Progress"],
    avg_score: ["Orta bal", "Average score"],
    confirm_delete_1: [
      "run-u və bütün cavabları silinsin?",
      "delete this run and all its answers?",
    ],
    confirm_delete_2: [
      "Reytinq bütün run-ların ortalamasıdır — səhv konfiqurasiya ilə aparılmış run silinməsə, model həmişəlik pis görünür.",
      "The leaderboard averages every run — unless a run made under a broken configuration is deleted, that model looks permanently bad.",
    ],
    detail_lede_1: ["tapşırıq ×", "tasks ×"],
    detail_lede_2: ["model. Hakim:", "models. Judge:"],
    detail_judge_off: ["söndürülüb", "off"],
    cancel: ["Ləğv et", "Cancel"],
    lb_for_run: ["Bu run üzrə reytinq", "Leaderboard for this run"],
    errors_tile: ["Xəta", "Errors"],
    errors_caption: [
      "provayder xətası olan cavab",
      "answers with a provider error",
    ],
    cost_caption: ["qiymətlər Parametrlərdən", "prices from Settings"],
    started: ["Başlanğıc", "Started"],
    execution: ["icra", "execution"],
    matrix: ["Tapşırıq × model", "Task × model"],
    matrix_desc: [
      "Hücrədəki rəqəm hakimin ümumi balıdır (0-100); “mex” mexaniki yoxlama balıdır. Sətrə klikləsən, o tapşırığın bütün cavabları yan-yana açılır.",
      "The number in a cell is the judge's overall score (0-100); “mech” is the mechanical-check score. Click a row to see every answer to that task side by side.",
    ],
    side_by_side: ["cavablar yan-yana", "answers side by side"],
    judge_score_0_100: ["hakim, 0-100", "judge, 0-100"],
  },
  lb: {
    eyebrow: ["Reytinq", "Leaderboard"],
    h1: [
      "Modellərin Azərbaycan dili üzrə balları",
      "How the models score on Azerbaijani",
    ],
    lede: [
      "Hakim balı — LLM qiymətləndirməsi (0-100). Mexanika — diakritika, kiril sızması, türkcə formalar, təkrar üzrə deterministik yoxlama. İnsan balı — kor qiymətləndirmədə verilən qiymət.",
      "Judge score — LLM assessment (0-100). Mechanics — deterministic checks for diacritics, Cyrillic leakage, Turkish forms and repetition. Human score — from blind review.",
    ],
    filter_suite: ["Dəst üzrə filtr", "Filter by suite"],
    all_results: ["Bütün nəticələr", "All results"],
    one_run: ["yalnız bir run", "single run only"],
    report_hint: [
      "Hesabat metodologiya, nəticələr, nümunələr və məhdudiyyətlərlə birlikdə tək HTML faylıdır — kənar auditoriya ilə paylaşmaq və ya PDF kimi saxlamaq üçün.",
      "The report is a single HTML file with methodology, results, examples and limitations — for sharing with an external audience or saving as PDF.",
    ],
    ranking: ["Sıralama", "Ranking"],
    empty: ["Nəticə yoxdur.", "No results."],
    empty_hint: [
      "Bir dəst işə salındıqdan sonra buradaki cədvəl dolur.",
      "This table fills in once a suite has been run.",
    ],
    judge_score: ["Hakim balı", "Judge score"],
    human_score: ["İnsan balı", "Human score"],
    avg_latency: ["Orta gecikmə", "Avg latency"],
    avg_tokens: ["Orta token", "Avg tokens"],
    dimensions_h: ["Meyarlar üzrə orta bal (1-5)", "Average per criterion (1-5)"],
    dimensions_desc: [
      "Ümumi bal yaxın olan modellər burada ayrılır: biri orfoqrafiyada, digəri təbiilikdə uduzur.",
      "Models with close overall scores separate here: one loses on orthography, another on naturalness.",
    ],
    errors_h: ["Ən çox rast gəlinən səhv tipləri", "Most common error types"],
    errors_empty: ["Hakim səhv siyahısı hələ boşdur.", "No judge error list yet."],
    agreement_h: ["Hakim ↔ insan uyğunluğu", "Judge ↔ human agreement"],
    agreement_empty: [
      "Hələ müqayisə üçün insan qiyməti yoxdur.",
      "No human ratings to compare against yet.",
    ],
    agreement_caveat_label: ["Diqqət:", "Note:"],
    agreement_caveat: [
      "insan qiyməti olmadan hakim balı kalibrlənməmiş göstəricidir. Kor qiymətləndirmə səhifəsində bir neçə cavabı qiymətləndir — aradaki fərq burada rəqəmlə görünəcək.",
      "without human ratings the judge score is an uncalibrated number. Rate a few answers on the blind review page and the gap will show up here as a figure.",
    ],
    pairs: ["Müqayisə edilən cüt", "Compared pairs"],
    mean_diff: ["Orta fərq (|hakim − insan|)", "Mean difference (|judge − human|)"],
    judge_mean: ["Hakimin ortası", "Judge mean"],
    human_mean: ["İnsanın ortası", "Human mean"],
  },
  review: {
    eyebrow: ["Kor qiymətləndirmə", "Blind review"],
    h1: ["İnsan qiyməti", "Human rating"],
    lede: [
      "Model adı gizlidir. Bu ballar hakimi kalibrləmək üçündür — reytinq səhifəsində hakim ilə insan arasındaki fərq göstərilir.",
      "The model is hidden. These ratings calibrate the judge — the leaderboard shows the gap between judge and human.",
    ],
    rater: ["Qiymətləndirən", "Rater"],
    in_queue: ["Növbədə:", "In queue:"],
    this_session: ["Bu sessiyada:", "This session:"],
    queue_empty: ["Növbə boşdur.", "The queue is empty."],
    queue_empty_hint: [
      "Bu ad altında qiymətləndirilməmiş cavab qalmayıb.",
      "Nothing left unrated under this name.",
    ],
    score_1_5: ["Qiymət (1-5)", "Rating (1-5)"],
    submit: [
      "Qiyməti yaz və növbətiyə keç",
      "Save rating and go to next",
    ],
    skip: ["Keç", "Skip"],
  },
  settings: {
    eyebrow: ["Parametrlər", "Settings"],
    h1: [
      "Provayder, hakim və run defoltları",
      "Provider, judge and run defaults",
    ],
    lede: [
      "Bütün parametrlər bazada saxlanılır — deploy zamanı env dəyişənləri yalnız ilk dəfə üçün ehtiyat variantdır. API açarı şifrələnmiş saxlanılır və heç vaxt geri oxunmur, yalnız maskalanmış formada göstərilir.",
      "Every setting lives in the database — env vars are only a first-boot fallback. The API key is stored encrypted and never read back, only shown masked.",
    ],
    provider_h: ["Provayder — Nexum Router", "Provider — Nexum Router"],
    provider_desc: [
      "OpenAI-uyğun endpoint. Model kodları prefiksiz yazılır (məsələn deepseek-v4). Nexum sabit həftəlik ödənişlidir, ona görə token qiymətlərini əl ilə təyin etmək lazımdır (yoxsa xərc hesabatı 0 göstərir).",
      "An OpenAI-compatible endpoint. Model ids are bare, with no vendor prefix (e.g. deepseek-v4). Nexum charges a flat weekly fee, so token prices must be set by hand or cost reporting reads $0.",
    ],
    api_key: ["API açarı", "API key"],
    key_stored: ["saxlanılıb:", "stored:"],
    key_unset: ["açar təyin edilməyib", "no key set"],
    key_hint: [
      "Boş buraxsan, mövcud açar dəyişmir.",
      "Leave empty to keep the existing key.",
    ],
    test: ["Bağlantını yoxla", "Test connection"],
    testing: [
      "Yoxlanılır… (/models cavabı 20 saniyəyə qədər çəkə bilər)",
      "Testing… (/models can take up to 20 seconds)",
    ],
    probe_ok: ["Bağlantı işləyir —", "Connection works —"],
    probe_models: ["model mövcuddur.", "models available."],
    probe_catalog: ["Kataloqa keç", "Go to catalog"],
    probe_fail: ["Alınmadı:", "Failed:"],
    saved: ["yadda saxlanıldı.", "saved."],
    judge_h: ["Hakim (LLM judge)", "Judge (LLM)"],
    judge_desc: [
      "Hakim hər cavabı Azərbaycan dilində rubrika üzrə qiymətləndirir. Prompt Azərbaycan dilindədir və nəticə strukturlaşdırılmış JSON kimi qaytarılır.",
      "The judge scores every answer against the Azerbaijani rubric. Its prompt is written in Azerbaijani and it returns structured JSON.",
    ],
    judge_model: ["Hakim modeli", "Judge model"],
    unset: ["— seçilməyib —", "— not set —"],
    judge_bias_hint: [
      "Hakim öz cavabını da qiymətləndirdiyi üçün nəticələrə meyl (self-preference) düşə bilər — kor qiymətləndirmə ilə yoxlamaq tövsiyə olunur.",
      "A judge that also scores its own output can show self-preference bias — check it against blind human review.",
    ],
    max_out: ["Maks. output token", "Max output tokens"],
    in_price: ["Input $/1M", "Input $/1M"],
    out_price: ["Output $/1M", "Output $/1M"],
    judge_default: [
      "yeni runlarda hakim defolt olaraq işləsin",
      "judge new runs by default",
    ],
    defaults_h: ["Run defoltları", "Run defaults"],
    temperature: ["Temperature", "Temperature"],
    thinking_note_label: ["Düşünən (thinking) modellər:", "Thinking models:"],
    thinking_note: [
      "onlar cavabı yazmağa başlamadan əvvəl minlərlə token “düşünməyə” xərcləyir — ölçülmüşdür: deepseek-v4 bir məktub üçün 5144 token düşünməyə sərf edir. Hədd az olsa, model heç nə qaytarmır; bu, pis yazı deyil, konfiqurasiya problemidir və nəticələrdə “xəta” kimi göstərilir. Hədd sərf olunan deyil, yuxarı limitdir — böyük saxlamağın əlavə xərci yoxdur.",
      "they spend thousands of tokens reasoning before writing a word — measured: deepseek-v4 spent 5144 reasoning tokens on one letter. Too low a ceiling and the model returns nothing; that is a configuration problem, not bad writing, and it shows as an error. The ceiling is a limit, not a reservation — keeping it high costs nothing extra.",
    ],
    concurrency_note_label: [
      "Paralellik təhlükəsiz həddən yuxarı qaldırılmamalıdır:",
      "Do not raise concurrency above the safe ceiling:",
    ],
    concurrency_note: [
      "Nexum Router 4 eyni vaxtlı sorğuda HTTP 429 qaytarır. Worker hər halda öz həddini tətbiq edir, amma 429-lar cavabları xətaya çevirib nəticələri təhrif edir.",
      "Nexum Router returns HTTP 429 at four concurrent requests. The worker enforces its own cap regardless, but 429s turn answers into errors and distort results.",
    ],
  },
  models: {
    eyebrow: ["Modellər", "Models"],
    h1: ["Test edilən modellər", "Models under test"],
    lede_1: ["Kataloq provayderin", "The catalog is read live from the provider's"],
    lede_2: [
      "endpointindən canlı oxunur — marketinq səhifəsi API-nin verdiyi modellərin hamısını göstərmir.",
      "endpoint — the marketing page does not list everything the API serves.",
    ],
    chosen: ["Seçilmiş modellər", "Selected models"],
    load_catalog: ["Provayder kataloqunu yüklə", "Load provider catalog"],
    loading_catalog: ["Kataloq yüklənir… (~20s)", "Loading catalog… (~20s)"],
    empty: ["Model seçilməyib.", "No models selected."],
    empty_hint: [
      "Kataloqu yüklə və test etmək istədiyin modelləri əlavə et.",
      "Load the catalog and add the models you want to test.",
    ],
    max_token: ["Maks token", "Max tokens"],
    thinking: ["Düşünmə", "Reasoning"],
    thinking_label: ["Düşünmə həddi", "Reasoning effort"],
    thinking_hint: [
      "reasoning_effort. Bütün modellər dəstəkləmir.",
      "reasoning_effort. Not every model supports it.",
    ],
    extra: ["Əlavə", "Extra"],
    extra_label: ["Əlavə parametrlər (JSON)", "Extra parameters (JSON)"],
    extra_hint_1: ["Sorğuya olduğu kimi əlavə olunur — məsələn", "Merged into the request as-is — for example"],
    extra_hint_2: [
      "Düşünməyə bütün büdcəni xərcləyən modeli belə susdurmaq olar. model/messages/stream sahələri qorunur.",
      "This is how you quiet a model that spends its whole budget thinking. The model/messages/stream fields are protected.",
    ],
    extra_bad_json: [
      "Əlavə parametrlər düzgün JSON deyil.",
      "Extra parameters are not valid JSON.",
    ],
    extra_not_object: [
      "Əlavə parametrlər JSON obyekti olmalıdır, məsələn",
      "Extra parameters must be a JSON object, e.g.",
    ],
    display_name: ["Görünən ad", "Display name"],
    temp_hint: ["Boş = run defoltu.", "Empty = run default."],
    confirm_delete: [
      "siyahıdan silinsin? Keçmiş nəticələr qalır.",
      "remove from the roster? Past results are kept.",
    ],
    catalog_h: ["Provayder kataloqu —", "Provider catalog —"],
    owner: ["Sahib", "Owner"],
    context: ["Kontekst", "Context"],
    model_code: ["Model kodu", "Model id"],
    added: ["əlavə edilib", "added"],
  },
};

function lookup(lang, path) {
  const [group, key] = path.split(".");
  const entry = DICT[group]?.[key];
  if (!entry) return path; // visible, so a missing key gets noticed and fixed
  return entry[lang === "en" ? 1 : 0] ?? entry[0];
}

const LangContext = createContext({ lang: DEFAULT, setLang: () => {}, t: (k) => k });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT);

  // Read after mount: the pages are prerendered, so reading storage during the
  // first render would desynchronise hydration.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGS[stored]) setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!LANGS[next]) return;
    localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  const t = useCallback((path) => lookup(lang, path), [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

// Rubric text comes from the API, which carries both languages per dimension.
export function dimLabel(dimension, lang) {
  return (lang === "en" ? dimension.label_en : dimension.label) || dimension.label;
}

export function dimGuide(dimension, lang) {
  return (lang === "en" ? dimension.guide_en : dimension.guide) || dimension.guide;
}
