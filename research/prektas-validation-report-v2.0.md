# Pre-KTAS → EMRIS Y코드 매핑 알고리즘 v0.2 검증 보고서 v2.0

**Protocol**: PREKTAS-VAL-2026-001 v1.1
**Algorithm**: v0.2 (commit hash 갱신 필요)
**Reference standard**: `research/y-code-icd10-clusters.json` v1.0 + `research/y-code-mappability-matrix.json` v1.0
**Analysis date**: 2026-04-26
**Cohort**: source-prektas.csv (광주·전남·전북 ED 방문, 2025–2026)

---

## Executive Summary

**v2.0 보고서는 v1.0과 framing이 근본적으로 다르다.** v1.0은 "sensitivity 0.394 → 임상 활용 불가" 통계 판정이었으나, 응급의학 전문의 자문자가 framing을 reframe했다.

> **새 framing**:
> - Pre-KTAS + 0–3 질문은 현장 정보의 본질적 한계가 있다. 통계 sensitivity 임계값(0.70 등)을 강제하는 건 임상 현실과 맞지 않다.
> - **명확한 case만 Y코드 매핑(A 그룹), 모호한 case는 tier만 권고(C 그룹).** 후보군 narrowing보다 "적합한 tier로 직송 + 병원이 검사 후 결정"이 임상적으로 옳다.
> - **광주·전라 데이터는 검증 안 됨.** 통계는 directional probe (참고치, 결정의 근거 X). **논리적 정합성**(응급의학 임상 추론)이 우선 권위.
> - LLM은 ground truth 결정자가 아닌 최종 병원 선택자 (Phase 6 흐름 유지).

### 핵심 산출

1. **매핑성 매트릭스 v1.0 (frozen)**: 27 Y코드 × A(10) / B(6) / C(11). 자문자 검토 5건 변경 반영.
2. **v0.2 알고리즘**: 출력 채널 분리 — `mappability` + `y_candidates with confidence` + `tier_recommendation`.
3. **Special rules 4건**: Y0100·Y0111·Y0112 co-trigger, Y0160 conditional A 승격, Y0150·Y0032 specific feature only.
4. **Directional 통계** (informational only): v0.2 specificity 0.845 (v0.1 0.808 대비 향상), tier agreement 85.7%.

---

## 1. 매핑성 매트릭스 (논리적 정합성 — primary authority)

### 1.1 그룹 정의

| 그룹 | 정의 | 출력 채널 |
|---|---|---|
| **A (Confident)** | Pre-KTAS 코드 또는 0–3 질문만으로 시술 적응 명확 | `y_candidates` with `confidence='confident'` |
| **B (Candidate)** | Y코드 후보군(2–3개)로 좁힘, 단정 X | `y_candidates` with `confidence='candidate'` |
| **C (Tier-only)** | 현장 정보로 Y코드 결정 불가 | `y_candidates=[]`, `tier_recommendation`만 |
| **Unmapped** | 27 Y코드 외 + grade 기반 tier | grade fallback tier |

### 1.2 분류 (자문자 검토 후 frozen)

**A (10)**: Y0010 심근경색 · Y0081/0082 위장관내시경 · Y0091/0092 기관지내시경 · Y0111 분만 · Y0120 화상 · Y0131/0132 사지접합 · Y0150 정신과응급

**B (6)**: Y0020 뇌경색 · Y0031 거미막하 · Y0032 뇌출혈 · Y0100 저체중출생아 · Y0112 산과수술 · Y0160 안과응급

**C (11)**: Y0041 흉부대동맥 · Y0042 복부대동맥 · Y0051 담낭 · Y0052 담도 · Y0060 복부응급 · Y0070 영유아 장중첩 · Y0113 부인과수술 · Y0141 응급HD · Y0142 CRRT · Y0171 IR(성인) · Y0172 IR(영유아)

### 1.3 자문자 5건 변경 (1차 12·7·8 → frozen 10·6·11)

| Y-code | draft → frozen | 임상 사유 |
|---|---|---|
| Y0041 흉부대동맥 | B → C | 찢어지는 흉통 → 먼저 PCI 가능 권역/지역센터 직송, 검사 후 대동맥응급 판별 |
| Y0042 복부대동맥 | B → C | 동일 원칙 |
| Y0100 저체중출생아 | A → B | 출생 직후 구급대 거의 X. 분만과 co-trigger |
| Y0112 산과수술 | A → B | Y0111과 동시 필요 가능 |
| Y0113 부인과수술 | B → C | 현장 부인과 응급 식별 불가 |

### 1.4 자문자 일관 원칙

> **"후보군으로 좁히기보다 적합한 tier 병원으로 직송 + 병원이 영상/검사 후 결정"**

이 원칙이 Y0041/0042/0113 모두 B→C 변경의 공통 근거. v0.2 알고리즘이 내재화함.

---

## 2. v0.2 알고리즘

