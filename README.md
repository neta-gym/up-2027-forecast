# UP 2027 Forecast

Seat-by-seat forecast of the 2027 Uttar Pradesh Vidhan Sabha election: all 403 constituencies, the sitting MLAs, prospective candidates and win probabilities. It's a static site with no build step, so it can go on GitHub Pages the same way as the MP Transparency Tracker.

## Run locally

```bash
python3 -m http.server 8417
```

Open http://localhost:8417. Opening `index.html` straight from disk won't work, because the browser blocks the `fetch()` calls for the data files.

## Pages (hash routes)

| Route | What it shows |
|---|---|
| `#/` | Headline forecast, seat range, majority odds, map (forecast / 2022 / 2024 / MLA strength), 403-seat strip, what-if swing slider, regions, battlegrounds, marquee contests, MLAs at risk, polls |
| `#/seats` | Filterable, sortable table of all 403 seats (`?region=`, `?district=`, `?rating=`, `?party=`) |
| `#/seat/N` | One constituency: candidates with win %, MLA report card, projected vote share, model inputs, 2012–2024 history, map |
| `#/mlas` | MLA leaderboard: Re-election Strength score, hold chance, criminal cases, assets, ticket risk |
| `#/method` | Methodology, limitations, sources |

## Rebuild the forecast

```bash
python3 pipeline/build_model.py
```

This reads `pipeline/sources/` and writes `data/seats.json` and `data/summary.json`. It needs numpy.

| Source file | Contents | Origin |
|---|---|---|
| `r2022.json` | 2022 winner and runner-up for all 403 seats | ECI via Wikipedia |
| `acpages.json` | Full candidate results 2012/2017/2022 plus bypolls | Wikipedia constituency pages |
| `ls2024.json` | 2024 Lok Sabha result in each assembly segment | ECI Form-20 via Wikipedia |
| `myneta2022.json` | Criminal cases, assets, liabilities and education of 2022 winners | MyNeta / ADR |
| `announced2027.json` | Candidates named or reported for 2027 | Wikipedia 2027 election and constituency pages |
| `context2026.json` | Hand-curated research: alliances, polls, defections, vacancies, ministers | News reporting up to 19 Nov 2026 |

**To update as the campaign moves:** edit `context2026.json` (new polls, defections, vacancies, roles) and `announced2027.json` (candidate lists), then rerun the build. The poll average, seat projections and every narrative regenerate from those files. `pipeline/scrapers/` holds the scripts that produced the other source files.

## Model, in one paragraph

Each seat gets two baselines. The first is the 2022 assembly result, re-mapped to today's alliances (RLD and SBSP have moved from the SP side to the NDA). The second is the seat's 2024 Lok Sabha segment result. Each baseline is swung to the statewide poll average (half uniform swing, half proportional swing), and the two are blended 50/50. That weighting shifts to 65/35 in Lok Sabha seats where a national leader was on the 2024 ballot, and to 85/15 in personal-vote seats like Kunda. Recent bypolls get extra weight. Seats where the MLA defected or is a known rebel also get adjustments. The model then runs 20,000 simulations with a statewide polling error (SD 4 pts), a regional swing for each of 7 regions (SD 3) and a local swing in every seat (SD 6).

Full details are on the Method page.
