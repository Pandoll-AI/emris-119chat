# Pre-KTAS → EMRIS 27 Y코드 매핑 알고리즘 v0.1 진단정확도 검증 보고서 v1.0

**Protocol**: PREKTAS-VAL-2026-001 v1.1
**Algorithm**: v0.1 (commit `f396343`)
**Reference standard**: `research/y-code-icd10-clusters.json` v1.0 (frozen 2026-04-26, 응급의학 전문의 1인 자문)
**Analysis date**: 2026-04-26
**Cohort**: source-prektas.csv (광주·전남·전북 ED 방문, 2025–2026)

---

## Executive Summary

> **본 v0.1 알고리즘은 한국 EM baseline 임계값(sens·spec ≥ 0.80)에서 H1(sensitivity)을 통과하지 못했다.**
>
> Sensitivity = **0.394** (95% CI 0.386–0.401) — 60.6%의 중증응급환자가 시스템에서 unmapped로 처리된다.
> Specificity = **0.808** (95% CI 0.805–0.810) — 비중증 식별은 baseline 통과.
>
> 추가 질문 oracle best-case 시뮬레이션도 sensitivity 증분 0.000 — 한계효용 가설 H3도 미달.
> v0.1은 **rule gap**이 핵심 문제. 후보(candidates) 자체에 정답 Y코드가 부재하므로 질문으로 좁힐 여지가 없다.
>
> **임상 활용 불가** 판정. v0.2 개선 필수. 우선순위는 §6 권고를 따른다.

---

## 1. Sample

| 항목 | 수 | 비율 |
|---|---:|---:|
| Total CSV rows | 225,017 | 100.0% |
| 네디스매칭 (`매칭`) | 179,924 | 79.9% |
| **Included (모든 inclusion criteria 통과)** | **130,536** | **58.0%** |
| 제외 — unmatched | 44,996 | 20.0% |
| 제외 — 코드 형식·suffix 불명 | 16,395 | 7.3% |
| 제외 — codebook 부재 | 6,541 | 2.9% |
| 제외 — 진단 결측 | 26,549 | 11.8% |

**Severe Y-code prevalence (included)**: **11.19%** (14,610 / 130,536)
- Phase 8 1차 ICD-10 prefix 추정 4.7%보다 높음 — frozen cluster 적용 + multi-label 확장 효과

---

## 2. Primary Endpoint Results

### 2.1 이항 진단정확도 (q0, no questions)

| 지표 | 값 | 95% Wilson CI |
|---|---:|---|
| **Sensitivity** | **0.3935** | **[0.3856, 0.4014]** |
| **Specificity** | **0.8077** | **[0.8054, 0.8099]** |
| PPV | 0.2049 | — |
| NPV | 0.9136 | — |
| F1 | 0.2695 | — |
| Balanced Accuracy | 0.6006 | — |
| Cohen's κ | 0.1626 | — |

### 2.2 가설 검정 (Protocol v1.1 임계값)

| 가설 | 임계 | 95% lower CI | 결과 |
|---|---:|---:|---|
| **H1 Sensitivity ≥ 0.80** | 0.80 | 0.3856 | ❌ **FAIL** |
| **H2 Specificity ≥ 0.80** | 0.80 | 0.8054 | ✅ **PASS** |
| H3 한계효용 ≥ 0.05/질문 | 0.05 | +0.0000 | ❌ **FAIL** (oracle vs q0) |
| H4 Tier 일치율 ≥ 0.80 | 0.80 | 미측정 | (별도 분석 권고) |

### 2.3 Oracle (best-case) 시뮬레이션

q_oracle 시뮬레이션 (정답 Y코드가 candidates에 있으면 정답 도달 가정):
- Sensitivity: **0.3935** (q0와 동일)
- Marginal gain: **+0.0000**

**해석**: v0.1 룰의 sensitivity 한계는 "질문이 정답을 좁히지 못해서"가 아니라 **"candidates 자체가 정답을 포함하지 않아서"**다. 즉 rule coverage gap이 본질 문제이며 추가 질문으로 해결되지 않는다.

---

## 3. Per-Y-code Performance (Top by support)

