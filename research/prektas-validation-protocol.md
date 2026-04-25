# Pre-KTAS-기반 EMRIS 27 Y코드 매핑 알고리즘의 진단정확도 검증 프로토콜 v1.0

**Protocol ID**: PREKTAS-VAL-2026-001
**Version**: 1.0 (preregistered)
**Authors**: 본 프로젝트 maintainers
**Frozen at**: 2026-04-25 (commit hash 갱신 필요)

> 본 문서는 **사전 등록된(preregistered) 분석 계획**이다. 데이터 잠금(data lock) 이전에 작성·동결되며, 이후 수정 시 변경 이력을 남긴다. 본 연구의 결과 보고서는 본 protocol을 기준으로 사후 deviation을 명시해야 한다.

---

## 1. 배경 및 정당화 (Background & Rationale)

### 1.1 임상적 문제
119 구급대원은 현장에서 환자의 Pre-KTAS 5자(또는 변형) 코드와 추가 임상 정보를 토대로 환자의 중증도 및 자원 요구를 예측하여 적절한 응급의료기관(권역응급의료센터·지역응급의료센터·지역응급의료기관)으로 이송한다. 그러나 현재 한국 응급의료 체계에는 Pre-KTAS 코드 단일 입력으로부터 EMRIS 종합상황판이 모니터링하는 27개 중증응급질환(이하 **27 Y코드**)에 매핑하는 임상 검증된 알고리즘이 존재하지 않는다.

### 1.2 이전 단계 (Phase 1–7) 산출물
- 정본 Pre-KTAS 코드북 4,689 entry (`data/prektas-codebook.json`)
- v0.1 룰 기반 Pre-KTAS → Y코드 매핑 (`research/prektas-to-y-mapping.json`, 12 도메인 룰 + 13 질문 카탈로그)
- 권역/지역센터/지역기관 tier 추천 v1.1 (`research/prektas-tier-recommendation.json`)
- 챗봇 통합 + LLM 4임무 + follow-up 컨텍스트 + AI 폴백 제거(`index.html`)

### 1.3 미해결 임상 검증 공백
- v0.1 룰은 **키워드 휴리스틱**이며 임상 미검증
- 19% coverage(0–3 질문 내 매핑) 자체는 정확도 지표가 아니다. 실제 중증환자를 정확히 식별하는 능력(sensitivity)과 비중증을 정확히 거르는 능력(specificity)을 측정해야 한다.
- 응급의료센터 자원 배분 효율과 under-triage 위험의 균형은 **이항 진단정확도** 측정 없이 평가 불가.

### 1.4 본 연구의 위치
- Retrospective observational diagnostic accuracy study (STARD 2015 가이드라인 준수)
- 사전 등록된 분석 계획 + frozen reference standard + frozen index test
- 본 연구 자체는 알고리즘 임상 인증이 아니다. **baseline 측정과 v0.2 우선순위 도출**이 목적.

---

## 2. 연구 목적 (Objectives)

### 2.1 Primary objective
Pre-KTAS 5자 코드 + 0–3 추가 질문 시스템(이하 **Index test**)이 EMRIS 27 Y코드 해당 환자(중증응급)를 식별하는 **이항 진단정확도**를 측정한다.

### 2.2 Secondary objectives
- **다항 정확도**: 중증으로 식별된 환자에서 정확한 27 Y코드 분류 능력
- **Under-triage rate**: 실제 중증인데 시스템이 unmapped(중증 아님)으로 분류한 비율 (임상적 위해 가능)
- **Over-triage rate**: 실제 비중증인데 시스템이 중증으로 분류한 비율 (자원 낭비)
- **추가 질문의 한계효용**: 0/1/2/3 질문에 따른 sensitivity·specificity 증분
- **Tier 권고 정확도**: tier_strategy 권고가 실제 이송 종별 분포와 일치하는 정도

