# Surf Plan v2 — Research + maßgeschneiderter Seed-Plan

**Datum:** 2026-07-19
**Status:** Design freigegeben

## Kontext

Die beiden vorhandenen Pläne (`surf`, `strength`) stammen aus dem Knees-Over-Toes-Programm
und sind ~2 Jahre alt. Pascals aktuelle Belastung:

- **Surfen:** 5–6×/Woche, 90 min+ (≈ 7,5–9 h/Woche)
- **Altinha:** 6×/Woche, ~1 h (≈ 6 h/Woche, auf Sand)
- Gesamt ≈ 15 h Sport/Woche **vor** jedem Zusatztraining

**Ziel:** ausgewogen — Verletzungsprophylaxe als Basis plus gezielte Surf-Performance-Elemente.
**Baustelle:** unterer Rücken / Hüfte.
**Equipment:** nur Bodyweight + Widerstandsbänder (reisetauglich).
**Zeitbudget:** 5 Sessions/Woche à ~30 min (Mo–Fr, wie bisher, aber bewusst kurz).

## Phase 1 — Research (`docs/research/`)

Multi-Agent-Deep-Research mit Websuche und Quellenangaben. Ablage als Markdown,
ein Dokument pro Thema, plus `README.md` als Index mit Kernaussagen:

| Datei | Thema |
|---|---|
| `atg-kot-prinzipien.md` | ATG/KOT: Prinzipien, Progressionslogik, Evidenzlage, Kritik, Entwicklungen seit ~2024 |
| `poliquin-grundlagen.md` | Structural Balance, Tempo, Übungs-Ratios (Poliquin als KOT-Wurzel) |
| `surf-conditioning.md` | Paddel-Ausdauer, Schultergesundheit, Rotationskraft, Pop-up-Explosivität |
| `altinha-belastungsprofil.md` | Sprünge/Kicks auf Sand, Wade/Fuß/Achillessehne, Asymmetrien |
| `ruecken-huefte.md` | Paddel-Überstreckung, Hüftbeuger, McGill, evidenzbasierte Prävention bei Surfern |
| `recovery-periodisierung.md` | Minimal Effective Dose neben ~15 h Sport/Woche; wann Zusatztraining kontraproduktiv ist |
| `atem-apnoe.md` | CO₂-Toleranz, Apnoe-/Atemtraining für Hold-Downs |

Akzeptanz: jedes Dokument mit Quellen; README fasst die planungsrelevanten
Kernaussagen zusammen.

## Phase 2 — Neuer Seed-Plan

- **Neuer Seed** `src/seeds/plans/surf-2.ts` (Slug `surf-2`), registriert in
  `src/seeds/index.ts` → `PLANS`. Die bestehenden Pläne bleiben unangetastet
  (Session-Templates sind nach Insert immutable; deshalb neuer Slug statt Editieren).
  Planwechsel via PlanSwitcher (`settings.active_plan_id`), Nutzerhistorie bleibt erhalten.
- **Struktur:** 5 Tage (Mo–Fr) à ~30 min, nur Bodyweight + Bänder. Erwarteter Aufbau:
  kurzer täglicher Hüft/LWS-Block als Konstante, darüber alternierende Schwerpunkte
  (Lower / Upper / Rotation). Konkrete Übungsauswahl wird aus Phase 1 abgeleitet und
  **vor der Implementierung als Entwurf zur Durchsicht vorgelegt**.
- **Übungskatalog:** neue Übungen in `src/seeds/exercises.ts` (Upsert by slug,
  Katalog wächst additiv), mit YouTube-Video-IDs wo sinnvoll.
- **Konsistenz:** `validateSeed` muss durchlaufen (XOR reps/seconds, dichte
  `order_index`, konsistente `circuit_rounds`); Jest-Seed-Tests grün.
- **Auslieferung:** Version-Bump (vor Sideload — siehe Memory), Release-Build,
  Sideload aufs Pixel 7, Verifikation via `dumpsys`.

## Nicht-Ziele

- Kein Editieren/Löschen der bestehenden Pläne oder Templates
- Keine Schema-Änderungen an der Datenbank
- Kein In-App-Research-Viewer — Research lebt nur im Repo
