# Changelog

## [2026-04-23] Phase: Pre-KTAS 코드북 JSON 정본화 및 스키마 검증

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

