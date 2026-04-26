# Vignette Validation 결과 분석 (Phase 10c)

**Review ID**: VIGNETTE-REVIEW-mofq7k1h
**Reviewer**: 응급의학 전문의 (1인)
**일시**: 2026-04-26 12:10 ~ 16:00 UTC (~3시간 50분, 분산 작업)
**대상**: v0.2 알고리즘 + 매핑성 매트릭스 v1.0 frozen

---

## 1. 결과 요약

| 평가 | 수 | 비율 |
|---|---:|---:|
| 적절 | 14 | 47% |
| 부분 적절 | 10 | 33% |
| 부적절 | 6 | 20% |
| 평가 불가 | 0 | — |

종합 질문 5개 답변은 비어있으나 vignette별 메모에 분산되어 사실상 답변됨.

### 카테고리별

| 카테고리 | N | 적절 | 부분 | 부적절 | inappropriate 비율 |
|---|---:|---:|---:|---:|---:|
| textbook | 12 | 6 | 6 | 0 | 0% |
| fn_pattern | 8 | 4 | 3 | 1 | 12.5% |
| **fp_pattern** | **5** | **2** | **0** | **3** | **60%** |
| consultant_change | 5 | 2 | 1 | 2 | 40% |

**가장 취약한 카테고리: fp_pattern (over-trigger).** v0.2가 v0.1 대비 over-trigger를 좁혔다고 했으나 vignette validation에서는 여전히 60% inappropriate. 통계로 보이지 않는 한계가 case-level qualitative에서 드러남.

---

## 2. 패턴별 발견

### 2.1 fp_pattern — over-trigger 여전히 광범위

| VIG | 시나리오 | 시스템 출력 | 자문 평가 |
|---|---|---|---|
| 20 | atypical chest pain (활력 정상) | ·심근경색 재관류· confident | "시술후보 부적절, atypical chest pain에서는 과다" |
| 21 | 만성 우울증, 자해 의도 없음 | ·정신과 응급입원· confident | "정신과 응급입원 플래그 과다" |
| 22 | 결막 충혈 (시력 정상) | ·안과 응급수술· candidate | "지역기관은 적절, 안과 응급수술은 과다" |

**원인**: v0.2의 specific feature 룰이 충분히 좁히지 못함.
- ·심근경색 재관류·: "압박" 키워드가 흉통 character 모호 시에도 trigger
- ·정신과 응급입원·: "우울증/자살/자해" level3 진단명만으로 trigger ("우울함, 자살 생각은 없음" level4 개의치 않음)
- ·안과 응급수술·: 매트릭스에서 B 그룹이라 "단순 결막 충혈"도 candidate로 trigger

### 2.2 textbook — 절반 partial (Y코드 over-firing)

textbook 카테고리는 inappropriate 0건이지만 partial 6건 (50%). 핵심:

| VIG | 자문 의견 | 의미 |
|---|---|---|
| 04 분만 임박 | "·저체중 출생· trigger 이유 없다. 산과 가능 병원이면 권역 갈 필요 X" | Phase 9c special rule "Y0100·Y0111·Y0112 co-trigger" 자체가 임상적으로 과다 |
| 05 손가락 절단 | "·수지 접합·만 호출. ·사지 접합·은 호출 안 돼도 됨" | 정밀 부위 명시 시 더 좁히기 필요 |
| 09 BSA 30% 화상 | "기도 화상 의심 시 ·성인 기관지 내시경· 후보 추가" | 화상 + 기도 화상 → Y0091 candidate 추가 권고 |
| 07 CPR 1시간 후 | "ROSC 안 됨 → 가장 가까운 병원, ROSC 됨 → 저체온치료 가능 권역" | CPR/ROSC 분기 룰 부재 |
| 29 미숙아 호흡부전 | "신생아 정보 + 임신주수·체중·호흡부전 추가 질문 → NICU 분기" | 신생아 추가 질문 catalog 필요 |
| 03 우하복부 충수염 | "지역응급의료센터를 기본으로" | tier 권고가 권역 중심 편향 |

### 2.3 fn_pattern — 자문자 의도(C 그룹 tier-only)는 잘 작동, 일부 보강

