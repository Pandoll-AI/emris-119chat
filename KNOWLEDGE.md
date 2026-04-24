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

## Next Phase Candidates

Phase 4 리포트 §7에서 승계.

1. **실측 검증 (최우선)** — `source-prektas.csv` 225k 방문으로 false negative rate 측정. "중증인데 지역기관 추천" 비율 정량화 없이는 배포 불가.
2. **Y-tier 1차안 응급의학 전문의 리뷰** — 특히 Y0131/0132/0120 분류 정합성.
3. **v0.1 rule gap 보강** — Y0042 복부대동맥(현재 2건만), Y0141/0142 투석(현재 0건), Y0070 장중첩 등.
4. **EMRIS 실시간 병상 데이터 통합** — `acceptable_tiers`의 "여유시 권역" 판정을 실제 `emris-data/devdocs/{hospitals,beds,messages}.json`로 구체화.
5. **지역별 병원 capability 매트릭스** — 행정 등급(권역/지역센터/지역기관) 대신 실제 Y코드 커버 능력 기반 추천.

### 운영 action items

- iCloud `.Trash/Pre-KTAS Research/`의 원본 CSV 영구 보존 필요. 30일 후 영구 삭제 위험. Finder → 최근 삭제된 항목 → Put Back.