### 2.3 Tertiary objectives (탐색적)
- Pre-KTAS grade(1–5) ↔ 실제 중증 prevalence 상관
- 지역(17개 시도)·연령군(소아/성인) stratified 차이
- 의식상태(AVPU) 보조 입력의 정보 가치

---

## 3. 가설 (Hypotheses)

각 가설은 사전 등록된 임상적 의미 임계값(clinically meaningful threshold)을 정의한다.

| ID | 가설 | 주(primary)/부(secondary) | 임계값 (success) |
|---|---|---|---|
| H1 | Index test (≤3 질문)의 sensitivity ≥ 0.85 | primary | sensitivity 95% lower CI ≥ 0.85 |
| H2 | Index test (≤3 질문)의 specificity ≥ 0.90 | primary | specificity 95% lower CI ≥ 0.90 |
| H3 | 추가 질문 1개당 sensitivity 한계 증분 ≥ 0.03 (3 질문까지 누적) | secondary | paired McNemar p<0.05 + 효과크기 ≥0.03 |
| H4 | tier 권고와 실제 이송 종별 일치율 ≥ 0.70 | secondary | 일치율 95% lower CI ≥ 0.70 |
| H0 | 위 모든 임계값 통과 못함 | — | v0.2 개선 우선순위 도출 |

> Sensitivity·specificity 임계값(0.85·0.90)은 응급 분류(triage) 도구 평가의 통상 수치를 참고했으며, 임상자문 1인 검토 시 변경될 수 있다. 변경 시 본 protocol에 amendment로 기록한다.

---

## 4. 연구 설계 (Study Design)

### 4.1 설계 유형
- **Retrospective observational diagnostic accuracy study** (STARD 2015)
- Single index test, single reference standard, no follow-up beyond ED discharge
- No intervention. Algorithm v0.1 is **not yet used clinically.**

### 4.2 Index test (predictor)
- **Algorithm**: `scripts/research/build-prektas-to-y-mapping.mjs` at frozen commit (분석 시작 직전 SHA-256 기록)
- **Input**: `{ pre_code, grade, additional_qa[] }` from CSV columns
- **Output**: `{ y_candidates: Y코드 array, unmapped: bool, questions_used: int }`
- **Versioning**: v0.1 baseline. Phase 8h에서 v0.2 개선판 동시 평가.

### 4.3 Reference standard (ground truth)
- 퇴실진단 ICD-10 코드(`퇴실진단코드` 컬럼)을 사전 동결된 **Y코드 → ICD-10 cluster mapping**(Phase 8a 산출물 `research/y-code-icd10-clusters.json`)로 변환하여 per-visit Y코드 라벨 또는 "non-severe"로 binarize.
- ICD-10 cluster mapping은 분석 시작 전 응급의학 전문의 1인 자문 후 **frozen**.
- 한 visit이 다중 Y코드 후보에 해당하면 first-listed Y코드를 기본 라벨로 하되, multi-label sensitivity 분석을 별도 보고.

### 4.4 Setting & sample
- **Source**: `/Users/sjlee/Projects/prektas-research/source-prektas.csv` (48 MB, EUC-KR encoding)
- **Total N**: 225,017 ED visits (1차 스캔 결과)
- **Time period**: 2025년 ~ 2026년 초 (period 컬럼 분포: 2025=155,830 / 2026=25,996 / 비공란=43,191)
- **Geographic coverage**: 17개 시도 (실측 분포는 Phase 8b에서 보고)
- **Privacy**: 환자등록번호 partial masking (`**...`) — 추가 익명화는 Phase 8b에서

### 4.5 Inclusion / Exclusion

#### Inclusion criteria
- `네디스매칭여부` = "매칭" (퇴실진단 ICD-10 존재) — **99.2% (223,115/225,017)**
- `최초KTAS분류과정` 비공란 (Pre-KTAS 5자 코드 부여)
- `퇴실진단코드` 비공란 (ICD-10 ground truth 사용 가능)
- `PRE_KTAS` 1-5 중 하나 부여