| Y-code | Support | Precision | Recall | F1 | Note |
|---|---:|---:|---:|---:|---|
| Y0020 뇌경색 | 3,258 | 0.212 | **0.694** | 0.325 | recall 양호, over-prediction |
| Y0081 위장관내시경(성인) | 1,723 | 0.408 | 0.525 | 0.459 | 균형 |
| **Y0141 응급HD** | **1,703** | **0.000** | **0.000** | **0.000** | **rule absent** |
| **Y0060 복부응급수술** | **1,615** | **0.000** | **0.000** | **0.000** | **rule gap** |
| **Y0142 CRRT** | **1,598** | **0.000** | **0.000** | **0.000** | **rule absent** |
| Y0082 위장관내시경(영유아) | 1,485 | 0.474 | 0.179 | 0.260 | recall 부족 |
| Y0032 뇌출혈 | 1,336 | 0.058 | **0.794** | 0.108 | recall 우수, **massive over-prediction** |
| Y0010 심근경색 | 920 | 0.093 | 0.642 | 0.163 | over-prediction |
| **Y0051 담낭질환** | **584** | **0.000** | **0.000** | **0.000** | **rule absent** |
| Y0052 담도질환 | 732 | 0.049 | 0.003 | 0.005 | rule near-absent |
| Y0031 거미막하출혈 | 471 | 0.028 | 0.586 | 0.054 | over-prediction |
| **Y0120 중증화상** | 151 | **0.511** | **0.735** | **0.603** | **best-performing** |
| Y0113 부인과수술 | 118 | 0.433 | 0.576 | 0.494 | 균형 |
| Y0041 흉부대동맥 | 128 | 0.011 | 0.523 | 0.021 | over-prediction |

**Macro F1**: 0.141 / **Weighted F1**: 0.166

### 3.1 Y-code 분류

- **Rule absent (recall 0)**: Y0141, Y0142, Y0060, Y0051 — v0.1에 적응 룰 부재
- **Recall < 0.20**: Y0082, Y0052 — rule 일부 존재하나 catch 부족
- **Over-prediction (precision < 0.10)**: Y0032, Y0010, Y0031, Y0041 — 광범위 trigger
- **Best**: Y0120 (F1 0.60), Y0113 (F1 0.49) — 화상·부인과는 ICD-10 ↔ 룰 정합 양호

---

## 4. Stratified Analyses

### 4.1 By region (top by N)

| 지역 | N | Sensitivity | Specificity |
|---|---:|---:|---:|
| 전북 | 53,174 | 0.369 | 0.800 |
| 전남 | 49,439 | 0.402 | 0.817 |
| 광주 | 27,923 | 0.426 | 0.807 |

지역별 sensitivity 차이 ≈ 5%p — 코호트 내 일관 (다만 본 cohort는 광주·전남·전북에 편중, 전국 일반화 한계).

### 4.2 By age group

| 연령군 | N | Sensitivity | Specificity |
|---|---:|---:|---:|
| Elderly 65+ | 78,643 | 0.387 | 0.816 |
| Adult 18–64 | 50,286 | 0.412 | 0.794 |
| Adolescent 12–17 | 1,577 | 0.125 | 0.845 |
| Pediatric <12 | 23 | 0.000 | 0.783 |

소아 표본 매우 작음 (총 1,600). 청소년·소아 sensitivity 0.13/0.00은 v0.1이 소아 적응을 거의 catch 못한다는 경고.

### 4.3 By Pre-KTAS grade

| Grade | N | Sensitivity | Specificity |
|---|---:|---:|---:|
| 1 (소생) | 6,129 | **0.185** | 0.906 |
| 2 (긴급) | 42,342 | 0.342 | 0.768 |
| 3 (응급) | 65,388 | 0.447 | 0.797 |
| 4 (준응급) | 10,971 | 0.421 | 0.883 |
| 5 (비응급) | 5,706 | 0.133 | 0.954 |

**Grade 1 sensitivity 18.5%가 가장 우려**. 가장 위급한 환자의 80%가 unmapped — Phase 3 v0.1 보고서 §5-1에서 지적된 "Pre-KTAS 중증의 대부분이 EMRIS 27 Y코드 외" 가설이 실측 확인됨. 다만 이 해석에는 두 가지 의미가 공존:

1. **체계 차이 (의도된 결과)**: Grade 1 환자 중 일부는 27 Y코드 외 적응 (예: 패혈증 쇼크, 약물 중독). v0.1 unmapped가 정답.
2. **Rule gap (개선 필요)**: Grade 1 환자 중 Y0141/Y0142/Y0060 등이 현재 룰 부재로 catch 안 됨.

§6 권고가 후자를 우선 다룬다.

---

## 5. Top Error Patterns

### 5.1 Top FN (under-triage)

