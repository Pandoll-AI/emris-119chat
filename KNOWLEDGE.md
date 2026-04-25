# Project Knowledge Graph

Pre-KTAS → EMRIS Y코드 매핑 연구 phase (2026-04-24) 시점의 entities/relations/actions.

## Entities

| Entity | Type | Location | Description |
|---|---|---|---|
| Pre-KTAS Codebook Source CSV | raw-dataset | `data/raw/Pre-KTAS_codebook.csv` | **정본 Pre-KTAS 코드북 원본.** 4,689 entries, 9 columns. iCloud .Trash에서 복구. |
| Pre-KTAS Codebook JSON | dataset | `data/prektas-codebook.json` | CSV 기반 정본 JSON v2.0.0. 4,689 entries, 17 level2 카테고리. |
| EMRIS 중증응급질환 Y코드 | target-dataset | `data/emris-severe-emergency-diseases.json` | EMRIS 종합상황판 모니터링 대상 27 Y코드. `emris-data/devdocs/disease_codes.json` 이식. |
| Pre-KTAS → Y 매핑 (v0.1) | research-output | `research/prektas-to-y-mapping.json` | 4,689 Pre-KTAS 엔트리별 Y코드 후보·질문·rationale. rule-based baseline. |
| Pre-KTAS → Y 매핑 보고서 | research-output | `research/prektas-to-y-mapping-report.md` | 8섹션 서술형 해석·한계·후속 방향. |
| Mapping Generator | script | `scripts/research/build-prektas-to-y-mapping.mjs` | 12 도메인 rule + 13 질문 카탈로그. JSON 산출. |
| Y-Tier Classification | dataset | `data/y-code-to-center-tier.json` | 27 Y코드를 권역/지역센터/지역기관으로 분류한 1차안 (임상 리뷰 전). 권역 세이브 전략 근거. |
| Tier Recommendation | research-output | `research/prektas-tier-recommendation.json` | Pre-KTAS 엔트리별 tier 추천 + 요약. Y후보 + grade 기반 규칙. |
| Tier Recommendation Report | research-output | `research/prektas-tier-recommendation-report.md` | 권역 세이브율(85.5%), level2별 분포, 한계·후속 분석. |
| Tier Recommendation Generator | script | `scripts/research/build-prektas-tier-recommendation.mjs` | v0.1 매핑 + Y-tier 룩업 + grade fallback → tier 추천 산출. |
| Hospital Recommender HTML | artifact | `prektas-hospital-recommender.html` | 2.4MB standalone 프로토타입. 정본 JSON embed. 단계별 입력 + tier 카드 + Y후보 UI. |
| Research Page HTML | artifact | `prektas-research.html` | 12KB 매거진 레이아웃 연구 노트. 7섹션 서술. |
| HTML Recommender Builder | script | `scripts/build-hospital-recommender.mjs` | 5개 JSON payload embed + 질문 effects + mock 병원 + XSS escape. 모바일 스텝 마법사. |
| Mock Hospital Data | dataset | `data/mock-hospitals.json` | 20개 mock 병원 (실제 이름 + mock tier·거리·Y코드 지원). Phase 6에서 emris-data 실데이터로 교체. |
| Local Server Script | tooling | `run.sh` | 포트 3489 · `{start\|stop\|restart}`. python3 -m http.server + `--directory public`. |
| Public Serve Dir | routing | `public/` | 심볼릭 링크로 prektas 2페이지 + chatbot 1페이지(Phase 6 dev 테스트용) 노출. |
| CaseStore | js-module | `index.html` (script) | localStorage 기반 케이스 저장소 (Phase 6 Step 3). 챗봇 conversation·assessment·hospitals_snapshot을 case 단위로 보존. window.CaseStore expose. |
| Design Tokens v2 | css-tokens | `index.html` (`:root`) | 챗봇·마법사 시각 통일을 위한 모노크롬 + 단일 accent 디자인 시스템 토큰 (color/spacing/radius/font/transition). 레거시 변수는 alias로 보존. |
| HTML Research Builder | script | `scripts/build-research-page.mjs` | 통계 삽입 서술형 HTML 생성. |
| Codebook Schema | schema | `data/schemas/prektas-codebook.schema.json` | JSON Schema draft 2020-12 v2. reserved 필드 제거, if/then/else 삭제, level2/3/4 필수 객체. |
| Codebook Generator | script | `scripts/generate-prektas-codebook.mjs` | CSV → JSON 변환기. regex/eval 완전 제거. 헤더·코드·레벨 코드·등급 검증을 generator에서 수행. |
| Codebook Validator | script | `scripts/validate-prektas-codebook.mjs` | ajv + 무결성 + 충돌·이름 일관성 검증. whitelist 로직 폐지(항상 엄격). |
| KTAS Codebook CSV | external-dataset (excluded) | `/Users/sjlee/Projects/prektas-research/KTAS_codebook.csv` | 4,349 KTAS 공식 코드표. **본 프로젝트에서는 사용하지 않음.** 이전 phase 1의 오염 사고 이후 완전 격리 방침. |
| KTAS↔Pre-KTAS Mapping CSV | external-dataset (excluded) | `/Users/sjlee/Projects/prektas-research/KTAS_PreKTAS_mapping.csv` | 4,690 rows. **본 매핑 연구에 사용하지 않음** (Phase 3 리포트 §2 명시). KTAS 이름 재유입 차단 목적. |
| Source Keypad HTML (deprecated) | external-source | `/Users/sjlee/Projects/prektas-research/prektas-input-keypad.html` | **사용 금지.** RECORDS_RAW는 Pre-KTAS 코드 × KTAS_codebook 역인덱싱 가공물. Phase 1에서 이걸 정본으로 오인해 91.7% 오염 발생. |

