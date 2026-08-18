/* ══════════════════════════════════════════════════════════
   BAYAAN — content source of truth
   Everything the site renders comes from here. Swap the
   placeholder strings for real copy and the UI follows.
   ══════════════════════════════════════════════════════════ */

const BAYAAN = {

  /* ── quick settings ───────────────────────────────── */
  config: {
    logo:        "assets/logo.png",                    // ← the artwork, black background is fine
    heroPhoto:   "assets/hero.jpg",                    // ← wide group shot; falls back to a maroon panel
    /* ── registrations ──────────────────────────────────
       Paste these two from Supabase → Project Settings → Data API.
       The publishable key is public by design; row-level security is
       what protects the data (see supabase/schema.sql).
       Leave them blank and the join screen shows a 'not open yet'
       note instead of a broken form. */
    supabaseUrl: "",                                   // ← https://xxxx.supabase.co
    supabaseKey: "",                                   // ← the publishable / anon key

    instagram:   "https://instagram.com/bayaan_fast",
    introMs:     820                                   // how long the curtain seal holds
  },

  /* ── marquee couplets / phrases ───────────────────── */
  ticker: [
    { ur: "نرم دم گفتگو گرم دم جستجو" },
    { en: "DEBATE" }, { en: "DECLAMATION" }, { en: "MUN" },
    { ur: "حرف سے حرف تک" },
    { en: "THEATRE" }, { en: "CREATIVE WRITING" }, { en: "OPEN MIC" },
    { ur: "بول کہ لب آزاد ہیں تیرے" },
    { en: "FAST NUCES MULTAN" }
  ],

  /* ── the wings ────────────────────────────────────── */
  wings: [
    {
      name: "Debating",
      ur: "مناظرہ",
      family: "speaking",
      desc: "Parliamentary, bilingual, and campus-league debating. We train, we spar, we travel.",
      tags: ["Parliamentary", "Bilingual", "Inter-uni"],
      icon: `<path d="M14 58 h44 M22 58 V30 M50 58 V30 M18 30 h40 M26 30 V18 h20 v12"/>
             <path d="M30 44 h16"/>`
    },
    {
      name: "Declamation",
      ur: "تقریر",
      family: "speaking",
      desc: "One speaker, one podium, one idea worth defending. English and Urdu tracks.",
      tags: ["Urdu", "English", "Solo"],
      icon: `<rect x="26" y="12" width="20" height="30" rx="10"/>
             <path d="M18 38 a18 18 0 0 0 36 0"/>
             <line x1="36" y1="56" x2="36" y2="64"/>
             <line x1="24" y1="64" x2="48" y2="64"/>`
    },
    {
      name: "MUN & Diplomacy",
      ur: "سفارت",
      family: "speaking",
      desc: "Delegations, position papers, committee crises. Bayaan's window to the world.",
      tags: ["Delegation", "Position papers", "Crisis"],
      icon: `<circle cx="36" cy="36" r="24"/>
             <path d="M12 36 h48 M36 12 c10 12 10 36 0 48 c-10 -12 -10 -36 0 -48"/>`
    },
    {
      name: "Creative Writing",
      ur: "ادب",
      family: "literary",
      desc: "Nazm, afsana, essay, blog. We publish student work and run writing circles.",
      tags: ["Nazm", "Afsana", "Essay"],
      icon: `<path d="M20 60 L18 46 L48 16 a6 6 0 0 1 8 8 L26 54 Z"/>
             <path d="M42 22 l8 8"/>
             <line x1="18" y1="64" x2="54" y2="64"/>`
    },
    {
      name: "Dramatics",
      ur: "ڈرامہ",
      family: "literary",
      desc: "Scripts, stage, lights, and a cast that shows up to every rehearsal.",
      tags: ["Stage", "Script", "Improv"],
      icon: `<path d="M10 22 h26 v18 a13 13 0 0 1 -26 0 Z"/>
             <path d="M36 22 h26 v18 a13 13 0 0 1 -26 0 Z"/>
             <path d="M17 30 h4 M25 30 h4 M43 30 h4 M51 30 h4"/>
             <path d="M17 46 q6 6 12 0 M43 46 q6 6 12 0"/>`
    },
    {
      name: "Open Mic & Poetry",
      ur: "محفل",
      family: "literary",
      desc: "Bait bazi, mushaira, spoken word. The evening where anyone can take the floor.",
      tags: ["Mushaira", "Bait bazi", "Spoken word"],
      icon: `<circle cx="36" cy="24" r="12"/>
             <path d="M20 40 a16 16 0 0 0 32 0"/>
             <line x1="36" y1="56" x2="36" y2="62"/>
             <path d="M12 20 q-6 16 0 32 M60 20 q6 16 0 32"/>`
    }
  ],

  /* ── ventures: an open-ended, growing record ───────── */
  ventures: [
    {
      year: "2026",
      title: "Harf se Harf Tak",
      ur: "حرف سے حرف تک",
      flagship: true,                                  // ← the main event; styled apart in the timeline
      meta: ["Flagship", "Declamation contest"],
      desc: "A declamation contest at heart, and the biggest thing Bayaan has staged — Urdu and English tracks, one stage, a full house."
    },
    {
      year: "2026",
      title: "Induction Ceremony",
      meta: ["Society", "Open to all"],
      desc: "The night the new batch officially becomes part of the Bayaan family."
    },
    {
      year: "2025",
      title: "HEC National Essay Writing Competition",
      meta: ["National", "Writing"],
      desc: "Campus round and national representation for FAST NUCES Multan."
    },
    {
      year: "2025",
      title: "Quaid Walk",
      meta: ["Commemorative", "Campus-wide"],
      desc: "A walk and speech series marking Quaid-e-Azam's legacy, run with the wider student body."
    },
    {
      year: "2025",
      title: "General Body Meetup",
      meta: ["Society", "Kickoff"],
      desc: "Where the semester's calendar gets set and every wing pitches its plan."
    }
  ],

  /* ── council ──────────────────────────────────────────
     NOTE: names below were transcribed from the council
     poster — please verify spellings before publishing.

     PHOTOS: drop each file at exactly the `photo` path below
     (folder `assets/team/`). Portrait crops work best — the
     cards are 3:4 and framed on the upper part of the frame.
     Any member without a file still renders: the card falls
     back to the بیان placeholder, so half a set is fine.
     ─────────────────────────────────────────────────── */
  team: [
    { band: "Mentors" },
    { role: "Mentor", name: "Ms. Saba Malghani",   photo: "assets/team/saba-malghani.jpg" },
    { role: "Mentor", name: "Ms. Mary Christina",  photo: "assets/team/mary-christina.jpg" },
    { role: "Mentor", name: "Adeel Haider",        photo: "assets/team/adeel-haider.jpg" },

    { band: "Executive Council '26" },
    { role: "President",            name: "Affan Usman",        photo: "assets/team/affan-usman.jpg" },
    { role: "Vice President",       name: "Ibrahim Khan",       photo: "assets/team/ibrahim-khan.jpg" },
    { role: "Vice President",       name: "Zainab Tariq",       photo: "assets/team/zainab-tariq.jpg" },
    { role: "General Secretary",    name: "Maryam Iqbal",       photo: "assets/team/maryam-iqbal.jpg" },
    { role: "Finance Secretary",    name: "Zainab bint-e-Asad", photo: "assets/team/zainab-bint-e-asad.jpg" },
    { role: "Information Secretary",name: "Mustafa Jaffery",    photo: "assets/team/mustafa-jaffery.jpg" },
    { role: "Content Manager",      name: "Muhammad Tariq",     photo: "assets/team/muhammad-tariq.jpg" }
  ]
};
