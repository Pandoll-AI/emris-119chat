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
| `prektas-research.html` | Phase 8 validation protocol 요약·시각화 페이지 (빌드 산출, 매거진 레이아웃, 10 chapters) | build script + protocol markdown |
| `research/prektas-validation-protocol.md` | **Phase 8 source of truth** — 사전 등록(preregistered) 분석 계획 v1.0. STARD 2015 준수. 4 가설, 11 sub-phases, threats to validity, ethics, reproducibility. | 정본 codebook + 1차 prevalence 스캔 |
| `prektas-consultation.html` | **Phase 8a-2 응급의학 전문의 자문 도구** — 49.4KB standalone SPA. 27 Y-code × ICD-10 prefill + 12+ 임상 결정 + 임계값 + red flags + JSON export. localStorage auto-save. | 임상 통상 기준 prefill + protocol-flagged decisions |
| `research/consultation-2026-04-25-moef75va.json` | 응급의학 전문의 자문 원본 (보존) | consultation tool export |
| `research/y-code-icd10-clusters.json` | **Phase 8a-2 frozen reference standard v1.0** — 27 Y-code × ICD-10 cluster + thresholds + amendments | consultation 변환 |
| `research/prektas-code-crosswalk.json` | **Phase 8a-1** — 5자/6자 코드 정렬. mapped 59.3% unique. | codebook + CSV unique 6자 코드 set |
| `scripts/research/validate-phase8.py` | **Phase 8b–f 통합 분석 스크립트 (Python)** — 225k CSV single-pass. EUC-KR streaming + ICD-10 매칭 + Wilson CI + stratified. | crosswalk + frozen clusters + mapping v0.1 + codebook |
| `research/validation-results-v0.1.json` | **Phase 8e** — primary metrics (sens 0.394, spec 0.808) + 27 Y-code per-class | validate-phase8.py 출력 |
| `research/validation-stratified.json` | **Phase 8f** — region/age/grade stratified | validate-phase8.py 출력 |
| `research/validation-error-audit.json` | **Phase 8g** — top 50 FN/FP patterns | validate-phase8.py 출력 |
| `research/prektas-validation-report-v1.0.md` | **Phase 8i 최종 보고서** — 9 섹션. H1 FAIL · H2 PASS · v0.2 권고. | 위 결과 4개 종합 |
| `research/y-code-mappability-matrix.json` | **Phase 9b frozen v1.0** — 27 Y코드 × A:10/B:6/C:11 분류. 자문자 5건 변경 반영. v0.2 알고리즘 source of truth. | 자문자 검토 + 사용자 명시 의견 + v1.0 결과 |
| `research/mappability-review-2026-04-26-moexk8az.json` | 자문자 검토 원본 (5건 변경 + 8 질문 답변) | consultation tool export |
| `prektas-mappability-review.html` | **Phase 9b 자문 검토 도구** — 38.8KB SPA. 1차 초안 → 자문자 검토 → JSON export. Tailscale + Vercel host. | 매트릭스 v1.0-draft inline embed |
| `scripts/research/build-prektas-to-y-mapping-v0.2.mjs` | **Phase 9c v0.2 알고리즘** — mappability + y_candidates(confidence) + tier_recommendation 출력. Special rules 4건. | matrix v1.0 + codebook + y-code tier |
| `research/prektas-to-y-mapping-v0.2.json` | **Phase 9c v0.2 출력** — 4,689 entries. A:434/B:295/C:45/unmapped:3,915 | v0.2 알고리즘 |
| `scripts/research/validate-v0_2.py` | **Phase 9d directional 통계** — 광주·전라 CSV 단일 패스 + 모순 검출. informational only. | v0.2 mapping + frozen ICD-10 cluster |
| `research/validation-results-v0.2.json` | **Phase 9d 통계** — sens·spec·tier agreement 85.7% + Type-A/B/C/D 모순. 결정 X. | validate-v0_2.py |
| `research/prektas-validation-report-v2.0.md` | **Phase 9e 보고서 v2.0** — 임상 정합성 reframe. 8 섹션. 통계 임계 폐기. | 위 산출물 + 매트릭스 v1.0 |
| `research/vignettes-v1.0-draft.json` | **Phase 10a vignette set** — 30 임상 시나리오 (12 textbook · 8 fn_pattern · 5 fp_pattern · 5 consultant_change) | maintainer 작성 + v0.2 출력 |
| `prektas-vignette-review.html` | **Phase 10b 자문 검토 도구** — 38.8KB SPA. 30개 vignette 평가 + JSON export. Tailscale + Vercel host. | vignettes-v1.0-draft + v0.2 출력 |
| `research/vignette-review-2026-04-26-mofq7k1h.json` | **Phase 10c 자문 원본** — 14 appropriate / 10 partial / 6 inappropriate | vignette-review.html export |
| `research/vignette-review-analysis.md` | **Phase 10c-1 분석** — 6 섹션 + v0.3 변경 권고 | 자문 원본 + maintainer 분석 |
| `scripts/research/build-prektas-to-y-mapping-v0.3.mjs` | **Phase 11 v0.3 알고리즘** — vignette feedback 적용. ~480 lines, v0.2 fork. fp 좁히기 + over-firing 정리 + 임신 응급 강화 + 신규 질문 catalog 6개. | matrix v1.0 + codebook + y-code tier + vignette analysis |
| `research/prektas-to-y-mapping-v0.3.json` | **Phase 11 v0.3 출력** — 4,689 entries. A:332/B:266/C:64/unmapped:4,027 | v0.3 알고리즘 |
| `scripts/research/validate-v0_3.py` | **Phase 11d v0.2 vs v0.3 directional** — 광주·전라 CSV 단일 패스. v0.2 + v0.3 동시 평가. informational only. | v0.2 + v0.3 mapping + frozen ICD-10 cluster |
| `research/validation-results-v0.3.json` | **Phase 11d 통계** — spec +0.029, F1 +0.008, tier +0.011 directional. 결정 X. | validate-v0_3.py |
| `run.sh` | 포트 3489 로컬 서버 제어 (`start\|stop\|restart`) | python3, public/ |
| `public/index.html` (심볼릭) | → `../prektas-hospital-recommender.html` | 루트 HTML |
| `public/research.html` (심볼릭) | → `../prektas-research.html` | 루트 HTML |
| `package.json` | npm scripts + devDeps (ajv, ajv-formats) | 없음 |
| `index.html` | EMRIS 119 챗봇 UI (initial commit 산출물) | `api/`, Gemini REST API |
| `api/` | Vercel serverless 엔드포인트 디렉토리 | — |
| `vercel.json` | SPA rewrites 설정 (`/` → `/index.html`, `api/llm.js` maxDuration 30s) | — |
| `.vercelignore` | `public/`, `data/raw/`, `*.csv` 등 배포 제외. chatbot이 루트 index로 정확히 서빙되게 함 | — |
| `test-llm.mjs` | LLM 연동 smoke test (initial commit 산출물) | `.env` |