#### Exclusion criteria
- 비매칭 (퇴실진단 결측, ~0.8%)
- Pre-KTAS 코드가 정본 4,689 set에 없음 (오타/deprecated/지역 변형)
- 퇴실진단 다중 코드 중 첫 코드만 기록되어 sensitivity 평가 곤란한 케이스 — 주분석에서 다중 라벨 적용

### 4.6 데이터 정합성 우선 과제 (Phase 8a 사전 작업)

> ⚠️ **중요 발견**: 1차 스캔 결과 본 프로젝트의 Pre-KTAS 코드북은 5자 (예: `CAAAA`, group prefix C/D) 형식이지만, 실측 CSV의 `최초KTAS분류과정` 컬럼은 6자 (예: `AIACA0`, A prefix 175,237/225,017 = 77.9%) 형식이다. 두 코드 체계의 **정렬 매핑(crosswalk)**이 분석 전제 조건이다.

#### 가설 (검증 필요)
- 한국형 Pre-KTAS는 v1.x ↔ v2.x 사이에 코딩 체계 변경이 있었거나, 행정용 6자 vs 임상용 5자 두 표기가 공존
- 정본 codebook의 5자 코드와 실측 CSV의 6자 코드는 동일 임상 카테고리에 대응할 가능성

#### Phase 8a-1 산출물
- `research/prektas-code-crosswalk.json` — 5자 ↔ 6자 매핑(가능한 경우 1:1, 그 외 1:N 또는 unmapped)
- 매핑 실패 코드의 비율 + 분포 보고
- 매핑 실패 케이스가 표본의 ≥10%이면 본 연구 inclusion에서 별도 처리 + sensitivity 분석

---

## 5. 데이터 사전(data dictionary)

### 5.1 Source CSV column dictionary

| Column | Type | Role | Notes |
|---|---|---|---|
| 지역 | string | stratification | 17 시도 |
| 구급보고서번호 | string | unique ID | per-visit |
| PRE_KTAS | string | predictor (grade) | "Pre-KTAS 1"~"Pre-KTAS 5" → 정수화 |
| 연령 | int | stratification | years |
| 의식상태 | string | predictor (optional) | A/V/P/U |
| 종별 | string | secondary outcome | 권역/지역센터/지역기관 |
| 퇴실진단코드 | string | **reference standard** | ICD-10 |
| 응급진료결과 | string | secondary outcome | 입원/퇴원/사망/전원 |
| 최초KTAS | int | benchmark | 병원 시점 KTAS 1-5 |
| 최초KTAS분류과정 | string | **predictor (pre_code)** | 5자 또는 6자 |
| 내원경로 | string | descriptive | 1=119, 2=자력 등 |
| 전원보낼·받은 | string | exclusion flag | 전원은 sensitivity 분석 |
| 내원일시·퇴실일시 | datetime | descriptive | ED LOS 계산 가능 |

### 5.2 Y-code → ICD-10 cluster (Phase 8a 산출 예정 — 자문 전 초안)