## Relations

| Subject | Relation | Object | Context |
|---|---|---|---|
| Codebook Generator | reads | Pre-KTAS Codebook Source CSV | 직접 CSV 파싱. regex/eval 없음 |
| Codebook Generator | writes | Pre-KTAS Codebook JSON | 검증 통과 시에만 출력 |
| Codebook Validator | validates | Pre-KTAS Codebook JSON | schema + 무결성 + 이름 일관성 |
| Codebook Validator | references | Codebook Schema | ajv로 compile |
| Mapping Generator | reads | Pre-KTAS Codebook JSON | level2/3/4 name + grade 입력 |
| Mapping Generator | reads | EMRIS 중증응급질환 Y코드 | 27 Y코드 valid target set |
| Mapping Generator | writes | Pre-KTAS → Y 매핑 (v0.1) | JSON |
| Pre-KTAS → Y 매핑 (v0.1) | informs | Pre-KTAS → Y 매핑 보고서 | 수치 근거 |
| Tier Recommendation Generator | reads | Pre-KTAS → Y 매핑 (v0.1) | Y후보 입력 |
| Tier Recommendation Generator | reads | Y-Tier Classification | Y코드별 tier 룩업 |
| Tier Recommendation Generator | writes | Tier Recommendation | per-code tier + save flag |
| Tier Recommendation | informs | Tier Recommendation Report | 수치 근거 |

## Actions