| Level2 | Ground truth Y | Count | 의미 |
|---|---|---:|---|
| 소화기계 | **Y0060 복부응급수술** | 1,349 | 룰 부재 |
| 신경계 | Y0020 뇌경색 | 661 | 추가 catch 필요 |
| 신경계 | Y0142 CRRT | 419 | 신경계 환자의 AKI·sepsis CRRT 적응 부재 |
| 심혈관계 | Y0141 응급HD | 387 | 심혈관 환자의 투석 적응 부재 |
| 소화기계 | Y0051 담낭질환 | 385 | 룰 부재 |
| 심혈관계 | Y0142 CRRT | 374 | 심혈관 환자의 CRRT 적응 부재 |
| 소화기계 | Y0052 담도질환 | 356 | 룰 거의 부재 |
| 물질오용 | Y0141 응급HD | 330 | **약물 중독 → HD 적응 룰 부재** |
| 신경계 | Y0141 응급HD | 311 | 룰 부재 |
| 일반 | Y0142 CRRT | 299 | 룰 부재 |
| 호흡기계 | Y0141 응급HD | 269 | 룰 부재 |

### 5.2 Top FP (over-triage)

| Level2 | Predicted Y | Count | 의미 |
|---|---|---:|---|
| **신경계** | **Y0032 뇌출혈** | **13,929** | **massive over-trigger** |
| 신경계 | Y0031 거미막하출혈 | 7,889 | over-trigger |
| 신경계 | Y0020 뇌경색 | 6,653 | over-trigger |
| 심혈관계 | Y0041 흉부대동맥 | 5,483 | 흉통 → 자동 후보 (질문 미작동) |
| 심혈관계 | Y0010 심근경색 | 5,483 | 흉통 → 자동 후보 |
| 소화기계 | Y0081 위장관내시경(성인) | 1,198 | over-trigger |
| 정신건강 | Y0150 정신과응급 | 929 | 카테고리 전체 inclusion |

---

## 6. v0.2 개선 권고 (Phase 8h 우선순위)

### 6.1 Critical: Rule absent 카테고리 (recall 0)

추가 적응 룰 작성 필요:

1. **Y0141 응급 HD / Y0142 CRRT (총 FN 약 3,000건)**:
   - 적응 트리거: 의식상태 U/V + 약물 중독(level2='물질오용'), 또는 Pre-KTAS 코드의 level3·level4 텍스트 매칭 ('산증', '고칼륨', '요독증', '심폐부종')
   - Frozen cluster의 clinical_split (R57.x 동반 → CRRT) 정책 적용
2. **Y0060 복부응급수술 (FN 1,349건)**:
   - 적응 트리거: level2='소화기계' + level4 텍스트 매칭 ('복통 심함', '복막자극', '쇼크')
3. **Y0051 담낭질환 (FN 385건)**:
   - 적응 트리거: level3·level4 텍스트 '담낭', '우상복부 통증' 매칭
4. **Y0052 담도질환 (FN 356건, recall 0.3%)**:
   - 적응 트리거: level3·level4 텍스트 '담관염', '황달' 매칭

### 6.2 High: Over-prediction 좁히기 (specificity 보전)

1. **Y0032 뇌출혈 13,929 FP**: 신경계 카테고리 전체에서 Y0032 후보가 자동 trigger됨. level3·level4의 '의식변화', '발작' 같은 광범위 증상에서 Y0032를 빼고 '두부외상', '극심한 두통', '편마비' 같은 specific feature 한정.
2. **Y0010·Y0041 흉통 split 미작동**: 흉통 환자에 두 후보 모두 trigger → q0 시점부터 과대 추정. chest_pain_character 질문이 oracle에서도 sens 증분 0이라는 점은 두 후보의 union이 정답을 포함하므로 추가 narrowing이 의미 없다는 신호. 즉 over-prediction은 specificity 손실로만 작용. 좁히는 룰 (예: 흉통 + 심전도 변화 명시 → Y0010만; 흉통 + 이동성 통증 → Y0041만) 도입 필요.
3. **Y0150 정신과 over-inclusion**: 카테고리 전체 trigger → grade 4-5 정신과 케이스에서 false alarm. 자해·타해 risk feature 명시 시만.

### 6.3 Medium: Recall 부족 카테고리

1. **Y0082 위장관내시경(영유아) recall 0.18**: pediatric grade 1-2 + level3 '출혈·이물' 매칭 강화.
2. **Y0020 뇌경색 recall 0.69 → 0.85+**: 신경계 grade 1-2 전체로 trigger 확대 (현재 specific text 매칭 한정 추정).