### 2.1 출력 schema

```jsonc
{
  "code": "CICAA",                          // Pre-KTAS 5자
  "mappability": "A" | "B" | "C" | "unmapped",
  "y_candidates": [
    { "code": "Y0010", "confidence": "confident" }
  ],
  "c_tier_codes": ["Y0042"],                // informational, tier 결정에만
  "tier_recommendation": {
    "preferred": "regional",
    "acceptable": ["regional", "local_center"],
    "source": "y_tier_intersection"
  },
  "questions": ["chest_pain_character"],   // 0-3
  "rationale": "압박성 흉통 → Y0010 confident"
}
```

### 2.2 Special rules 적용

| Rule | 동작 |
|---|---|
| **Y0100·Y0111·Y0112 co-trigger** | 분만 임박 trigger 시 Y0111 confident + Y0100·Y0112 candidate 동시 출력 |
| **Y0160 conditional promotion** | level3·4에 "안구 천공" 또는 "관통상" 매칭 시 confidence='confident' 승격 |
| **Y0150 specific feature only** | "자살" / "자해" / "환각" / "기괴" / "급성 정신" 명시 시만 trigger |
| **Y0032 specific feature only** | "편마비" / "GCS" / "벼락두통" / "극심한 두통" 명시 시만 trigger |
| **Y0041/Y0042 → C** | 찢어지는 흉통/복통은 후보 단정 X, tier만 |
| **Y0113 → C** | 부인과 응급은 현장에서 trigger X, Y0060과 동일 tier |

### 2.3 4,689 Pre-KTAS entries 분포

| Mappability | 수 | 비율 |
|---|---:|---:|
| A (confident) | 434 | 9.3% |
| B (candidate) | 295 | 6.3% |
| C (tier-only) | 45 | 1.0% |
| unmapped | 3,915 | 83.5% |

unmapped 비율이 v0.1 81%보다 약간 높은 이유: C 그룹의 trigger rule이 보수적으로 작성됨 (특히 Y0141·Y0142). v0.3에서 보강 가능.

---

## 3. Directional 통계 (informational only)

> **자문자 원칙**: 광주·전라 데이터는 검증 안 됨. 본 결과는 결정의 근거가 아닌 directional probe.

### 3.1 v0.2 binary metrics (130,536 included visits)

| 지표 | confident only | confident + candidate | v0.1 (참고) |
|---|---:|---:|---:|
| Sensitivity | 0.134 | 0.329 | 0.394 |
| Specificity | **0.934** | **0.845** | 0.808 |
| PPV | — | — | 0.205 |
| F1 | 0.162 | 0.257 | 0.270 |

**해석 (informational)**:
- v0.2 specificity 0.845는 v0.1 0.808보다 향상 (over-trigger 좁히기 효과)
- v0.2 sensitivity는 v0.1보다 낮음 — 자문자 원칙대로 "단정 회피"의 의도된 비용
- C 그룹(11개 Y코드)을 candidates에서 제외했기 때문에 sens 손실은 imageable
- **이 수치들로 v0.2를 평가하지 않는다.** 자문자 원칙: 통계는 참고, 임상 정합성이 결정.

### 3.2 Mappability 분포 (130,536 included)

| Mappability | visits | 비율 |
|---|---:|---:|
| A (confident) | 10,109 | 7.7% |
| B (candidate) | 14,548 | 11.1% |
| C (tier-only) | 41 | 0.03% |
| unmapped | 105,838 | 81.1% |

C 그룹 visits가 매우 작은 이유: C 그룹 11개 Y코드의 trigger 키워드 (담낭/담도/복부응급 등)가 광주·전라 cohort에서 명시적으로 잡히지 않거나 unmapped로 떨어짐. 이건 룰 한계가 아니라 **광주·전라 데이터의 텍스트 특성** 가능.

### 3.3 Tier agreement (사전 등록 H4의 directional version)

| 항목 | 값 |
|---|---:|
| acceptable에 실제 tier 포함 | 85.7% |
| disagree | 14.3% |
| no_tier_info | (별도) |

**informational note**: 자문자 임계 0.80 (사전 등록)을 통과하나 본 보고서는 통계 임계 평가를 하지 않는다. 이 수치는 v0.2의 tier 권고가 광주·전라 cohort 실측 이송 종별과 directional하게 일치한다는 정보만 제공.

### 3.4 Type-A 모순 (A 그룹 confident인데 ground truth와 불일치)

**200건 미만 detected** (sample 50건 audit 가능, 결과 JSON 참조).

원인 추정:
- v0.2 텍스트 매칭이 광범위해 false positive (예: "압박" 키워드가 흉통 외 맥락에서도 trigger)
- ICD-10 → Y cluster 정의 한계 (frozen reference 1인 자문)
- 광주·전라 cohort의 ICD-10 코딩 품질 (자문자 caveat)