| Date | Action | Actor | Target | Detail |
|---|---|---|---|---|
| 2026-04-23 | init | user | repository | 7a379bf: EMRIS 119 응급실 안내 챗봇 독립 프로젝트 분리. |
| 2026-04-23 | review | claude | prektas-research-standalone.html / report.html | 기존 파이프라인 진단. 암묵 스키마·self-fulfilling 평가·하드코딩 키워드 매칭·KTAS 코드북 '첨부만' 구조 확인. |
| 2026-04-23 | decision | user | codebook design | A-1(reserved 통합 보존) + B-2(severity 제거, grade 통합) 채택. |
| 2026-04-23 | create | claude | data/schemas/prektas-codebook.schema.json | draft 2020-12 schema. |
| 2026-04-23 | create | claude | scripts/generate-prektas-codebook.mjs | keypad.html → JSON generator. |
| 2026-04-23 | create | claude | scripts/validate-prektas-codebook.mjs | ajv + 무결성 + 충돌 분류. |
| 2026-04-23 | generate | claude | data/prektas-codebook.json | 4,689 entries. schema ok, integrity ok. |
| 2026-04-23 | decision | user | validator strictness | B 채택 (`--strict` 플래그 + K/L whitelist). |
| 2026-04-23 | create | claude | data/codebook-allowed-collisions.json | K/L 산부인과/비뇨기과 4건 whitelist. |
| 2026-04-23 | verify | claude | strict validator | 4 approved collisions 통과, 35 unapproved level3 충돌 검출 후 exit 1. |
| 2026-04-23 | commit | claude | 865d9f6 | `feat: Pre-KTAS 코드북 JSON 정본 및 스키마 검증 파이프라인 구축` (7 files, +83,925 lines). **잘못된 데이터** — 후속 phase에서 교체. |
| 2026-04-23 | commit | claude | f1a1de7 | `docs: phase wrap — Pre-KTAS 코드북 JSON 정본화 phase 기록`. |
| 2026-04-23 | investigate | user+claude | RECORDS_RAW 신원 | 사용자 지적으로 RECORDS_RAW가 KTAS 이름을 Pre-KTAS 코드로 역인덱싱한 가공물임이 확인됨. 100% label 일치가 증거. |
| 2026-04-23 | recover | user | iCloud .Trash | 진짜 Pre-KTAS_codebook.csv를 iCloud/.Trash/Pre-KTAS Research/Pre-KTAS/에서 발견. |
| 2026-04-23 | measure | claude | RAW vs REAL | 4,689 entries 중 4,303건(91.7%)의 label이 다름. level2 카테고리 이름 완전히 다름(KTAS vs Pre-KTAS 전용). |
| 2026-04-23 | replace | claude | data 파이프라인 전면 | CSV를 data/raw/에 복사, generator/schema/validator 전면 재작성. K/L whitelist 폐지. 재생성 결과 충돌 0, 경고 0. |

## Phase 3 Actions (2026-04-24)

| Date | Action | Actor | Target | Detail |
|---|---|---|---|---|
| 2026-04-24 | pivot | user | research scope | 연구 목적 재정의: 0–3 질문으로 Pre-KTAS → EMRIS 27 Y코드 매핑 가능성 규명. |
| 2026-04-24 | locate | claude | EMRIS disease codes | `emris-data/devdocs/disease_codes.json`에서 27 Y코드 canonical 확인 (이전 19개 하드코딩은 불완전 서브셋). |
| 2026-04-24 | clean | claude | 5 contaminated untracked files | `prektas-research-*.{html,json}`, `scripts/build-prektas-*.mjs`, `scripts/evaluate-prektas-research.mjs` 삭제. |
| 2026-04-24 | create | claude | `data/emris-severe-emergency-diseases.json` | 27 Y코드 target 정본. |
| 2026-04-24 | create | claude | `scripts/research/build-prektas-to-y-mapping.mjs` | v0.1 rule-based 매핑 생성기. |
| 2026-04-24 | run | claude | v0.1 baseline | q0=268 / q1=527 / q2=94 / q3+=0 / unmapped=3800. coverage 19.0%. |
| 2026-04-24 | write | claude | `research/prektas-to-y-mapping-report.md` | 8섹션 서술형 보고서. |

## Phase 4 Actions (2026-04-24)

| Date | Action | Actor | Target | Detail |
|---|---|---|---|---|
| 2026-04-24 | pivot | user | 연구 프레이밍 | "Y코드 확정" → "응급의료센터 등급 추천". 권역 세이브 전략 지시. |
| 2026-04-24 | create | claude | `data/y-code-to-center-tier.json` | 27 Y코드 tier 1차안 (권역 12 / 지역센터 15). |
| 2026-04-24 | create | claude | `scripts/research/build-prektas-tier-recommendation.mjs` | tier 추천 생성기. |
| 2026-04-24 | run | claude | tier 추천 v1.0 | 권역 398 / 지역센터 2,341 / 지역기관 1,950. 권역 세이브율 85.5%. |
| 2026-04-24 | write | claude | `research/prektas-tier-recommendation-report.md` | 8섹션 서술 보고서. |
| 2026-04-24 | feedback | user | v1.0 tier 분류 교정 지시 | 정신과·안과는 권역·지역센터 공동, 단순 폐렴·경외상은 지역센터 우선. "권역 세이브" 서사 폐기. |
| 2026-04-24 | fix | claude | tier 1.0 → 1.1 | 권역 전용 12→7, 공동 커버 15→20. 복합 Y후보 교집합 규칙 도입. tier_strategy 4범주 분류. |
| 2026-04-24 | run | claude | tier 추천 v1.1 | regional_only=210(4.5%), 공동=2,529(53.9%), local_center_preferred=1,218(26%), local_institution_preferred=732(15.6%). |

