# Changelog

## [2026-04-24] Phase 4.1: tier 분류 현실 반영 교정

### Fixed
- **v1.0 분류 오류 교정**: 정신과 응급(Y0150)·안과 응급(Y0160)·내시경·투석·산부인과 등을 "지역센터만으로 충분"으로 분류한 것은 한국 의료 자원 현실과 어긋남 (정신과 폐쇄병동·24/7 안과 당직은 권역·대형 지역센터에만 안정적). v1.1에서 이들을 **"권역·지역센터 공동 커버"**로 재분류.
- 반대로 단순 폐렴·경중등도 교통사고(grade 3)는 "지역기관 기본"에서 **"지역센터 우선"**으로 전환.
- "권역 세이브" 서사 폐기. v1.0의 "85.5% 세이브율"은 권역이 과잉 자원이라는 잘못된 전제. v1.1은 `tier_strategy` 4범주로 각 케이스의 수용 가능 tier를 직접 표현.

### Changed
- `data/y-code-to-center-tier.json` v1.0 → v1.1. 권역 전용 12개 → 7개로 축소(NICU·화상센터·수부외과·IR·흉부대동맥). 나머지 20개는 `acceptable=[regional, local_center]` 공동 커버.
- `scripts/research/build-prektas-tier-recommendation.mjs` 전면 개편. 복합 Y후보는 **acceptable 교집합** (안전 보수적). `tier_strategy` 필드 4범주 분류(regional_only / regional_or_local_center / local_center_preferred / local_institution_preferred).
- `research/prektas-tier-recommendation.json` v1.1 재생성.
- `research/prektas-tier-recommendation-report.md` 전면 재작성.

### Key Findings (v1.1)
- **진짜 권역 전용(`regional_only`): 210건 (4.5%)** — NICU(29), 중증화상(47), 수부사지접합(69), 흉부대동맥 단독/복합(65+2). v1.0의 "권역 필수 398건"보다 현실적.
- 권역·지역센터 공동(`regional_or_local_center`): 2,529건(53.9%) — 대부분의 Y코드와 grade 1–2 unmapped.
- 지역센터 우선(`local_center_preferred`): 1,218건(26.0%) — grade 3 단순 폐렴·경중등도 외상 등.
- 지역기관 우선(`local_institution_preferred`): 732건(15.6%) — grade 4–5 경증.
- Y0010 흉통 63건이 Y0041 때문에 권역 전용으로 shift되는 것은 v0.2 rule 개선(압박성 흉통으로 Y0010 단독 분기) 시 복원 가능.

## [2026-04-24] Phase 4: 응급의료센터 등급 추천 전략 (권역 세이브)

> **⚠️ v1.0 분류 오류**: 정신과·안과를 "지역센터만"으로 분류한 것은 한국 의료 자원 분포와 어긋남. Phase 4.1에서 교정됨. 아래 기록은 history 보존용.

### Context

Phase 3의 "Pre-KTAS → Y코드 1개 확정" 프레이밍이 임상적으로 unsafe함(현장 진단 불가)이 확인됨. 프레이밍을 **"Pre-KTAS → 응급의료센터 등급(권역/지역센터/지역기관) 추천"**으로 전환. 진단 없이 자원 등급만 판정 → 안전. 핵심 전략은 **권역 세이브**.

### Added
- `data/y-code-to-center-tier.json` — 27 Y코드별 tier 분류 1차안. 권역 전용 12개(신경/대동맥/NICU/화상/접합/혈관중재), 지역센터 가능 15개.
- `scripts/research/build-prektas-tier-recommendation.mjs` — Pre-KTAS → tier 추천 생성기. Y후보 + grade fallback 규칙 기반.
- `research/prektas-tier-recommendation.json` — 4,689 엔트리별 {primary_tier, acceptable_tiers, regional_save_applied, source, rationale}.
- `research/prektas-tier-recommendation-report.md` — 8섹션 서술형 보고서.