| VIG | 평가 | 자문 의견 |
|---|---|---|
| 11 황달+발열 | appropriate | C 처리 그대로 |
| 12 만성 신부전 호흡곤란 | partial | "숨참 환자에 과거력·중증도 질문 추가" (구체적 질문 catalog 제안) |
| 13 패혈증 + AKI | appropriate | unmapped 처리 OK |
| 14 장폐색 50세 | **inappropriate** | "지역센터급/지역기관급 적절, 권역 X" |
| 15 PE 의심 | appropriate | unmapped 처리 OK |
| 16 사지 동맥 폐색 | appropriate | "임상적 rare하므로 일단 권역으로 가는 게 한국 시스템에 맞다" |
| 17 담관염 의식변화 | partial | "·담낭 응급··담도 응급· 둘 다 candidate면 과다" |
| 18 영유아 currant jelly | partial | "위장관 내시경을 처음부터 제시는 곤란" |

VIG-14가 핵심 — 장폐색에 권역 권고는 한국 응급의료 현실에서 과다. tier conservative shift 필요.

### 2.4 consultant_change — 자문자 자기 결정 일부 재고

이 카테고리가 가장 흥미로움. Phase 9b에서 자문자 본인이 5건 변경했는데 vignette validation에서 일부 뒤집힘.

| VIG | 자문자 Phase 9b 결정 | vignette 결과 | 의미 |
|---|---|---|---|
| 24 찢어지는 흉통 | Y0041 B→C | appropriate | 결정 정당화 ✓ |
| 25 박동성 복통+쇼크 | Y0042 B→C | appropriate | 결정 정당화 ✓ |
| 26 임신 32주 PROM | Y0112 A→B, Y0100 A→B | **inappropriate** | "분만, 저체중 출생, 산과 응급, 분만실 여유 모두 고려되어야" |
| 27 임신 28주 무통성 출혈 | Y0112 A→B | **inappropriate** | "산과 수술 가능 병원이 맞다, 태반박리 등 가능해야" |
| 28 25세 여 우하복부 | Y0113 B→C | partial | "지역센터/지역기관이 적절" — tier만 OK |

**핵심 발견**: Phase 9b에서 본인이 옮긴 결정 2건이 임신 응급 케이스에서 너무 보수적이었음. v0.2가 이 케이스에서 unmapped 처리 = 부적절. 1인 자문의 한계를 vignette validation이 정량 확인.

---

## 3. v0.3 권고 (vignette 결과 기반)

### Critical — over-trigger 좁히기 (fp_pattern 100% inappropriate 회피)

**·심근경색 재관류·** (VIG-20):
- "압박" 단독 키워드로 trigger 금지
- "압박성 흉통" + 활력 변화/식은땀/방사통 같은 추가 신호 동반 시만 confident
- 비특이적 흉통은 unmapped

**·정신과 응급입원·** (VIG-21):
- "우울증/자살/자해" level3 진단명만으로 trigger 금지
- level4가 "계획적 자살시도" / "뚜렷한 자살의도" / "구체적 자살관념" 명시 시만 confident
- "우울함, 자살 생각은 없음" / "만성 우울증" → unmapped

**·안과 응급수술·** (VIG-22):
- "눈충혈/분비물" 단독 → unmapped
- "안구 외상" / "시력 저하" / "안구 천공·관통" / "급성 통증 8-10" 동반 시만 candidate
- 천공·관통 명시 시 confident 승격 (기존 룰 유지)

### High — Y코드 over-firing 정리

**·저체중 출생· 자동 co-trigger 제거** (VIG-04):
- 분만 임박 trigger와 분리
- "방금 태어난 신생아" trigger + 임신주수<37 명시 시만 후보

**·사지 접합· 정밀화** (VIG-05):
- "손가락" / "발가락" 명시 → ·수지 접합·만
- "팔" / "다리" / "사지" 명시 → ·사지 접합·만
- "절단" 일반 → 둘 다 후보 (현재 룰)

**·성인 기관지 내시경· 추가 trigger** (VIG-09):
- 화상 + "기도 화상" / "연기 흡입" / "안면 화상" 동반 시 candidate 추가

**CPR/ROSC 분기** (VIG-07):
- ROSC 미달성 명시 → preferred tier = local_institution (가장 가까운 병원)
- ROSC 달성 명시 → preferred tier = regional (저체온치료 가능)
- 추가 질문: rosc_status

### Medium — tier conservative shift (한국 응급의료 현실)

**grade 2 복통류**:
- 충수염·장폐색·일반 복통 → preferred tier = local_center (regional 제외)
- acceptable: [local_center, local_institution]
- VIG-03·14·28 자문 의견 반영

**분만 임박**:
- 분만 자체에는 권역 강제 X
- preferred tier = local_center (산과 가능 지역응급의료센터)