## Phase 6 Actions (2026-04-25) — 챗봇 통합 완료

| Date | Action | Actor | Target | Detail |
|---|---|---|---|---|
| 2026-04-25 | refactor | claude | `index.html` | 디자인 토큰 v2 도입 + 모노크롬·sharp corners 갱신 (Step 1-2). |
| 2026-04-25 | create | claude | CaseStore 모듈 | localStorage 기반 케이스 저장소 + drawer UI (Step 3-4). |
| 2026-04-25 | integrate | claude | sendMessage ↔ CaseStore | 자유 채팅 메시지 자동 case 보존 (Step 5). |
| 2026-04-25 | create | claude | 입력 모드 토글 + 마법사 inline | Pre-KTAS 4단계 + 추가 질문 narrowing UI (Step 6-7). |
| 2026-04-25 | create | claude | `lib/chatbot-payload.js` | 정본 데이터 페이로드 (671KB) 빌드 스크립트. |
| 2026-04-25 | merge | claude | runCaseFromInput | 자유 채팅·마법사 합류 함수. searchAndShow 시그니처 확장 (Step 8). |
| 2026-04-25 | extend | claude | HARNESS_INTERPRET_PROMPT | 마법사 4임무 addendum (Y코드 검토 + 자원 요건) (Step 9). |
| 2026-04-25 | render | claude | prektas_review 카드 + override 재조회 | LLM 응답 UI (Step 11-12). |
| 2026-04-25 | label | claude | recommender 페이지 교육·연구용 배너 | 챗봇과 별도 도구 명시 (Step 14). |
| 2026-04-25 | document | claude | `ui-audit/phase6-e2e-scenarios.md` | 7개 통합 테스트 시나리오. |

## Phase 6 Entities (추가)

| Entity | Type | Location | Description |
|---|---|---|---|
| Chatbot Payload | data | `lib/chatbot-payload.js` | 정본 코드북·매핑·tier·questions·diseases 합본. window.PrektasData expose. |
| Chatbot Payload Builder | script | `scripts/build-chatbot-payload.mjs` | 4 JSON 합쳐 lite payload 생성. |
| WizardController | js-module | `index.html` (script) | 챗봇 인라인 마법사 state machine (group → l2 → l3 → l4 → questions → submit). |
| runCaseFromInput | js-function | `index.html` (script) | 자유 채팅·마법사 합류 함수. EMRIS 호출 + LLM 4임무 호출 통합. |
| prektas_review (UI) | render-component | `index.html` (script) | LLM Y코드 검토 카드 + 자원 요건 박스 + override 재조회 버튼. |
| E2E Test Scenarios | doc | `ui-audit/phase6-e2e-scenarios.md` | 7개 manual test scenarios (PoC 데모용). |

## Phase 7 Entities (추가, 2026-04-25)

| Entity | Type | Location | Description |
|---|---|---|---|
| callLLMWithRetry | js-function | `index.html` (script) | 점증 backoff [0, 1s, 3s, 5s, 10s] 4회 재시도 헬퍼. retryable=false면 즉시 반환. fetchFn 표준 응답 객체 (`{ ok, data?, kind?, status?, retryable? }`) 강제. |
| renderLLMError | render-component | `index.html` (script) | LLM 실패 시 렌더되는 에러 카드. 헤더 + 본문 + 재시도 버튼 + `<details>` 진단 정보 (kind/HTTP/message). 한국어 라벨. |
| HARNESS_FOLLOWUP_PROMPT | llm-prompt | `index.html` (script) | 직전 환자 컨텍스트·추천을 존중하는 평문 한국어 follow-up 프롬프트. 인접 광역 안내 + 재조회 필요 명시 + Y코드 노출 금지. |
| runFollowUp | js-function | `index.html` (script) | 활성 케이스의 messages를 LLM contents로 직렬화. 에러 카드 prefix 필터링. callLLMWithRetry 사용. |
| viewCaseReadOnly | render-function | `index.html` (script) | 기록 패널 클릭 시 chat 영역에 메시지 리플레이 + 케이스 헤더 배너 + 마감 안내. drawer 자동 닫기. |
| enhanceRibbonScroll | js-function | `index.html` (script) | 리본 row를 `.ribbon-wrap`로 감싸고 좌·우 화살표 + 마우스 드래그 스크롤을 추가. 드래그 후 단발 click suppress. |

