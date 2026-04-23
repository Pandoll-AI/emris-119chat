# Project Knowledge Graph

Pre-KTAS 코드북 정본화 phase (2026-04-23) 시점의 entities/relations/actions.

## Entities

| Entity | Type | Location | Description |
|---|---|---|---|
| Pre-KTAS Codebook | dataset | `data/prektas-codebook.json` | 4,689 Pre-KTAS 코드의 정본 JSON. group(성인/소아) + 2/3/4단계 코드·이름 + 등급. |
| Codebook Schema | schema | `data/schemas/prektas-codebook.schema.json` | JSON Schema draft 2020-12. 코드 형식·enum·reserved↔null 동기 조건 강제. |
| Allowed Collisions | config | `data/codebook-allowed-collisions.json` | level2·3 이름 충돌 whitelist. K/L 산부인과/비뇨기과 4건 등록. |
| Codebook Generator | script | `scripts/generate-prektas-codebook.mjs` | keypad.html → JSON 변환기. SHA-256으로 소스 무결성 기록. |
| Codebook Validator | script | `scripts/validate-prektas-codebook.mjs` | ajv + 무결성 체크 + 충돌 분류. `--strict`로 gate 역할. |
| KTAS Codebook CSV | external-dataset | `/Users/sjlee/Projects/prektas-research/KTAS_codebook.csv` | 4,349 KTAS 공식 코드표. 아직 JSON 정본화 안 됨. |
| KTAS↔Pre-KTAS Mapping CSV | external-dataset | `/Users/sjlee/Projects/prektas-research/KTAS_PreKTAS_mapping.csv` | 4,690 rows 매핑 테이블. meaning/broad/remap/approximate/unmappable + score. |
| Source Keypad HTML | external-source | `/Users/sjlee/Projects/prektas-research/prektas-input-keypad.html` | Pre-KTAS RECORDS_RAW의 원본. 다른 프로젝트에 embed되어 있음. |
| Research Standalone HTML | artifact | `prektas-research-standalone.html` (untracked) | 이전 세션 산출물. 4,689 코드 인터랙티브 테스트기. |
| Research Report HTML | artifact | `prektas-research-report.html` (untracked) | 이전 세션 산출물. JSON 리포트 뷰어. |
| Evaluate Script | script | `scripts/evaluate-prektas-research.mjs` (untracked) | 기존 평가 스크립트. self-fulfilling 지표 문제 있음. |
| Research Standalone Builder | script | `scripts/build-prektas-research-standalone.mjs` (untracked) | 하드코딩 if/else 키워드 매칭으로 질환 후보 생성. |
| Research Report Builder | script | `scripts/build-prektas-report-html.mjs` (untracked) | JSON → HTML 얇은 템플릿. |

## Relations

| Subject | Relation | Object | Context |
|---|---|---|---|
| Codebook Generator | reads | Source Keypad HTML | regex + `JSON.parse`로 RECORDS_RAW 추출 |
| Codebook Generator | writes | Pre-KTAS Codebook | 정본 JSON 출력 |
| Codebook Validator | validates | Pre-KTAS Codebook | schema + 무결성 |
| Codebook Validator | references | Codebook Schema | ajv로 compile |
| Codebook Validator | references | Allowed Collisions | `--strict` 모드에서 대조 |
| Pre-KTAS Codebook | cross-refs | KTAS↔Pre-KTAS Mapping CSV | 같은 pre_code를 key로 공유 (아직 JSON화 안 됨) |
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
| 2026-04-23 | commit | claude | 865d9f6 | `feat: Pre-KTAS 코드북 JSON 정본 및 스키마 검증 파이프라인 구축` (7 files, +83,925 lines). |

## Next Phase Candidates
- 35개 level3 충돌 건별 심사 → whitelist 확장 또는 source data 수정
- KTAS Codebook CSV + Mapping CSV도 같은 방식 JSON 정본화
- `scripts/build-prektas-research-standalone.mjs`를 정본 JSON 소비자로 리팩터 (regex 추출 제거)
- Evaluate Script의 self-fulfilling 로직 제거, 골든셋 기반 평가로 교체
- Generator 소스 경로 환경변수화 (`PREKTAS_SOURCE_PATH`)
