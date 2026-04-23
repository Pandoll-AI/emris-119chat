# Project Structure

## Workflow

```
prektas-input-keypad.html (external source)
           │
           │ [generate-prektas-codebook.mjs]
           │   regex + JSON.parse, 구조적 level 코드 도출
           ▼
data/prektas-codebook.json  ←  data/schemas/prektas-codebook.schema.json
           │                              │
           │                              │ [validate-prektas-codebook.mjs]
           │                              │   ajv compile + 무결성 체크
           │                              │ + data/codebook-allowed-collisions.json
           │                              │   (--strict 모드에서 대조)
           ▼                              ▼
   (하류 빌드 스크립트           schema ok / integrity ok / 경고 or --strict 에러
    — 다음 phase에서 정본                
    JSON 소비자로 리팩터 예정)
```

**npm 워크플로**
- `npm run codebook:generate` — 외부 HTML → 정본 JSON
- `npm run codebook:validate` — schema + 무결성 (warnings exit 0)
- `npm run codebook:validate:strict` — whitelist 밖 충돌을 error로 승격 (exit 1)
- `npm run codebook:rebuild` — generate 후 strict validate까지

## Key Files

| File | Role | Depends On |
|---|---|---|
| `data/prektas-codebook.json` | Pre-KTAS 4,689 코드의 정본 데이터 (생성물) | `prektas-input-keypad.html` (외부) |
| `data/schemas/prektas-codebook.schema.json` | JSON Schema draft 2020-12 | 없음 |
| `data/codebook-allowed-collisions.json` | Known name collision whitelist | 없음 |
| `scripts/generate-prektas-codebook.mjs` | 외부 HTML → 정본 JSON 변환 | `prektas-input-keypad.html` |
| `scripts/validate-prektas-codebook.mjs` | 정본 JSON 검증 gate | ajv, schema, codebook, allowed-collisions |
| `package.json` | npm scripts + devDeps (ajv, ajv-formats) | 없음 |
| `index.html` | EMRIS 119 챗봇 UI (initial commit 산출물) | `api/`, Gemini REST API |
| `api/` | Vercel serverless 엔드포인트 디렉토리 | — |
| `vercel.json` | SPA rewrites 설정 | — |
| `test-llm.mjs` | LLM 연동 smoke test (initial commit 산출물) | `.env` |
| `scripts/build-prektas-research-standalone.mjs` | (untracked, 이전 세션) 하드코딩 키워드 매칭 기반 HTML 빌더 — 다음 phase에서 리팩터 대상 | 외부 HTML, CSV들 |
| `scripts/build-prektas-report-html.mjs` | (untracked, 이전 세션) JSON → HTML 리포트 뷰어 | `prektas-research-report.json` |
| `scripts/evaluate-prektas-research.mjs` | (untracked, 이전 세션) self-fulfilling 지표 — 다음 phase에서 교체 대상 | `prektas-research-standalone.html` |

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
| `npm run codebook:generate` | `scripts/generate-prektas-codebook.mjs` | 외부 keypad.html → `data/prektas-codebook.json` |
| `npm run codebook:validate` | `scripts/validate-prektas-codebook.mjs` | schema + 무결성 검증 (warning 모드) |
| `npm run codebook:validate:strict` | `scripts/validate-prektas-codebook.mjs --strict` | whitelist 밖 충돌 → error (CI gate 용도) |
| `npm run codebook:rebuild` | generate + validate:strict | 정본 재빌드 end-to-end |
| `./run.sh {start|stop|restart}` | `run.sh` (untracked) | 로컬 dev 서버 제어 |
| `node test-llm.mjs` | `test-llm.mjs` | LLM 연동 smoke test |