## Phase 7 Actions (2026-04-25) — AI 폴백 제거 + UX 정리

| Date | Action | Actor | Target | Detail |
|---|---|---|---|---|
| 2026-04-25 | feedback | user | wizard reset + LLM 라벨 | 새 케이스 클릭 시 wizard도 첫 단계로 + "Y코드 매핑" 같은 시스템 식별자 미노출. |
| 2026-04-25 | fix | claude | `dd1dc9f` | WizardController.reset() + 사용자 라벨 한국어화 + LLM 임무 A 프롬프트 평문 한국어 강제. |
| 2026-04-25 | feedback | user | AI 모드 폴백 제거 | LLM 실패 시 룰 기반 결과로 떨어지면 안 됨, 재시도 후 명시적 에러 표시. AI 디폴트 ON. |
| 2026-04-25 | refactor | claude | `ddbe35b` | callLLMWithRetry 헬퍼 + renderLLMError 카드 + parseWithLLM/interpretWithHarness 폴백 제거 + renderRateLimitChoice 정리 + AI 디폴트 명시화. |
| 2026-04-25 | feedback | user | follow-up 컨텍스트 + 기록 패널 | 위저드 후 후속 질문 시 컨텍스트 끊김 + 기록 항목 클릭 무동작. |
| 2026-04-25 | implement | claude | `a0ed5a3` | HARNESS_FOLLOWUP_PROMPT + runFollowUp + viewCaseReadOnly. sendMessage 라우팅 분기. |
| 2026-04-25 | feedback | user | "마법사" 용어 제거 | 평가 도구 정체성을 흐림. Pre-KTAS로 직설적 통일. |
| 2026-04-25 | rename | claude | `7dd3739` | index.html, build-chatbot-payload.mjs, build-hospital-recommender.mjs, lib/chatbot-payload.js의 "마법사" → "Pre-KTAS" 24+ 곳. 내부 식별자(WizardController, mode-wizard-btn)는 보존. |
| 2026-04-25 | feedback | user | 리본 화살표·드래그 + Level 표기 | 좁은 viewport 좌우 끝 항목 접근성 + 케이스 메시지에 환자 grade 추가. |
| 2026-04-25 | implement | claude | `c363110` | enhanceRibbonScroll + ribbon-arrow CSS + Pre-KTAS 평가 메시지 "(Level N)" 포함. |
| 2026-04-25 | review | claude | post-merge audit | Quality 8.5/10. 3 informational (follow-up generation token, 에러 prefix 필터, viewCaseReadOnly 모호성). 0 critical. |
| 2026-04-25 | deploy | claude | Vercel production | `https://119chat.emergency-info.com` 5 commits 배포 + 마커 검증. |

## Phase 7 Relations

| Subject | Relation | Object | Context |
|---|---|---|---|
| callLLMWithRetry | wraps | parseWithLLM | 키워드 매칭 실패 시 LLM 호출 재시도 |
| callLLMWithRetry | wraps | interpretWithHarness | 추천 단계 LLM 호출 재시도 |
| callLLMWithRetry | wraps | runFollowUp | follow-up LLM 호출 재시도 |
| renderLLMError | rendered-by | searchAndShow | LLM 추천 실패 시 폴백 대신 노출 |
| renderLLMError | rendered-by | sendMessage | parseWithLLM 실패 시 노출 |
| renderLLMError | rendered-by | runFollowUp | follow-up 실패 시 노출 |
| runFollowUp | reads | CaseStore.getActive | 활성 케이스 messages·hospitals_snapshot |
| runFollowUp | uses | HARNESS_FOLLOWUP_PROMPT | 평문 한국어 follow-up 시스템 프롬프트 |
| sendMessage | routes-to | runFollowUp | 활성 케이스 + hospitals_snapshot 있고 keyword 미스 시 |
| viewCaseReadOnly | reads | CaseStore (case object) | drawer 클릭 시 |
| enhanceRibbonScroll | called-by | buildRibbons | region/disease 두 ribbon에 화살표·드래그 wiring |