### Changed
- `package.json` — `research:prektas-tier-recommendation`, `research:all` 스크립트 추가.

### Key Findings
- **권역 필수 398건(8.5%)** / 지역센터 2,341건(49.9%) / 지역기관 1,950건(41.6%).
- **권역 세이브율 85.5%** (save-eligible 2,739건 중 2,341건을 지역센터로 전환). 기존 "grade 1–2 전부 권역" 관행 대비 약 5.9배 축소.
- 신경계 권역 비율 54.5% — Y0020/0031/0032가 모두 권역 전용이라 의식변화·두통·뇌졸중 증상 후보 전부 권역으로. 유일한 고비율 카테고리.
- 정신건강·눈 100% 지역센터. 물질오용 쇼크/패혈증도 지역센터로 세이브됨 (내과적 중증은 지역센터 ICU로 충분).
- Y0042(복부대동맥) 2건·Y0141/0142(투석) 0건 — v0.1 rule gap이 tier 분포에도 전파. 개선 과제.

### Verification
- `npm run codebook:rebuild` ok (회귀 없음).
- `npm run research:all` ok — v0.1 매핑 → tier 추천 전 파이프라인 통과.

## [2026-04-24] Phase 3: Pre-KTAS → EMRIS 중증응급질환(27 Y코드) 매핑 v0.1 baseline

### Context

연구 목적 재정의: 4,689 Pre-KTAS 코드를 **0–3개 추가 질문**으로 EMRIS 종합상황판의 27 중증응급질환 Y코드에 매핑 가능한지 규명. 나머지 분석은 이 매핑이 어떻게 작동·실패하는지에 대한 연구.

### Added
- `data/emris-severe-emergency-diseases.json` — EMRIS 27 중증응급질환 Y코드 canonical. `emris-data/devdocs/disease_codes.json` 에서 이식. 각 항목 `{code, label, short, group, age}` 구조.
- `scripts/research/build-prektas-to-y-mapping.mjs` — rule-based v0.1 매핑 생성기. 12개 도메인 규칙 + 13개 구조화 질문 카탈로그.
- `research/prektas-to-y-mapping.json` — 4,689 Pre-KTAS 엔트리별 {후보 Y코드 집합, 필요 질문, rationale, confidence}.
- `research/prektas-to-y-mapping-report.md` — 8개 섹션 서술형 보고서. coverage·등급 교차·카테고리 분석·Y코드별 후보 수·rule gap 식별.

### Changed
- `package.json` — `research:prektas-to-y-mapping` 스크립트 추가.

### Removed (cleanup)
- `prektas-research-report.html`, `prektas-research-report.json`, `prektas-research-standalone.html`, `scripts/build-prektas-{report-html,research-standalone}.mjs`, `scripts/evaluate-prektas-research.mjs` — 모두 KTAS_codebook.csv 하드코딩 참조의 오염 산출물. untracked 상태로 삭제.

### Key Findings (v0.1)
- 전체 4,689 중 매핑 가능 889건(19.0%): 0질문 268 / 1질문 527 / 2질문 94 / 3+질문 0 / unmapped 3,800.
- **grade 1 소생 코드의 80.6%가 unmapped** — rule gap이 아니라 두 체계의 목적 차이(Pre-KTAS=triage, Y코드=수술·시술 자원 디스패치)로 해석. 물질오용 쇼크/패혈증 등 내과적 중증은 27 Y코드 외가 정답.
- Pre-KTAS 코드 첫 문자(C=성인, D=소아)로 연령 분기(Y0081/Y0082, Y0091/Y0092, Y0171/Y0172)는 **추가 질문 0개**로 해결. Pre-KTAS 코드의 구조적 정보 가치.
- 100% coverage 된 `눈`·`정신건강` 카테고리는 over-inclusion 위험; 향후 pre-filter 개선 대상.
- rule gap 후보 5건 식별(임신 20주+ 일반 복통 → Y0112, 복부 대동맥 키워드, 몸통외상 세부 등). 개선 시 +≈10%p coverage 예상.