| Y-code | 본 연구 ICD-10 cluster (초안) | 임상 자문 항목 |
|---|---|---|
| Y0010 심근경색 재관류 | I21.x, I22.x | STEMI/NSTEMI 모두 포함 여부 |
| Y0020 뇌경색 재관류 | I63.x | 24시간 내 재관류 적응 기준 |
| Y0031 거미막하 출혈 | I60.x | 외상성 vs 자발성 |
| Y0032 뇌출혈 (거미막하 외) | I61.x, I62.x (외상성 제외 S06.x은 별도) | 외상성 두개내 출혈 처리 |
| Y0041 흉부 대동맥 응급 | I71.0, I71.1, I71.2 | acute aortic syndrome 포함 |
| Y0042 복부 대동맥 응급 | I71.3, I71.4, I71.5, I71.6, I71.8, I71.9 | rupture vs dissection split |
| Y0051 담낭질환 | K80.x, K81.x | acute cholecystitis 한정 vs 전체 |
| Y0052 담도질환 | K82.x, K83.x | cholangitis acute |
| Y0060 복부 응급수술(비외상) | K35.x (충수염), K56.x (장폐색), K65.x (복막염) 등 | 시술 적응 기준 |
| Y0070 장중첩/폐색(영유아) | K56.x + age <5 | |
| Y0081/0082 위장관 응급내시경 | K92.0, K92.1, K92.2 (출혈) + age | 내시경 적응 기준 |
| Y0091/0092 기관지 응급내시경 | T17.x (기도 이물) + age | |
| Y0100 저체중출생아 | P07.x | |
| Y0111 분만 | O80.x, O81.x, O82.x, O83.x, O84.x | |
| Y0112 산과수술 | O00–O08, O60–O75 | |
| Y0113 부인과수술 | N80–N98 응급 | |
| Y0120 중증화상 | T20–T31 (BSA·grade 기준) | grade 임계 |
| Y0131 수지접합 | S68.x | |
| Y0132 사지접합 | S48.x, S58.x, S78.x, S88.x | |
| Y0141/0142 응급투석 | N17 (AKI), N19, T39.x 일부 | HD vs CRRT 임상 기준 |
| Y0150 정신과 응급입원 | F00–F99 (긴급) | 자해·타해 위험 |
| Y0160 안과 응급수술 | H44 (안내염), H40.2 (급성녹내장), S05 (외상) | |
| Y0171/0172 영상 혈관중재 | I72, I74 등 + age | |

> 위 ICD-10 cluster는 본 protocol 작성 시점 초안이며 **응급의학 전문의 1인 자문 후 final frozen**한다. Final 매핑은 `research/y-code-icd10-clusters.json`에 commit된다.

### 5.3 사전 prevalence 추정 (1차 ICD-10 prefix scan)

| Y-code 후보 | ICD-10 prefix | 추정 N | 추정 prevalence |
|---|---|---:|---:|
| Y0010 (심근경색) | I21, I22 | 987 | 0.44% |
| Y0020 (뇌경색) | I63 | 3,378 | 1.50% |
| Y0031 (거미막하) | I60 | 512 | 0.23% |
| Y0032 (뇌출혈) | I61, I62 | 1,415 | 0.63% |
| Y0041/0042 (대동맥) | I71 | 175 | 0.08% |
| Y005x (담낭담관) | K80–K83 | 1,495 | 0.66% |
| Y0060 (복부응급) | K35, K40, K56, K65, K83, K85 | 2,087 | 0.93% |
| Y0111-3 (산부인과) | O | 161 | 0.07% |
| Y0120 (화상) | T20–T31 일부 | 348 | 0.15% |
| **샘플 소계 (overlap 무시)** | — | **~10,500** | **~4.7%** |

> 본 prevalence는 ICD-10 prefix만 기준한 1차 추정이다. Final 라벨링은 §5.2 frozen cluster 적용 후 다시 산출한다.

---

## 6. 분석 계획 (Pre-specified Analysis Plan)

### 6.1 Primary analysis — H1, H2

**Outcome**: 이항 변환 (Y라벨 ≠ none vs Y라벨 = none)

**Index test 출력 binarize**:
- `mapped` = predicted Y_candidates 중 1개 이상 ground truth Y와 일치 → True positive
- `mapped` = Y_candidates ≠ ∅ but no overlap with ground truth → False positive
- `unmapped` = Y_candidates = ∅ but ground truth has Y → False negative
- `unmapped` = Y_candidates = ∅ and ground truth = none → True negative