## Phase 8a-2 Entities (추가, 2026-04-25) — 자문 도구

| Entity | Type | Location | Description |
|---|---|---|---|
| Consultation Tool | rendered-html (SPA) | `prektas-consultation.html` | 응급의학 전문의 자문용 standalone 49.4KB SPA. 27 Y-code × ICD-10 prefill + 임상 결정 + 임계값 + red flags. localStorage auto-save. JSON export. |
| Consultation State | client-state | localStorage `emris_consultation_v1` | 자문 진행 상태. y_codes (include/exclude/custom/decisions/notes/touched), thresholds, red_flags. |
| Consultation Output | research-output (예정) | `research/consultation-{date}-{id}.json` | 자문 도구에서 export된 JSON. maintainer가 수령 후 frozen reference standard로 변환. |
| Y-code → ICD-10 Cluster (frozen) | research-output (Phase 8a-2 완료 시) | `research/y-code-icd10-clusters.json` | Consultation Output을 변환한 final mapping. Phase 8c per-visit 라벨링의 reference standard. |

## Phase 8a-2 Relations

| Subject | Relation | Object | Context |
|---|---|---|---|
| Consultation Tool | reads | Y_CODES (inline data) | 27 Y-code × ICD-10 prefill |
| Consultation Tool | writes | Consultation State | localStorage auto-save on every input |
| Consultation Tool | exports | Consultation Output | JSON download/clipboard |
| Consultation Output | converted-to | Y-code → ICD-10 Cluster (frozen) | maintainer 수령 후 commit |
| Validation Pipeline Script | reads | Y-code → ICD-10 Cluster (frozen) | reference standard로 사용 |

## Phase 8a-2 Actions (2026-04-25)

| Date | Action | Actor | Target | Detail |
|---|---|---|---|---|
| 2026-04-25 | declare | user | role | "내가 응급의학 전문의다. 뭘 하면 되는가?" — Phase 8a-2 자문 즉시 가능 선언 |
| 2026-04-25 | offer | claude | 작업 방식 4안 | markdown form / 대화형 Q&A / 개별 세션 / web 도구 |
| 2026-04-25 | choose | user | web 자문 도구 빌드 | 자기 페이스 작업 + localStorage 보존 + 재사용 가능 |
| 2026-04-25 | build | claude | `prektas-consultation.html` | 49.4KB SPA. 좌측 사이드바 + 27 Y-code 페이지 + 임계값 + red flags + export |
| 2026-04-25 | prefill | claude | 27 Y-code × 8 ICD-10 = 216 코드 후보 + 12+ 임상 결정 옵션 | 응급의학 임상 통상 기준 default. 전문의 검토·수정 대상. |
| 2026-04-25 | design | claude | "icd_blind" honest reporting option | Y0141/0142 등 ICD-10 분류 불가 케이스 명시 제공. 강제 분류 회피. |
| 2026-04-25 | xss-safe | claude | DOM 조작 전체 | `el()` + textContent + createElement. innerHTML 미사용. 보안 hook 통과. |
| 2026-04-25 | link | claude | research page nav | "전문의 자문 도구" 링크 헤더·푸터에 추가. |
| 2026-04-25 | review | claude | post-merge audit | Quality 8.5/10. 3 informational, 0 critical. |
| 2026-04-25 | commit | claude | `c13f582` | `feat(consultation): 응급의학 전문의 자문 도구`. |
| 2026-04-25 | deploy | claude | Vercel production | `https://119chat.emergency-info.com/prektas-consultation.html` |