### Verification
- `npm run codebook:rebuild` ok (회귀 없음).
- `npm run research:prektas-to-y-mapping` exit 0, JSON + 요약 출력.
- 보고서 §4-1 수치가 스크립트 출력과 일치.

## [2026-04-23] Phase: 정본 Pre-KTAS 코드북 확보 및 KTAS-오염 데이터 교체

### Fixed
- **CRITICAL**: 직전 phase의 `data/prektas-codebook.json`은 Pre-KTAS 코드북이 아니라 "Pre-KTAS 코드로 KTAS 이름을 역인덱싱한 오염 데이터"였음. 4,689 entries 중 **4,303건(91.7%)의 level2/3/4 이름이 실제 Pre-KTAS 정본과 다름**. 원인: `prektas-input-keypad.html`의 RECORDS_RAW를 "사실상의 Pre-KTAS 코드북"으로 취급했으나, 그것은 Pre-KTAS 코드 × KTAS_PreKTAS_mapping.csv × KTAS_codebook.csv로 파생된 가공물이었음.
- level2 카테고리 이름이 KTAS 쪽 용어(산부인과/비뇨기과/이비인후과/정형외과/...)였던 것을 Pre-KTAS 정본 용어(임신/여성생식계, 비뇨기계/남성생식계, 입·목/얼굴, 근골격계, ...)로 전면 교체.
- level2 카테고리 개수가 18개(K/L 충돌 유령 포함)였던 것이 정본 17개로 정리. K/L 산부인과/비뇨기과 충돌은 cross-taxonomy remap 아티팩트였음이 확인되어 허용 리스트 폐지.
- 35개 `level3` 충돌 (직전 phase의 `--strict` 에러) 전부 동일 아티팩트로 확정. 정본 데이터에서는 0건.
- `reserved` 개념 제거. 직전 phase의 "reserved 118건"은 Pre-KTAS의 reserved가 아니라 KTAS 매핑 실패였음. 정본 Pre-KTAS는 4,689건 전부 labeled.

### Added
- `data/raw/Pre-KTAS_codebook.csv` — 정본 Pre-KTAS 코드북 원본 CSV (4,689 entries). 9컬럼: `구분, 분류코드, 2단계_코드, 2단계_명칭, 3단계_코드, 3단계_명칭, 4단계_코드, 4단계_명칭, 중증도`. iCloud Drive의 Trash 영역에 방치돼 있던 파일을 복구 후 커밋.

### Changed
- `scripts/generate-prektas-codebook.mjs` — 외부 HTML에서 regex + 동적 평가하던 방식 완전 폐기. `data/raw/Pre-KTAS_codebook.csv`를 직접 파싱. 헤더 검증, code↔level 각 자리 일치 검증, grade 범위 검증을 generator 시점에 수행해 오염된 CSV가 들어오면 즉시 throw.
- `data/schemas/prektas-codebook.schema.json` v2 — `reserved` 필드 제거, `if/then/else` null-동기 조건 제거, level2/3/4 비-nullable 단순화. `stats.level2_category_count` 추가.
- `data/prektas-codebook.json` v2.0.0 — 정본 CSV 기준 재생성. 4,689 entries, 17 level2 categories, adult 2,241 + pediatric 2,448.
- `scripts/validate-prektas-codebook.mjs` — whitelist/`--strict` 로직 제거. 모든 level2·level3 이름 충돌과 level2 코드↔이름 불일치를 error로 직접 fail.
- `package.json` — `codebook:validate:strict` 스크립트 제거 (validator 자체가 항상 엄격).

### Removed
- `data/codebook-allowed-collisions.json` — K/L whitelist 폐지 (아티팩트였음이 확인됨).