**Computed metrics** (95% Wilson CI):
- Sensitivity = TP / (TP + FN)
- Specificity = TN / (TN + FP)
- PPV = TP / (TP + FP)
- NPV = TN / (TN + FN)
- F1 = 2·PPV·Sens / (PPV + Sens)
- Cohen's κ
- Balanced accuracy = (Sensitivity + Specificity) / 2

**Decision rule for H1·H2**:
- Both `Sensitivity 95% lower CI ≥ 0.85` AND `Specificity 95% lower CI ≥ 0.90` → H1·H2 통과
- 둘 중 하나라도 미달 → H0 채택, v0.2 개선 우선순위 도출

### 6.2 Secondary analyses

#### 6.2.1 다항 정확도 (per-Y-code)
- 27 Y + 1 unmapped = 28-class confusion matrix
- per-class precision, recall, F1
- macro-F1, weighted-F1
- Top-3 accuracy (predicted Y_candidates 안에 ground truth Y 포함 비율)

#### 6.2.2 한계효용 (H3)
시나리오 4종을 동일 표본에 적용:
- (a) 0 질문 — pre_code + grade만 사용
- (b) 1 질문 — 알고리즘이 첫 질문만 적용
- (c) 2 질문
- (d) 3 질문 (≤3 적용 시나리오)

각 시나리오별 sensitivity 측정 + paired McNemar's test:
- (a) vs (b), (b) vs (c), (c) vs (d)
- p < 0.05 + 효과크기 ≥ 0.03 → H3 통과

> 추가 질문 답변은 실제 CSV에 없다. 시뮬레이션 정책: ground truth Y가 분기 룰의 어느 분기에 해당하는지 ICD-10 cluster로부터 결정론적으로 도출. 답변 시뮬레이션은 ground truth와 같은 임상 정보를 사용하므로 **best-case** 한계효용을 측정함을 명시.

#### 6.2.3 운영 정확도 (H4)
- tier_strategy 권고 (`regional_only`, `regional_or_local_center`, `local_center_preferred`, `local_institution_preferred`)
- 실제 이송 종별 (`종별` 컬럼)
- 일치 정의: tier_strategy의 `acceptable` 집합에 실제 종별 포함 → 일치
- 일치율 95% Wilson CI 하한 ≥ 0.70 → H4 통과

### 6.3 Stratified analyses
다음 sub-group별로 §6.1 metrics 재계산:
- 지역 (17개 시도)
- 연령군 (소아 < 18 vs 성인 ≥ 18 vs 65+)
- Pre-KTAS grade (1, 2, 3, 4, 5)
- 의식상태 (A, V, P, U)
- 종별 (권역응급의료센터, 지역응급의료센터, 지역응급의료기관)
- 시간대 (주간/야간), 요일 (평일/주말)

각 stratum N < 30이면 보고만 하고 hypothesis test 미수행.

### 6.4 Sensitivity analyses
- ICD-10 → Y cluster의 inclusive vs strict 정의 (예: Y0010에 NSTEMI 포함 여부) 둘 모두 보고
- 결측 처리: complete case analysis vs multiple imputation (chained equations)
- 다중 ICD-10 라벨 케이스: first-listed vs any-match
- 정본 codebook 매핑 실패 코드(§4.6) exclude vs lenient inclusion
- Bootstrap 1000 (seed=20260425) — primary metric CI 안정성

### 6.5 Operational outcomes (탐색적)
- 권역 권고 환자 중 실제 권역 도착 비율
- 권역 미권고 환자 중 사망/입원/전원 비율 (under-triage 임상 위해 추정)
- ED LOS (입원 환자 한정)
- 응급진료결과(사망/입원/퇴원/전원) 분포 by predicted vs actual

### 6.6 표본 크기 정당화