**rare disease는 보수적 권역 권고 유지** (VIG-16 자문):
- 사지 동맥 폐색·뇌출혈·심근경색 등 — 임상적 rare이지만 한국 시스템에서는 권역 직송이 적절

### 신규 추가 질문 catalog

**호흡곤란 환자** (VIG-12 자문자 직접 제안):
1. 과거력 4가지: 심장질환 / 신기능 저하·투석 필요 / 만성 호흡기 / 감염성 (격리병상 필요)
2. 중증도 3가지: SpO2 ≤92% / 대화 어려움 / 의식 저하·혼수 → 기계호흡 필요

**신생아 평가** (VIG-29 자문):
1. 임신주수 <37주 → ·저체중 출생· candidate
2. 출생체중 <2500g → ·저체중 출생· confident
3. 호흡부전·청색증 → NICU 가능 권역 권고

**CPR 상태** (VIG-07 자문):
1. ROSC 달성 여부

**임신 응급** (VIG-26·27 자문):
1. 양수누출 + 임신주수 → ·분만· candidate + ·저체중 출생· candidate (주수 따라)
2. 임신 + 출혈 + 통증 없음 → ·산과 응급수술· candidate (전치태반·태반박리 의심)

---

## 4. 자문자 자기 결정 재고

Phase 9b에서 자문자가 변경한 5건 중 vignette validation으로 정당화된 / 재고 필요한 영역:

| Phase 9b 결정 | vignette 검증 | 재고 |
|---|---|---|
| Y0041 B→C (찢어지는 흉통) | VIG-24 appropriate | 유지 |
| Y0042 B→C (찢어지는 복통) | VIG-25 appropriate | 유지 |
| **Y0100 A→B (저체중 출생)** | VIG-04·26 inappropriate | **재고**: 분만 자동 co-trigger 제거. "방금 태어난 신생아"에서만 분리 trigger. |
| **Y0112 A→B (산과수술)** | VIG-26·27 inappropriate | **재고**: 임신 응급(PROM, 무통성 출혈)에서는 confident로 유지 필요. 분만과 동시 trigger도 OK. |
| Y0113 B→C (부인과 응급수술) | VIG-28 partial | 유지하되 tier 권고만 명확히 |

**v0.3에서 적용**: 매핑성 매트릭스를 amendment v1.1로 일부 갱신. Y0100·Y0112는 임상 시나리오에 따라 confident도 가능하도록 special rule 정밀화.

---

## 5. 종합 평가

### 적절성 비율 47%의 의미

47%만이 그대로 활용 가능하다는 것은 v0.2가 임상 활용 단계에 못 미친다는 의미. 다만 inappropriate 20%는 **수정 가능한 영역에 집중**:
- fp_pattern 3건은 specific feature 룰 좁히기로 해결 가능
- consultant_change inappropriate 2건은 자문자 자기 결정 amendment로 해결
- 즉 v0.3에서 80%+ 적절성 도달 가능성 명확히 보임

### v0.2가 잘 작동한 영역
- textbook A/B 그룹 confident·candidate (분명 케이스): VIG-01, 02, 06, 08, 10, 30 모두 appropriate
- C 그룹 (담낭/담도, 패혈증, 사지 동맥폐색 등): VIG-11, 13, 15, 16 appropriate

### v0.2가 취약한 영역
- fp_pattern (over-trigger): 60% inappropriate
- 임신 응급 (자문자 자기 결정 재고): VIG-26·27 inappropriate
- tier conservative shift 부재: VIG-14·03·28 권역 과다

### v0.3 목표
- fp_pattern inappropriate 0%
- 임신 응급 trigger 회복
- tier 권고가 한국 응급의료 현실 반영

---

## 6. 다음 단계

1. **v0.3 알고리즘 구현** (Phase 11): 위 권고 적용
2. **v0.3 directional 검증**: 광주·전라 cohort 단일 패스 + v0.2 vs v0.3 비교
3. **research.html v3 reframe**: vignette validation 결과 + v0.3 변경 사항
4. (선택) 매핑성 매트릭스 amendment v1.1: Y0100·Y0112 special rule 정밀화

본 vignette validation은 통계 임계값 없이 case-level logical chain에서 v0.2의 한계를 정량 측정. 1 자문자 + 1 cohort라는 자원 제약 안에서 robustness를 한 차원 추가한 작업.

---

*Analysis frozen at 2026-04-27. v0.3 알고리즘 구현 시작.*
