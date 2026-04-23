# Project Knowledge Graph

정본 Pre-KTAS 코드북 확보 phase (2026-04-23) 시점의 entities/relations/actions.

## Entities

| Entity | Type | Location | Description |
|---|---|---|---|
| Pre-KTAS Codebook Source CSV | raw-dataset | `data/raw/Pre-KTAS_codebook.csv` | **정본 Pre-KTAS 코드북 원본.** 4,689 entries, 9 columns (구분/분류코드/2단계_코드/2단계_명칭/3단계_코드/3단계_명칭/4단계_코드/4단계_명칭/중증도). iCloud .Trash에서 복구. |
| Pre-KTAS Codebook JSON | dataset | `data/prektas-codebook.json` | CSV 기반 정본 JSON v2.0.0. 4,689 entries, 17 level2 카테고리, adult 2,241 + pediatric 2,448. 모두 labeled (reserved 없음). |
| Codebook Schema | schema | `data/schemas/prektas-codebook.schema.json` | JSON Schema draft 2020-12 v2. reserved 필드 제거, if/then/else 삭제, level2/3/4 필수 객체. |
| Codebook Generator | script | `scripts/generate-prektas-codebook.mjs` | CSV → JSON 변환기. regex/eval 완전 제거. 헤더·코드·레벨 코드·등급 검증을 generator에서 수행. |
| Codebook Validator | script | `scripts/validate-prektas-codebook.mjs` | ajv + 무결성 + 충돌·이름 일관성 검증. whitelist 로직 폐지(항상 엄격). |
| KTAS Codebook CSV | external-dataset | `/Users/sjlee/Projects/prektas-research/KTAS_codebook.csv` | 4,349 KTAS 공식 코드표. 본 프로젝트 Pre-KTAS와는 **별개 taxonomy**. 향후 별도 JSON 정본화 대상. |
| KTAS↔Pre-KTAS Mapping CSV | external-dataset | `/Users/sjlee/Projects/prektas-research/KTAS_PreKTAS_mapping.csv` | 4,690 rows 매핑 테이블. meaning/broad/remap/approximate/unmappable + score. Pre-KTAS↔KTAS bridge. |
| Source Keypad HTML (deprecated) | external-source | `/Users/sjlee/Projects/prektas-research/prektas-input-keypad.html` | **더 이상 사용 안 함.** RECORDS_RAW는 KTAS 이름이 섞여 오염된 상태였음이 본 phase에서 확인됨. |
| Research Standalone HTML | artifact | `prektas-research-standalone.html` (untracked) | 이전 세션 산출물. 4,689 코드 인터랙티브 테스트기. |
| Research Report HTML | artifact | `prektas-research-report.html` (untracked) | 이전 세션 산출물. JSON 리포트 뷰어. |
| Evaluate Script | script | `scripts/evaluate-prektas-research.mjs` (untracked) | 기존 평가 스크립트. self-fulfilling 지표 문제 있음. |
| Research Standalone Builder | script | `scripts/build-prektas-research-standalone.mjs` (untracked) | 하드코딩 if/else 키워드 매칭으로 질환 후보 생성. |
| Research Report Builder | script | `scripts/build-prektas-report-html.mjs` (untracked) | JSON → HTML 얇은 템플릿. |

## Relations

| Subject | Relation | Object | Context |
|---|---|---|---|
| Codebook Generator | reads | Pre-KTAS Codebook Source CSV | 직접 CSV 파싱. regex/eval 없음 |
| Codebook Generator | writes | Pre-KTAS Codebook JSON | 검증 통과 시에만 출력 |
| Codebook Validator | validates | Pre-KTAS Codebook JSON | schema + 무결성 + 이름 일관성 |
| Codebook Validator | references | Codebook Schema | ajv로 compile |
| Pre-KTAS Codebook JSON | cross-refs | KTAS↔Pre-KTAS Mapping CSV | 같은 pre_code를 key로 공유 (아직 JSON화 안 됨) |
| KTAS↔Pre-KTAS Mapping CSV | maps to | KTAS Codebook CSV | 매핑의 ktas_code column |
| Research Standalone Builder | reads | Source Keypad HTML | 기존 방식: regex + `Function()` eval |
| Research Standalone Builder | reads | KTAS Codebook CSV | `ktasByCode` map으로 주입, 근거 텍스트용으로만 사용 |
| Research Standalone Builder | reads | KTAS↔Pre-KTAS Mapping CSV | mapping trust 계산에 사용 |
| Evaluate Script | reads | Research Standalone HTML | 문자열 `includes()`로 feature_checks 검사 (실질 검증 아님) |
| Evaluate Script | writes | `prektas-research-report.json` | 평가 결과 JSON |
| Research Report Builder | reads | `prektas-research-report.json` | → Research Report HTML |

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

## Next Phase Candidates
- 진짜 Pre-KTAS ↔ KTAS 관계 재분석: 매핑 CSV 기준으로 Pre-KTAS 2/3/4단계 ↔ KTAS 2/3/4단계의 대응 관계를 다시 봐야 함. 직전 분석은 오염된 데이터 기반이라 전면 재검토 필요.
- `scripts/build-prektas-research-standalone.mjs` 리팩터 — 정본 JSON 소비자로 전환. 키워드 매칭을 level2/3/4 name 기반 분기로 교체 가능성 검토.
- KTAS_codebook.csv, KTAS_PreKTAS_mapping.csv도 같은 정본화 프로세스(JSON + schema + validator) 적용.
- Evaluate Script의 self-fulfilling 로직 제거, 골든셋 기반 평가로 교체.
- iCloud .Trash의 원본 CSV 영구 보존 — 사용자가 .Trash에서 Put Back 필요 (30일 후 영구 삭제 위험).