- Sensitivity 0.85 ± 0.01 (95% CI 폭 ≤ 0.02) 추정에 필요한 true positive ≈ 4,900 (Wilson CI 폭 공식)
- 추정 prevalence 5%, 총 N = 225,017 → 예상 true positive ≈ 11,250
- 실제 가용 N (인원·기간 결측 제거 후) ≈ 200,000
- 따라서 primary endpoint에 대해 95% CI 폭 ≤ 0.015 달성 예상

> Statistical power analysis는 H0(특정 효과 검출) 검정이 아니므로 별도 미수행. CI 폭 기반 정밀도 정당화로 충분하다고 판단.

---

## 7. 타당성 위협 및 완화 (Threats to Validity)

| Threat | Direction | Mitigation |
|---|---|---|
| 퇴실진단 ICD-10은 hindsight, 현장 시점 정보 아님 | Sensitivity 과소평가 가능 | "확정 진단" sub-group(입원/사망 ICD-10) 별도 분석. 차이를 sensitivity analysis로 보고. |
| ICD-10 → Y-code 매핑의 임의성 | spurious accuracy 양방향 | 응급의학 전문의 1인 자문 + inclusive/strict 두 정의 병행 보고 |
| Pre-KTAS 코드 5자/6자 정합성 (§4.6) | Index test 적용 불가 영역 발생 | Phase 8a-1 crosswalk 우선 작성. crosswalk 실패율 보고 + 별도 sensitivity 분석. |
| 결측 (네디스매칭 X) | Selection bias (1.7%) | 매칭 vs 비매칭 baseline 비교. 영향 미미 예상. |
| 표본 지역·기간 편향 | 외부 일반화 한계 | 지역 stratified analysis 명시. 단일 cohort 한계는 limitation에 명시. |
| 추가 질문 답변 시뮬레이션 인공성 | best-case 과대추정 | 0 질문 시나리오를 "lower bound"로 보고. |
| 알고리즘 v0.1 키워드 의존 | 코드북 텍스트 변형 fragility | 사전 동결 commit hash. 결과 fully reproducible. |
| 다중 ICD-10 라벨 우선순위 | label 모호성 | first-listed primary + any-match sensitivity 둘 보고 |
| 응급의학 전문의 1인 자문 한계 | mapping 신뢰도 | 자문 1차 후 추가 1인 검토 (가능 시) + inter-rater agreement 보고 |
| 시간 변화(seasonal/COVID 후 행태 변화) | confounder | period stratified (분기별) sub-analysis |

---

## 8. 실행 계획 (Phase 8 sub-phases)

| # | Subphase | 산출물 | 담당 | 예상 기간 |
|---|---|---|---|---:|
| 8a-1 | Pre-KTAS 코드 crosswalk (5자 ↔ 6자) | `research/prektas-code-crosswalk.json` + 보고서 | 본 maintainer | 1주 |
| 8a-2 | Y-code → ICD-10 cluster frozen mapping | `research/y-code-icd10-clusters.json` + 자문 기록 | 응급의학 전문의 1인 + maintainer | 1–2주 |
| 8b | source-prektas.csv 표준화 | `data/derived/visits.parquet` (UTF-8, 정규화, hash) + `scripts/research/build-visits-dataset.mjs` | 본 maintainer | 3일 |
| 8c | Per-visit ground truth 라벨링 | `data/derived/visits-with-yref.parquet` + label distribution report | 본 maintainer | 2일 |
| 8d | Index test 적용 (4 시나리오) | `data/derived/visits-with-prediction-q{0..3}.parquet` + version metadata | 본 maintainer | 3일 |
| 8e | Confusion matrix + primary/secondary metrics + bootstrap | `research/validation-results-v0.1.json` + figures | 본 maintainer | 1주 |
| 8f | Stratified + sensitivity analyses | `research/validation-stratified.json` | 본 maintainer | 1주 |
| 8g | Error taxonomy: top 100 false negative case audit | `research/error-audit-v0.1.md` | 응급의학 전문의 + maintainer | 1–2주 |
| 8h | v0.2 룰 개선 (8e–g 실패 시) | `scripts/research/build-prektas-to-y-mapping.mjs` v0.2 + 동일 평가 재실행 | 본 maintainer | 2주 |
| 8i | 최종 보고서 + figures + supplementary tables | `research/prektas-validation-report-v1.0.md` + Figure 1-N + Supplementary | 본 maintainer | 1주 |
| 8j | 재현성 패키지 + 학회/논문 초안 | `research/replication/` + manuscript draft | maintainer | 2–4주 |