## Phase 8 추가 사항 (2026-04-25) — 학술 검증 protocol

### Phase 8 산출물 위치 (예정 + 현재)

```
research/
├── prektas-validation-protocol.md          ✓ Phase 8 (커밋됨, source of truth)
├── prektas-code-crosswalk.json             ⏳ Phase 8a-1 (5자 ↔ 6자 정렬)
├── y-code-icd10-clusters.json              ⏳ Phase 8a-2 (전문의 자문)
├── validation-results-v0.1.json            ⏳ Phase 8e (per-Y-code metrics)
├── validation-stratified.json              ⏳ Phase 8f
├── error-audit-v0.1.md                     ⏳ Phase 8g
├── prektas-validation-report-v1.0.md       ⏳ Phase 8i
└── replication/                            ⏳ Phase 8j
    ├── README.md
    ├── data-hash.txt
    └── run.sh

data/derived/                                ⏳ gitignored, hash만 commit
├── visits.parquet                           Phase 8b
├── visits-with-yref.parquet                 Phase 8c
└── visits-with-prediction-q{0..3}.parquet   Phase 8d

scripts/research/
├── build-prektas-to-y-mapping.mjs           ✓ frozen at study start (Phase 3)
├── build-prektas-tier-recommendation.mjs    ✓ frozen
└── validate-phase8.mjs                      ⏳ Phase 8b–f 통합 실행 스크립트
```

### Phase 8 dependency graph

```
source-prektas.csv (225k visits, EUC-KR)
  │
  └─ [Phase 8a-1] 5자/6자 crosswalk 작성 ────┐
  └─ [Phase 8a-2] Y → ICD-10 cluster 자문 ──┤
  └─ [Phase 8b]  표준화 (UTF-8, parquet) ───┤
                                            ▼
        per-visit ground truth label (Phase 8c)
                                            │
        Index test (Phase 3 frozen) — 4 시나리오 (q0-q3) (Phase 8d)
                                            │
                                            ▼
        Confusion matrix + metrics + bootstrap (Phase 8e)
                                            │
                                            ├─ Stratified analyses (Phase 8f)
                                            └─ Top 100 FN audit (Phase 8g)
                                            │
                                            ▼
        v0.2 개선 (조건부, Phase 8h) → 평가 재실행
                                            │
                                            ▼
        Final report + replication (Phase 8i, 8j)
```

### Phase 8 실행 명령

**완료된 작업** (Phase 8a-1, 8a-2, 8b–i):
```bash
# Phase 8a-1: crosswalk (이미 commit됨, 재실행 불필요)
# Phase 8a-2: consultation tool 사용 (이미 자문 완료 + frozen JSON commit)

# Phase 8b–i: 통합 분석 재실행
python3 scripts/research/validate-phase8.py
# → research/validation-results-v0.1.json
# → research/validation-stratified.json
# → research/validation-error-audit.json
```

**보고서**: `research/prektas-validation-report-v1.0.md`

### Phase 8a-2 자문 흐름

```
prektas-consultation.html (브라우저)
  │ 응급의학 전문의가 27 Y-code × ICD-10 + 임상 결정 + 임계값 + red flags 입력
  │ localStorage 자동 저장 (key: emris_consultation_v1)
  │ 진행률 사이드바 표시
  ▼
JSON Export (다운로드 또는 클립보드)
  │ consultation-{date}-{id}.json
  ▼
maintainer 수령
  │ 변환 + 검증
  ▼
research/y-code-icd10-clusters.json (frozen, commit)
  │
  ▼
Phase 8c per-visit 라벨링의 reference standard로 사용
```

**자문 도구 URL**: `https://119chat.emergency-info.com/prektas-consultation.html`

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
