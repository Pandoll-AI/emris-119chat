# Changelog

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