### Review
- 정본 CSV의 SHA-256: `d75b39170fb4aa5a40051cdfb4cb1ff843a17764e6ffddf99527a56751d1061f`
- `npm run codebook:rebuild` 실행 결과: schema ok, integrity ok, 충돌·경고 0건.
- 연구 문서 `prektas-research/outputs/codebook-structural-research.md`의 "Pre-KTAS와 KTAS는 동일한 17개 카테고리 사용" 주장은 level2 **코드 문자** 기준이며, level2 **이름**은 서로 다른 시스템 전용 용어 사용. 본 phase에서 Pre-KTAS 전용 용어로 올바르게 복원됨.
- 원본 CSV는 iCloud/.Trash에 있어 영구 삭제 위험이 있었음. 사용자가 .Trash에서 직접 복원(Put Back) 권장. 본 프로젝트 내에는 `data/raw/`로 복사하여 재현성 확보.

## [2026-04-23] Phase: Pre-KTAS 코드북 JSON 정본화 및 스키마 검증 (취소·교체됨)

> **⚠️ 이 phase의 산출물은 잘못된 전제 위에 구축됨.** RECORDS_RAW를 Pre-KTAS 정본으로 오인. 91.7%의 레이블이 KTAS 쪽 용어로 오염되어 위 phase에서 전면 교체됨. 아래 기록은 history 보존용.

### Added
- `data/prektas-codebook.json` — 정본 Pre-KTAS 코드북 (4,689 entries, adult 2,241 + pediatric 2,448, labeled 4,571 + reserved 118). 소스 HTML의 SHA-256을 포함해 무결성 추적.
- `data/schemas/prektas-codebook.schema.json` — JSON Schema draft 2020-12. code `^[CD][A-Z]{4}$`, grade 1–5, `reserved↔level2/3/4=null` 동기 조건을 `if/then/else`로 강제.
- `data/codebook-allowed-collisions.json` — 산부인과/비뇨기과 K·L 공유를 known historical overlap으로 whitelist.
- `scripts/generate-prektas-codebook.mjs` — `prektas-input-keypad.html` → 정본 JSON 변환기. level2/3/4 코드를 Pre-KTAS 5자 코드에서 구조적으로 도출.
- `scripts/validate-prektas-codebook.mjs` — ajv 기반 스키마 + 무결성 검증 (code↔group 정합, 각 자리↔level 코드 일치, stats 재계산, collision 분류). `--strict`로 whitelist 밖 충돌을 에러로 승격.
- `package.json`, `package-lock.json` — ajv/ajv-formats 의존성. npm scripts: `codebook:generate`, `codebook:validate`, `codebook:validate:strict`, `codebook:rebuild`.

### Changed
- Pre-KTAS 코드북이 "다른 프로젝트의 HTML에서 regex로 긁어 동적 평가"하던 방식에서 **정본 JSON 소비 + 스키마 강제** 방식으로 전환 시작. (generator 1곳에만 `JSON.parse(regex매치)` 잔존 — 다음 phase에서 downstream 빌드 스크립트를 JSON만 읽도록 분리 예정.)

### Fixed
- 해당 없음. 본 phase는 신규 파이프라인 수립.

### Review
- Focused critical pass against 865d9f6: SQL/concurrency/shell/LLM trust 해당사항 없음.
- 확인된 Informational 이슈:
  - `scripts/generate-prektas-codebook.mjs:11` 소스 경로 절대경로 하드코딩. 타 머신/CI에서 generator 실행 불가. 다음 phase에서 환경변수화 필요.
  - regex 추출의 failure-mode coverage 부족 — 포맷이 바뀌면 조용히 부분 추출 가능성. 현재 RECORDS_RAW 구조상 실제 리스크는 낮음.
- Strict validator 실행 결과: schema ok, integrity ok, 4 approved collisions (K/L 산부인과/비뇨기과), **35 unapproved level3 collisions** 검출. 다음 phase에서 건별 심사 필요.