## Phase 8 Entities (추가, 2026-04-25) — 학술 검증 protocol

| Entity | Type | Location | Description |
|---|---|---|---|
| Validation Protocol v1.0 | research-protocol | `research/prektas-validation-protocol.md` | 사전 등록(preregistered) 분석 계획. STARD 2015 준수. 4 가설(H1-H4), 11 sub-phases, threats to validity, ethics, reproducibility. Source of truth. |
| Validation Protocol Page | rendered-html | `prektas-research.html` | protocol 요약·시각화. 매거진 레이아웃. 10 chapters. `scripts/build-research-page.mjs` 산출. |
| Source ED Visits CSV | external-dataset | `/Users/sjlee/Projects/prektas-research/source-prektas.csv` | 225,017 ED visits, EUC-KR, 24 cols. 퇴실진단 ICD-10 ground truth 포함. 99.2% 매칭률. Phase 8b에서 표준화 예정. |
| Pre-KTAS Code Crosswalk | research-output (Phase 8a-1, 예정) | `research/prektas-code-crosswalk.json` | 5자(codebook) ↔ 6자(실측 CSV) 매핑. 분석 전제 조건. 매핑 실패율 ≥10% 시 별도 sensitivity. |
| Y-code → ICD-10 Cluster | research-output (Phase 8a-2, 예정) | `research/y-code-icd10-clusters.json` | 27 Y코드별 ICD-10 cluster. 응급의학 전문의 1인 자문 후 frozen. Reference standard 정의. |
| Validation Pipeline Script | script (Phase 8b-f, 예정) | `scripts/research/validate-phase8.mjs` | source CSV → 표준화 → ground truth 라벨링 → index test 4 시나리오 적용 → metrics + bootstrap. |
| Validation Results | research-output (Phase 8e, 예정) | `research/validation-results-v0.1.json` | per-Y-code precision·recall·F1 + 이항 sensitivity·specificity 95% Wilson CI. 익명화. |
| Error Audit Report | research-output (Phase 8g, 예정) | `research/error-audit-v0.1.md` | top 100 false negative case audit + 응급의학 전문의 검토. v0.2 우선순위 도출. |

## Phase 8 Relations

| Subject | Relation | Object | Context |
|---|---|---|---|
| Validation Protocol | references | Source ED Visits CSV | reference standard 입력 |
| Validation Protocol | references | Mapping Generator (Phase 3) | index test (frozen commit hash) |
| Pre-KTAS Code Crosswalk | required-by | Validation Pipeline Script | 5자/6자 정합성 사전 해결 |
| Y-code → ICD-10 Cluster | required-by | Validation Pipeline Script | reference standard 정의 |
| Validation Pipeline Script | reads | Source ED Visits CSV | input 데이터 |
| Validation Pipeline Script | writes | Validation Results | per-visit prediction + metrics |
| Validation Results | informs | Error Audit Report | top FN/FP 케이스 추출 근거 |
| Validation Protocol | renders-as | Validation Protocol Page | source of truth → 페이지 요약 |
| Validation Protocol Page | rendered-by | scripts/build-research-page.mjs | HTML 빌드 |

## Phase 8 Actions (2026-04-25) — 검증 protocol 동결

| Date | Action | Actor | Target | Detail |
|---|---|---|---|---|
| 2026-04-25 | request | user | research planning | "학술적으로 증명을 계획하자. Pre-KTAS + 몇가지 질문으로 중증질환 매핑 가능한가/얼마나 정확한가." 기존 /research.html 대체 지시. |
| 2026-04-25 | scan | claude | source-prektas.csv | 1차 prevalence 추정 (Y0010-Y0120 ICD-10 prefix), 99.2% 매칭률 확인, **5자/6자 코드 정합성 불일치 77.9% 발견**. |
| 2026-04-25 | design | claude | protocol v1.0 | STARD 2015 가이드라인 기반 사전 등록 분석 계획 작성. 4 가설(sensitivity·specificity·한계효용·tier 일치). |
| 2026-04-25 | create | claude | `research/prektas-validation-protocol.md` | 437 lines. Protocol ID PREKTAS-VAL-2026-001. Source of truth. |
| 2026-04-25 | rewrite | claude | `scripts/build-research-page.mjs` | 기존 v0.1 룰 설명 → protocol 요약 페이지 빌드. 매거진 레이아웃 유지. |
| 2026-04-25 | rebuild | claude | `prektas-research.html` | 10 chapters, 가설 카드, 데이터 정합성 ⚠ 경고, Phase 8 로드맵, 위협·완화 표. |
| 2026-04-25 | review | claude | post-merge audit | Quality 9/10. 3 informational (protocol↔script 동기화 / prevalence raw 추정 / 5자6자 격리 결정 valid). 0 critical. |
| 2026-04-25 | commit | claude | `6755041` | `feat(research): Phase 8 진단정확도 검증 protocol v1.0 + research.html 전면 교체`. |
| 2026-04-25 | deploy | claude | Vercel production | `https://119chat.emergency-info.com/prektas-research.html` 배포 + 마커 검증. |

