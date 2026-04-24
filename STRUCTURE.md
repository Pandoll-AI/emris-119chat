# Project Structure

## Workflow

```
data/raw/Pre-KTAS_codebook.csv              data/emris-severe-emergency-diseases.json
 (정본 원본, 4,689 entries)                   (EMRIS 27 Y코드 target, canonical)
           │                                              │
           │ [generate-prektas-codebook.mjs]              │
           ▼                                              │
data/prektas-codebook.json                                │
     ←  data/schemas/prektas-codebook.schema.json         │
           │                                              │
           │ [validate-prektas-codebook.mjs]              │
           │   schema ok · integrity ok · 충돌 0          │
           ▼                                              ▼
         ┌────────────────────────────────────────────────────┐
         │ [scripts/research/build-prektas-to-y-mapping.mjs]  │
         │   12 domain rules + 13 question catalog            │
         └────────────────────────────────────────────────────┘
                                 │
                                 ▼
              research/prektas-to-y-mapping.json
              research/prektas-to-y-mapping-report.md (서술)
```

**npm 워크플로**
- `npm run codebook:generate` — 정본 CSV → JSON
- `npm run codebook:validate` — schema + 무결성 + 이름 일관성 (항상 엄격)
- `npm run codebook:rebuild` — generate 후 validate까지
- `npm run research:prektas-to-y-mapping` — Pre-KTAS → Y코드 v0.1 매핑 산출

## Key Files

| File | Role | Depends On |
|---|---|---|
| `data/raw/Pre-KTAS_codebook.csv` | 정본 Pre-KTAS 코드북 원본 (4,689 entries, 9 columns) | 없음 (커밋된 정본) |
| `data/prektas-codebook.json` | CSV로부터 생성된 JSON v2.0.0 (4,689 entries, 17 level2) | `data/raw/Pre-KTAS_codebook.csv` |
| `data/schemas/prektas-codebook.schema.json` | JSON Schema draft 2020-12 v2 | 없음 |
| `data/emris-severe-emergency-diseases.json` | EMRIS 27 중증응급질환 Y코드 target | `emris-data/devdocs/disease_codes.json` |
| `scripts/generate-prektas-codebook.mjs` | CSV → 정본 JSON 변환 | `data/raw/Pre-KTAS_codebook.csv` |
| `scripts/validate-prektas-codebook.mjs` | 정본 JSON 검증 gate | ajv, schema, codebook |
| `scripts/research/build-prektas-to-y-mapping.mjs` | Pre-KTAS → Y코드 rule-based v0.1 매핑 생성기 | prektas-codebook.json, emris-severe-emergency-diseases.json |
| `research/prektas-to-y-mapping.json` | 4,689 Pre-KTAS 엔트리별 Y코드 후보·질문·rationale | build script 출력 |
| `research/prektas-to-y-mapping-report.md` | 매핑 연구 서술형 보고서 | mapping.json |
| `package.json` | npm scripts + devDeps (ajv, ajv-formats) | 없음 |
| `index.html` | EMRIS 119 챗봇 UI (initial commit 산출물) | `api/`, Gemini REST API |
| `api/` | Vercel serverless 엔드포인트 디렉토리 | — |
| `vercel.json` | SPA rewrites 설정 | — |
| `test-llm.mjs` | LLM 연동 smoke test (initial commit 산출물) | `.env` |

## Database

해당 없음. 현재 프로젝트는 DB 미사용. 모든 데이터는 static JSON/CSV/HTML에 embed.

외부 데이터 소스 (참조):
| Source | Location | Rows | Format |
|---|---|---|---|
| Pre-KTAS RECORDS_RAW | `/Users/sjlee/Projects/prektas-research/prektas-input-keypad.html` | 4,689 | embedded JS literal |
| KTAS codebook | `/Users/sjlee/Projects/prektas-research/KTAS_codebook.csv` | 4,349 | CSV |
| KTAS↔Pre-KTAS mapping | `/Users/sjlee/Projects/prektas-research/KTAS_PreKTAS_mapping.csv` | 4,690 | CSV |
| Real ED visit log (참고용, 미사용) | `/Users/sjlee/Projects/prektas-research/source-prektas.csv` | 225,018 | CSV (EUC-KR) |

## CLI / Scripts

| Command | Script | Purpose |
|---|---|---|
| `npm run codebook:generate` | `scripts/generate-prektas-codebook.mjs` | 정본 CSV → `data/prektas-codebook.json` |
| `npm run codebook:validate` | `scripts/validate-prektas-codebook.mjs` | schema + 무결성 + 이름 일관성 (항상 엄격) |
| `npm run codebook:rebuild` | generate + validate | 정본 재빌드 end-to-end |
| `npm run research:prektas-to-y-mapping` | `scripts/research/build-prektas-to-y-mapping.mjs` | Pre-KTAS → EMRIS 27 Y코드 v0.1 매핑 산출 |
| `./run.sh {start|stop|restart}` | `run.sh` (untracked) | 로컬 dev 서버 제어 |
| `node test-llm.mjs` | `test-llm.mjs` | LLM 연동 smoke test |