### 6.4 Sensitivity vs Specificity trade-off

- 현재 (v0.1): sens 0.39, spec 0.81 — under-triage 우선 문제
- 목표 (v0.2): sens 0.70+, spec 0.75+ — H1·H2 모두 통과 (한국 baseline)
- 균형: rule absent 카테고리(Y0060·Y0141·Y0142·Y0051) 추가 + over-prediction 좁히기 동시

### 6.5 Phase 8b inclusion 손실 검토

- 130,536 included / 179,924 matched = 72.5%
- 손실 27.5% = 25,936건
  - codebook missing: 6,541 (2.9% of total)
  - unknown suffix (1/2/3): unique 205 codes의 visit count 추정 ~12k
- Phase 8a-1에서 미매핑된 코드의 임상 의미 자문 필요. 5/6자 코드 정합성 사전 작업 부족분.

---

## 7. 한계 (Limitations)

1. **단일 cohort, retrospective**: 광주·전남·전북 편중. 수도권·기타 시도 외부 검증 부재.
2. **ICD-10 reference standard imperfection**: Y-code는 시술·자원 정의이지 진단 정의가 아니다. 자문자 cluster mapping은 1인 임상 판단.
3. **5/6자 crosswalk 가설 (suffix 0/9 = adult/pediatric)**: 23.9% unique codes 미매핑. visit-weighted 영향 27.5%. Phase 8a-1 한계.
4. **Oracle simulation의 단순성**: ground truth가 candidates에 있으면 정답 도달 가정. 실제 질문 트리는 더 복잡. Best-case 추정.
5. **Conditional include / clinical_split 미적용**: Y0091 R04.2, Y0160 S05.0, Y0171 I26.x, Y0141·Y0142 split 등은 현재 분석에서 단순 ICD-10 prefix 매칭만 적용. Phase 8c+에 상세 임상 정보 매칭 로직 도입 필요.
6. **Y0150 정신과 X60-X84 range**: 자해 ICD-10이 범위 표기됨. 본 분석에서 prefix 매칭으로 처리하나 실제 의도 검증 필요.
7. **Pre-KTAS 코드 부여의 inter-rater reliability** 본 연구 범위 외.

---

## 8. 결론

### 8.1 가설 결과

| 가설 | 결과 |
|---|---|
| H1 Sensitivity ≥ 0.80 | ❌ **FAIL** (0.394) |
| H2 Specificity ≥ 0.80 | ✅ **PASS** (0.808) |
| H3 한계효용 ≥ 0.05/질문 | ❌ **FAIL** (oracle gain 0) |
| H4 Tier 일치율 ≥ 0.80 | (미측정, 별도 분석 권고) |

### 8.2 임상 활용 판단

**v0.1은 임상 활용 불가**. Sensitivity 39.4%는 60.6% under-triage를 의미하며, 응급의료 분야에서는 환자 안전 위해 수준이다.

다만 specificity 80.8% 통과는 v0.1의 over-trigger가 베이스라인 임계 이내에 있다는 의미. 즉 Pre-KTAS 자체는 비중증 환자를 어느 정도 거를 수 있는 정보를 담고 있고, 추가 rule만 보강하면 sensitivity 개선 가능.

### 8.3 다음 phase

**Phase 9 권고**:
- 8h v0.2 룰 개선 (§6.1·6.2·6.3 우선순위 따라)
- v0.2 평가 재실행
- 외부 cohort (수도권 데이터) 확보 후 prospective validation

**현 시점에서 즉시 가능한 sub-analysis**:
- Conditional include 적용 후 Y0091·Y0160·Y0171 재평가
- Y0141·Y0142 R57.x 기반 split 적용 후 재평가
- Y0052 strict cluster (K83.0+K80.3 한정) sensitivity 비교

---

## 9. 재현 (Reproducibility)

```bash
git checkout f396343  # frozen index test
python3 scripts/research/validate-phase8.py
# Outputs:
#   research/validation-results-v0.1.json
#   research/validation-stratified.json
#   research/validation-error-audit.json
```

Source CSV (`source-prektas.csv`)는 외부 경로. SHA-256 hash는 별도 commit 필요 (Phase 8b post-hoc).

---

*Report v1.0, frozen at 2026-04-26. Pre-data-lock amendments는 protocol §16 따라 별도 amendment 절차.*