> **순차 의존성**: 8a → 8b → 8c → 8d → (8e + 8f) → 8g → 8h(조건부) → 8i → 8j.
> **동시 실행 가능**: 8e와 8f, 8g 일부.

---

## 9. 재현성 (Reproducibility)

### 9.1 Code freeze
- Index test: `scripts/research/build-prektas-to-y-mapping.mjs` at commit hash `<TBD at study start>`
- Tier recommendation: `scripts/research/build-prektas-tier-recommendation.mjs` at same commit
- 분석 스크립트: `scripts/research/validate-phase8.mjs` (신규, Phase 8d–f 통합 실행)

### 9.2 Data freeze
- `data/raw/Pre-KTAS_codebook.csv` SHA-256: `d75b39170fb4aa5a40051cdfb4cb1ff843a17764e6ffddf99527a56751d1061f` (이미 commit)
- `source-prektas.csv` SHA-256: `<TBD — Phase 8b 작성 시>` (외부 경로, 본 repo에는 hash만 commit)

### 9.3 Random seeds
- Bootstrap: `seed=20260425`
- Train/test split (있다면): `seed=20260425`

### 9.4 Re-run command
```bash
npm run validate:phase8       # 신규 스크립트 (Phase 8b 시 추가)
```

### 9.5 Output 공개
- 익명화된 per-Y-code metrics는 `research/validation-results-v0.1.json`로 commit
- Per-visit 결과는 환자 식별 위험으로 commit 금지. 통계 요약만 공개.

---

## 10. 윤리 및 IRB (Ethics)

- Retrospective observational study, **anonymized data** (환자등록번호 마스킹).
- 본 연구는 **이미 비식별화된 기존 데이터**를 사용한 후향적 분석으로 IRB 면제 사유에 해당할 수 있다.
- 학술 발표·출판 시점에 별도 IRB 승인을 진행한다 (사전심의 권장).
- 데이터 공유: 원시 CSV는 환자 식별 위험으로 비공개. 통계 요약 + 코드만 공개.
- **No intervention**. Algorithm은 본 연구 시점 임상 미사용.

---

## 11. 명시된 한계 (a priori Limitations)

1. **단일 cohort, retrospective**: prospective validation 부재. 외부 데이터 일반화는 향후 phase.
2. **ICD-10 reference standard imperfection**: Y코드는 시술·자원 정의이지 진단 정의가 아니다. ICD-10 → Y cluster는 임상 자문 1인 기반 근사.
3. **Pre-KTAS 코드 부여의 inter-rater reliability**는 본 연구 범위 외. 구급대원이 동일 환자에 동일 코드를 부여하는지는 별도 연구가 필요하다.
4. **알고리즘 v0.1은 키워드 휴리스틱**이며 임상 검증 전이다. 본 연구는 **baseline 측정**이며 알고리즘 임상 인증이 아니다.
5. **산부인과·정신과·안과 카테고리는 알려진 over-inclusion** (v0.1 §5-3). v0.2에서 우선 개선 대상.
6. **추가 질문 답변 시뮬레이션은 best-case**다. 실제 구급 현장에서 답변 정확도는 별도 측정 필요.
7. **시간 변동성**: 2025–2026 데이터, 계절·코로나 후 변화 가능. period sub-analysis로 부분 완화.

---

## 12. 성공 기준 정의 (Definition of Success)