## Phase 8 1차 데이터 스캔 결과 (사전 추정)

| 측정 | 값 | 출처 |
|---|---|---|
| Total visits | 225,017 | source-prektas.csv 행 수 |
| 네디스매칭률 | 99.2% (223,115 / 225,017) | `네디스매칭여부 = 매칭` |
| Pre-KTAS 코드 첫문자 A | 77.9% (175,237) | `최초KTAS분류과정` 첫 글자 — 6자 형식 |
| Pre-KTAS 코드 첫문자 C/D | 0% | codebook 5자 형식과 직접 매칭 X |
| 비공란 (코드 없음 또는 다른 형식) | 22.1% (49,780) | 별도 처리 필요 |
| Y0010 심근경색 (I21/I22) | 987 (0.44%) | ICD-10 prefix raw |
| Y0020 뇌경색 (I63) | 3,378 (1.50%) | ICD-10 prefix raw |
| Y0031 거미막하 (I60) | 512 (0.23%) | ICD-10 prefix raw |
| Y0032 뇌출혈 (I61/I62) | 1,415 (0.63%) | ICD-10 prefix raw |
| Y0041/0042 대동맥 (I71) | 175 (0.08%) | ICD-10 prefix raw |
| Y005x 담낭담관 (K80-K83) | 1,495 (0.66%) | ICD-10 prefix raw |
| Y0060 복부응급 (selected K) | 2,087 (0.93%) | ICD-10 prefix raw |
| Y0111-3 산부인과 (O) | 161 (0.07%) | ICD-10 prefix raw |
| Y0120 화상 (T2x) | 348 (0.15%) | ICD-10 prefix raw |
| **추정 severe prevalence** | **~4.7% (10,500/225,017)** | **overlap 무시 1차 추정** |
| 표본 sufficient for primary endpoint | 예 | 예상 TP ~11,250, CI 폭 ≤0.015 |

> 위 prevalence는 ICD-10 prefix만 기준한 raw 추정. Phase 8a-2의 frozen Y-code → ICD-10 cluster 적용 후 재산출 예정.

## Next Phase Candidates

Phase 4 리포트 §7에서 승계.

1. **실측 검증 (최우선)** — `source-prektas.csv` 225k 방문으로 false negative rate 측정. "중증인데 지역기관 추천" 비율 정량화 없이는 배포 불가.
2. **Y-tier 1차안 응급의학 전문의 리뷰** — 특히 Y0131/0132/0120 분류 정합성.
3. **v0.1 rule gap 보강** — Y0042 복부대동맥(현재 2건만), Y0141/0142 투석(현재 0건), Y0070 장중첩 등.
4. **EMRIS 실시간 병상 데이터 통합** — `acceptable_tiers`의 "여유시 권역" 판정을 실제 `emris-data/devdocs/{hospitals,beds,messages}.json`로 구체화.
5. **지역별 병원 capability 매트릭스** — 행정 등급(권역/지역센터/지역기관) 대신 실제 Y코드 커버 능력 기반 추천.

### 운영 action items

- iCloud `.Trash/Pre-KTAS Research/`의 원본 CSV 영구 보존 필요. 30일 후 영구 삭제 위험. Finder → 최근 삭제된 항목 → Put Back.
