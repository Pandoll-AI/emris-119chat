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
         │ [build-prektas-to-y-mapping.mjs]                   │
         │   12 domain rules + 13 question catalog            │
         └────────────────────────────────────────────────────┘
                                 │
                                 ▼
              research/prektas-to-y-mapping.json
                                 │
                                 │ + data/y-code-to-center-tier.json
                                 ▼
         ┌────────────────────────────────────────────────────┐
         │ [build-prektas-tier-recommendation.mjs]            │
         │   Y후보 → tier 룩업 · grade fallback · 세이브 판정 │
         └────────────────────────────────────────────────────┘
                                 │
                                 ▼
              research/prektas-tier-recommendation.json
              research/prektas-tier-recommendation-report.md (서술)
```

**npm 워크플로**
- `npm run codebook:generate` — 정본 CSV → JSON
- `npm run codebook:validate` — schema + 무결성 + 이름 일관성 (항상 엄격)
- `npm run codebook:rebuild` — generate 후 validate까지
- `npm run research:prektas-to-y-mapping` — Pre-KTAS → Y코드 v0.1 매핑 산출
- `npm run research:prektas-tier-recommendation` — Y코드 + grade → 응급센터 tier 추천
- `npm run research:all` — 위 둘을 순차 실행
- `npm run build:html:recommender` — 추천 도구 HTML 생성
- `npm run build:html:research` — 연구 설명 HTML 생성
- `npm run build:html` — 두 HTML을 순차 빌드
- `npm run build:chatbot-payload` — 챗봇용 정본 데이터 페이로드 (lib/chatbot-payload.js) 생성
- `npm run build:all` — codebook → research → html → chatbot-payload 전체 빌드

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
| `data/y-code-to-center-tier.json` | 27 Y코드 → 권역/지역센터/지역기관 tier 1차안 | 없음 (1차안) |
| `scripts/research/build-prektas-tier-recommendation.mjs` | Y후보 + grade → 응급센터 tier 추천 | mapping.json, y-code-to-center-tier.json |
| `research/prektas-tier-recommendation.json` | 4,689 엔트리별 tier 추천 + 세이브 플래그 | tier script 출력 |
| `research/prektas-tier-recommendation-report.md` | 권역 세이브율·분포 분석 서술 | tier-recommendation.json |
| `scripts/build-hospital-recommender.mjs` | 정본 JSON embed → recommender HTML | 4개 JSON |
| `scripts/build-research-page.mjs` | 연구 설명 standalone HTML 생성 | codebook.json, tier·mapping |
| `index.html` | EMRIS 챗봇 통합 페이지 (Phase 6+7): 자유 채팅 + Pre-KTAS 평가 + LLM 4임무 + CaseStore + drawer + 폴백 제거·재시도(Phase 7) + follow-up 컨텍스트 + 리본 화살표·드래그 | `api/llm.js`, `lib/chatbot-payload.js`, EMRIS API |
| `lib/chatbot-payload.js` | 정본 코드북·매핑·tier·question effects 합본 (671KB) | `data/`, `research/` JSON |
| `scripts/build-chatbot-payload.mjs` | 페이로드 빌드 스크립트 | 정본 JSON 4개 |
| `prektas-hospital-recommender.html` | 약 900KB 모바일 스텝 마법사 (교육·연구용, 빌드 산출) | build script |
| `prektas-research.html` | 15KB 연구 노트 HTML (빌드 산출) | build script |
| `run.sh` | 포트 3489 로컬 서버 제어 (`start\|stop\|restart`) | python3, public/ |
| `public/index.html` (심볼릭) | → `../prektas-hospital-recommender.html` | 루트 HTML |
| `public/research.html` (심볼릭) | → `../prektas-research.html` | 루트 HTML |
| `package.json` | npm scripts + devDeps (ajv, ajv-formats) | 없음 |
| `index.html` | EMRIS 119 챗봇 UI (initial commit 산출물) | `api/`, Gemini REST API |
| `api/` | Vercel serverless 엔드포인트 디렉토리 | — |
| `vercel.json` | SPA rewrites 설정 (`/` → `/index.html`, `api/llm.js` maxDuration 30s) | — |
| `.vercelignore` | `public/`, `data/raw/`, `*.csv` 등 배포 제외. chatbot이 루트 index로 정확히 서빙되게 함 | — |
| `test-llm.mjs` | LLM 연동 smoke test (initial commit 산출물) | `.env` |

## Phase 7 추가 사항 (2026-04-25)

### LLM 호출 흐름 (폴백 제거 후)
```
사용자 입력
   │
   ├─ keywordFallback (즉시, region+disease 추출)
   │     ├─ 둘 다 매칭: searchAndShow (LLM 파싱 안 함)
   │     ├─ 활성 케이스에 hospitals_snapshot 있고 키워드 미스: runFollowUp
   │     │     └─ HARNESS_FOLLOWUP_PROMPT + case.messages contents
   │     │           └─ callLLMWithRetry → 평문 답변 or renderLLMError
   │     └─ 그 외 + AI ON: parseWithLLM
   │           └─ callLLMWithRetry → region+disease or renderLLMError
   │
   └─ searchAndShow (EMRIS API 조회) → useLLM
         ├─ AI ON or 마법사 모드 (forceLLM):
         │     └─ interpretWithHarness → callLLMWithRetry
         │           ├─ 200: renderAdaptiveResult (4임무 카드)
         │           ├─ 429: renderRateLimitChoice (재시도 버튼만, 폴백 옵션 X)
         │           └─ 401/5xx/network/parse: renderLLMError + onRetry
         └─ AI OFF (사용자 명시 토글): renderSmartResult (룰 기반, 폴백 아님)
```

### Phase 7 Key Functions (in `index.html`)
| Function | Role | Used By |
|---|---|---|
| `callLLMWithRetry(fetchFn, opts?)` | 점증 backoff [0,1s,3s,5s,10s] 재시도 헬퍼 | parseWithLLM, interpretWithHarness, runFollowUp |
| `renderLLMError({error, onRetry})` | 에러 카드 (헤더+본문+재시도+진단 details) | searchAndShow, sendMessage, runFollowUp, renderRateLimitChoice |
| `llmErrorLabel(kind)` | kind → 한국어 라벨 매핑 | renderLLMError |
| `runFollowUp(text)` | 케이스 컨텍스트 보존 LLM 호출 (평문 답변) | sendMessage |
| `buildFollowUpMessages(caseObj)` | case.messages → LLM contents 직렬화 (에러 카드 prefix 필터) | runFollowUp |
| `viewCaseReadOnly(c)` | 기록 패널 클릭 시 chat 영역 메시지 리플레이 | renderDrawer 클릭 핸들러 |
| `enhanceRibbonScroll(rowEl)` | ribbon에 좌우 화살표 + 드래그 스크롤 wiring | buildRibbons |

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