| 결과 | 의미 | 후속 조치 |
|---|---|---|
| H1·H2·H3·H4 모두 통과 | v0.1 algorithm이 사전 정의한 정확도 임계값 충족 | v0.1 freeze + prospective external validation phase 9 진입 |
| H1·H2 통과, H3 또는 H4 미통과 | 정확도는 충분, 한계효용/운영 정확도 개선 여지 | 질문 트리 또는 tier rule v1.2 개선 |
| H1 미통과 (sensitivity 부족) | under-triage 위험 — 임상 활용 불가 | v0.2 우선순위: false negative top 100 audit → rule gap fill (예상: §5-4 임신/대동맥/외상 보강) |
| H2 미통과 (specificity 부족) | over-triage — 권역 자원 낭비 | v0.2 우선순위: 카테고리 over-inclusion 제거 (눈/정신/산부인과 pre-filter) |
| **모든 케이스**: under-triage 절대수 보고 | **윤리적 우선순위** | 어느 시나리오든 under-triage 임상 사례 100건 audit은 의무 |

---

## 13. Protocol 변경 절차 (Amendment Procedure)

- 본 protocol의 모든 변경은 commit 단위로 본 파일에 amendment 섹션을 추가하여 기록한다.
- 데이터 잠금(8c 완료) 이후의 변경은 **post-hoc**으로 명시.
- Sensitivity analyses는 사전 등록되었으므로 post-hoc이 아니다.

---

## 14. 참고문헌 (References)

1. Bossuyt PM, Reitsma JB, Bruns DE, et al. **STARD 2015**: An Updated List of Essential Items for Reporting Diagnostic Accuracy Studies. *BMJ*. 2015;351:h5527.
2. 한국응급의학회. *한국형 응급환자 분류도구 KTAS 가이드라인*.
3. EMRIS 종합상황판 운영 매뉴얼. 중앙응급의료센터.
4. Cohen J. A coefficient of agreement for nominal scales. *Educ Psychol Meas*. 1960.
5. Wilson EB. Probable inference, the law of succession, and statistical inference. *J Am Stat Assoc*. 1927.

---

## 15. 부록 (Appendix)

### A. 약어 (Abbreviations)
- EMRIS: 중앙응급의료센터 종합상황판
- KTAS: 한국형 응급환자 분류도구
- Pre-KTAS: 119 구급대원용 사전 분류
- ICD-10: International Classification of Diseases, 10th Revision
- ED: Emergency Department
- LOS: Length of Stay
- AVPU: Alert/Verbal/Pain/Unresponsive (의식상태 4단계)
- PPV: Positive Predictive Value
- NPV: Negative Predictive Value
- CI: Confidence Interval

### B. Phase 8 산출물 위치 (예정)
```
research/
├── prektas-code-crosswalk.json           (Phase 8a-1)
├── y-code-icd10-clusters.json            (Phase 8a-2)
├── validation-results-v0.1.json          (Phase 8e)
├── validation-stratified.json            (Phase 8f)
├── error-audit-v0.1.md                   (Phase 8g)
├── prektas-validation-report-v1.0.md     (Phase 8i)
└── replication/                          (Phase 8j)
    ├── README.md
    ├── data-hash.txt
    └── run.sh

data/derived/                              (gitignored, hash만 commit)
├── visits.parquet                         (Phase 8b)
├── visits-with-yref.parquet               (Phase 8c)
├── visits-with-prediction-q0.parquet      (Phase 8d)
├── visits-with-prediction-q1.parquet      (Phase 8d)
├── visits-with-prediction-q2.parquet      (Phase 8d)
└── visits-with-prediction-q3.parquet      (Phase 8d)

scripts/research/
└── validate-phase8.mjs                    (Phase 8b–f, 신규)
```

---

*Protocol v1.0 frozen: 2026-04-25 — 본 문서는 사전 등록된 분석 계획의 단일 source of truth이다.*