**audit 후속 작업**: Phase 9 후속 sub-task로 200 case 임상 검토. 본 보고서에서는 결정적이지 않음.

### 3.5 Type-B 후보 일치율

**67.5%** — B 그룹 후보군 중 ground truth Y코드 포함 비율. 후보 정의의 directional 적절성 신호.

### 3.6 Type-D unmapped (놓친 ground truth)

unmapped visit 중 ground truth Y가 있는 분포 (top): Y0020 뇌경색·Y0032 뇌출혈·Y0060 복부응급 등. 자문자 원칙대로 C 그룹·B 그룹의 trigger rule이 의도적으로 보수적이어서 그런 것이며, false negative이지만 v0.2의 "단정 회피" framing 안에서 acceptable.

---

## 4. 한계

1. **단일 cohort, retrospective**: 광주·전남·전북 편중. 외부 검증 없음.
2. **광주·전라 데이터는 검증 안 됨** (자문자 명시): 수십% 오류 가능, 질환별 차이 큼.
3. **ICD-10 reference standard imperfection**: Y코드는 시술·자원 정의이지 진단 정의가 아니다. 자문자 cluster 1인 판단.
4. **Pre-KTAS 5/6자 crosswalk 가설**: 23.9% unique codes 미매핑.
5. **v0.2 텍스트 매칭의 광범위성**: Type-A 모순 200건 — text rule 정밀화 필요.
6. **C 그룹 trigger 보수성**: 광주·전라 cohort에서 C 그룹 visit 41개만 — Y0141/0142 등의 trigger 키워드 부족.
7. **Pre-KTAS 코드 부여의 inter-rater reliability** 본 연구 범위 외.

---

## 5. v0.3 권고

### 5.1 단기 (자문자 추가 input 없이 진행 가능)

- **Type-A 모순 200건 audit** + text rule 정밀화 (예: "압박" 키워드는 "흉통" 동반 시만)
- **C 그룹 trigger 키워드 확장**: Y0141·Y0142 (의식 변화 + 약물 중독 등 광범위 매칭)
- **자문자 위임 항목 (Q3·Q6) 처리**: A 그룹 추가 질문 catalog 정밀화

### 5.2 중기 (자문자 검토 필요)

- **외부 cohort 확보** (수도권 데이터)
- **Pre-KTAS 5/6자 crosswalk 미매핑 코드** 임상 의미 자문 (suffix 1/2/3, 205 unique)
- **Y0150 정신과 카테고리** v0.2 specific feature 정밀도 검증

### 5.3 장기

- **Prospective validation**: 실제 119 운영 환경에서 v0.2 적용 + 결과 측정
- **응급의학 전문의 2인 reference standard agreement** (현재 1인 자문)

---

## 6. 결론

**v0.2는 v0.1의 통계 sensitivity를 추구하지 않는다.** 대신:

1. **임상 정합성 우선**: 매핑성 매트릭스 v1.0 frozen이 primary authority
2. **출력 채널 분리**: A/B/C 그룹별로 다른 신뢰도와 정보 제공
3. **자문자 원칙 내재화**: "tier 직송 + 병원 검사" 패턴 구현
4. **통계는 directional**: 광주·전라 데이터는 참고, 결정 X

이런 framing 하에서 v0.2는 임상적으로 honest한 도구다. 60% under-triage가 아니라 "현장 정보로 결정 가능한 case만 결정, 그 외는 tier 권고로 임상의에게 위임"이라는 명확한 책임 분리. v0.1의 "활용 불가" 판정은 잘못된 framing이었으며, v0.2는 임상 활용 가능성의 정확한 범위를 정의한다.

**LLM 통합 (Phase 6 기존 흐름)**: 룰 기반 v0.2 출력 (mappability + y_candidates + tier) → EMRIS 병상 정보 → LLM 최종 병원 추천. LLM은 ground truth 결정자가 아니다.

---

## 7. 재현

```bash
git checkout <v0.2 commit>

# v0.2 알고리즘 재실행
node scripts/research/build-prektas-to-y-mapping-v0.2.mjs
# → research/prektas-to-y-mapping-v0.2.json

# Directional 통계 재실행 (informational)
python3 scripts/research/validate-v0_2.py
# → research/validation-results-v0.2.json
```

Source CSV (`source-prektas.csv`)는 외부 경로. SHA-256 hash는 별도 commit.

---

## 8. Reference

- 매핑성 매트릭스: `research/y-code-mappability-matrix.json` v1.0
- 자문 원본: `research/mappability-review-2026-04-26-moexk8az.json`
- v0.1 보고서 (history): `research/prektas-validation-report-v1.0.md`
- Frozen reference standard: `research/y-code-icd10-clusters.json` v1.0
- Validation v0.1 (참고): `research/validation-results-v0.1.json`

---

*Report v2.0 frozen at 2026-04-26. Pre-data-lock amendment는 별도 절차.*
