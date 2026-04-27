# Changelog

## [2026-04-27] Phase 11f: v0.3 production 통합

> 챗봇·마법사가 v0.3 매핑 출력(mappability + confidence + 신규 질문 catalog 6개)을 직접 사용. lib/chatbot-payload.js v0.1 → v0.3 schema. HARNESS 프롬프트가 mappability·equipment_dimensions 해석 추가. npir 라벨 버그 fix.

### 변경
- `scripts/build-chatbot-payload.mjs` v0.3 schema fork
  - 입력: `research/prektas-to-y-mapping-v0.3.json` + matrix v1.0
  - rec[code] 필드 확장: y(flat) + m(mappability) + yc(confidence map) + t(tier) + qs(per-entry questions) + ct(c_tier_codes) + cpr(cpr_special)
  - questionEffects 신규 6개: dyspnea_history, dyspnea_severity, rosc_status, neonatal_assessment, pregnancy_emergency, airway_burn (multi_select 지원)
  - equipmentDimensions metadata 추가 (LLM이 tags 해석 시 참조)
- `lib/chatbot-payload.js` 671KB → 1.38MB (v0.3 추가 필드)
- `index.html` 챗봇 변경
  - findQuestionIds: rec.qs 우선 사용 (v0.3 entry별 질문), 기존 Y코드 추론 fallback
  - currentCandidates: multi_select 답변(배열) 처리
  - computeTier: rec.t 우선 (conservative shift 반영), 기존 yTier intersection fallback
  - collectEquipmentTags 신규 함수: tier_override + tags 수집
  - buildSubmitPayload: assessment에 mappability + confident_y_candidates + candidate_y_candidates + c_tier_codes + equipment_dimensions + cpr_special 추가
  - renderStageQuestions: multi_select 토글 + "다음 질문 →" 버튼
  - HARNESS_INTERPRET_PROMPT: mappability 해석 (A/B/C/unmapped 표현 분기) + equipment_dimensions 9개 tag → EMRIS 필드 매핑 + cpr_special ROSC 분기 명시
  - npir 라벨 버그 fix: "중환자" → "음압격리"로 정정. equipment_dimensions에 isolation_required tag가 있을 때만 격리 병상 표시 (npir/general/cohort 3종)
- `prektas-research.html`, `prektas-vignette-review-v0_3.html` 등 다른 페이지는 영향 없음

### 검증
- chatbot-payload.js 빌드: A:332/B:266/C:64/unmapped:4027 (v0.3 분포)
- JS 문법 OK
- Smoke test 5 케이스: CICCA, CHAAA, CKHCB, CIACB, CMCCC 모두 의도대로 작동
  - CICCA → Y0010 confident, `chest_pain_character` 질문
  - CHAAA → 숨참, `dyspnea_history+severity` 신규 질문 노출
  - CKHCB → 양수누출, Y0111+Y0100+Y0112 모두 trigger
  - CIACB → CPR special, `rosc_status` 질문, cpr_rosc_dependent tier source
  - CMCCC → 절단, `replantation_part` 답변으로 Y0132 제외

### 의도된 trade-off
- payload 크기 +700KB. 모바일 첫 로드 ~1초 더 소요 가능. v0.4에서 schema 압축 검토.
- 자문자 v0.3 vignette 재평가 (Phase 11f-prep)는 별도 진행 — 통합과 병행 가능.

### Out of scope (v0.4 후보)
- prektas-hospital-recommender.html (educational 도구) v0.3 마이그레이션
- equipment_dimensions matrix를 EMRIS 병상 정보와 자동 매칭하는 추천 로직 (현재는 LLM 해석 의존)
- payload 크기 압축

---

## [2026-04-26] Phase 10–11 완료: vignette 기반 v0.3 + research page v3 reframe

> 자문자가 30개 임상 시나리오로 v0.2 출력을 평가했다 (47% 적절, 33% partial, 20% 부적절). 그 피드백을 바탕으로 v0.3 알고리즘을 구현했다 — false positive 좁히기 + Y코드 over-firing 정리 + 임신 응급 강화 + 신규 질문 catalog 6개. v0.2 vs v0.3 광주·전라 directional 검증 완료. research.html v3 reframe.

### 변경 동기
- 자문자 의견: "통계만으론 모자라다. 시나리오를 직접 돌려봐야 안다." (Phase 10)
- vignette 검토 결과 v0.2가 atypical chest pain·negative-stated 우울감·단순 결막 충혈 등에서 over-trigger
- 자문자 본인 결정 두 건(VIG-26·27 임신 응급 약화)도 부적절 판정 → v0.3에서 강화 회복

### Commits
| # | 작업 | Commit |
|---|---|---|
| 1 | Phase 10c-1 — vignette 자문 결과 + 분석 보고서 | `5d82db1` |
| 2 | Phase 10c-2~11e — v0.3 알고리즘 + directional 검증 + page v3 | (이번 commit) |

### Phase 10 — vignette 검증
- `research/vignettes-v1.0-draft.json` (30 vignettes)
  - 12 textbook · 8 fn_pattern · 5 fp_pattern · 5 consultant_change
- `prektas-vignette-review.html` (38.8KB SPA, Tailscale + Vercel)
- `research/vignette-review-2026-04-26-mofq7k1h.json` (자문 원본)
  - 14 appropriate / 10 partial / 6 inappropriate (47%/33%/20%)
  - 부적절 패턴: VIG-20 (atypical chest pain → Y0010), VIG-21 (우울감 → Y0150), VIG-22 (단순 결막 충혈 → Y0160)
  - 자문자 자기 결정 부적절: VIG-26·27 임신 응급 약화
- `research/vignette-review-analysis.md` (6 섹션 분석 + v0.3 변경 권고)

### Phase 11 — v0.3 알고리즘
- `scripts/research/build-prektas-to-y-mapping-v0.3.mjs` (~480 lines, v0.2 fork)
- `research/prektas-to-y-mapping-v0.3.json` (4,689 entries)
  - A:332 / B:266 / C:64 / unmapped:4,027

#### 주요 변경 (vignette feedback)
1. **fp over-trigger 좁히기**
   - Y0010: 흉통(심장성) level3 안에서만 trigger, 비심장성 흉통은 unmapped, level4 character로 confident vs candidate 분기
   - Y0150: explicit positive marker만 (계획적 자살시도·뚜렷한 자살의도·급성 정신증·폭력)
   - Y0160: 단순 결막 충혈 unmapped, 시력저하·천공·관통이 명시되어야 후보
2. **Y코드 over-firing 정리**
   - Y0100 자동 co-trigger 제거 (분만에 자동 따라오던 것)
   - Y0131/Y0132 둘 다 후보 + replantation_part 질문으로 분기
3. **임신 응급 강화 (자문자 자기 결정 재고)**
   - 양수누출 + 임신 20주+ → Y0111+Y0100+Y0112 모두 후보
   - 지속 질출혈/전치태반/태반박리 → Y0112 confident
4. **신규 질문 catalog**
   - dyspnea_history (호흡곤란 과거력)
   - dyspnea_severity (중증도)
   - rosc_status (CPR/ROSC 분기)
   - neonatal_assessment (신생아 평가)
   - pregnancy_emergency (임신 응급)
   - airway_burn (기도 화상)

### Phase 11d — v0.2 vs v0.3 directional
- `scripts/research/validate-v0_3.py` (v0.2 + v0.3 동시 평가)
- `research/validation-results-v0.3.json` (130,536 visits)

| 지표 | v0.2 | v0.3 | Δ |
|---|---|---|---|
| Specificity (확정 only) | 0.934 | 0.963 | **+0.029** |
| Specificity (확정+후보) | 0.845 | 0.874 | **+0.030** |
| F1 (확정 only) | 0.162 | 0.170 | +0.008 |
| Tier 일치율 | 0.857 | 0.868 | +0.011 |
| Sensitivity (확정 only) | 0.134 | 0.120 | -0.014 (의도) |

- specificity 상승 = vignette에서 본 over-trigger 좁힘이 실제 코호트에서도 confirm
- sensitivity 약간 하락 = 확정 매핑 좁힌 비용 (의도된 trade-off)
- tier agreement 상승 = grade 2 복통류·분만 임박 conservative shift 효과

### Phase 11e — research.html v3 reframe
- `scripts/build-research-page.mjs` 전면 재작성
- `prektas-research.html` (rebuild)
  - 헤드라인: "통계가 말하지 않는 것을, 30개 가상 시나리오가 말했다"
  - vignette 결과 박스 (14·10·6)
  - 부적절 6건 패턴 분석
  - v0.3 변경 4 카테고리 (fp 좁히기 / over-firing 정리 / 임신 응급 / 질문 catalog)
  - v0.2 vs v0.3 directional 비교 표
  - vignette 통과 추정치 25/30 (자문자 재검토 필요 명시)

### v0.4 후속
- v0.3 vignette 재검토 (자문자 1시간)
- 외부 cohort (수도권 데이터)
- vignette 30 → 100, reference standard agreement (자문자 1 → 2)
- 332개 확정 매핑 audit

---

## [2026-04-26] Phase 9b–9e 완료: v0.2 임상 정합성 reframe + 보고서 v2.0

> v1.0 framing("sens 0.394 → 임상 활용 불가") 폐기. 자문자 검토 frozen 매트릭스(10·6·11) + v0.2 알고리즘 + directional 통계 + 보고서·페이지 reframe. 3 commits.

### 변경 동기
- 응급의학 전문의 자문자 framing 변경 요청 ("통계 임계 폐기, 임상 정합성 우선")
- 광주·전라 데이터는 검증 안 됨 — 통계는 directional probe (참고치)
- 명확한 case만 Y매핑 (A 그룹), 모호한 case는 tier만 (C 그룹)

### Commits
| # | 작업 | Commit |
|---|---|---|
| 1 | Phase 9b — 매핑성 매트릭스 v1.0 frozen (자문자 5건 변경) | `fd0b908` |
| 2 | Phase 9c+9d+9e — v0.2 알고리즘 + directional 통계 + 보고서·페이지 | `5515015` |

### Phase 9b — 매트릭스 frozen
- `research/y-code-mappability-matrix.json` v1.0 (status: frozen)
  - 1차 초안 12·7·8 → 자문자 검토 후 **10·6·11**
  - 자문자 변경 5건: Y0041(B→C)·Y0042(B→C)·Y0100(A→B)·Y0112(A→B)·Y0113(B→C)
  - 자문자 일관 원칙: "후보군 narrowing보다 tier 직송 + 병원 검사"
- `research/mappability-review-2026-04-26-moexk8az.json` (자문 원본 보존)
- `prektas-mappability-review.html` (38.8KB SPA 자문 도구, Tailscale + Vercel)

### Phase 9c — v0.2 알고리즘
- `scripts/research/build-prektas-to-y-mapping-v0.2.mjs` (~430 lines)
  - 출력 schema 분리: `mappability` + `y_candidates(confidence)` + `tier_recommendation`
  - Special rules 4건:
    - Y0100·Y0111·Y0112 co-trigger (분만 임박)
    - Y0160 conditional A 승격 (안구 천공·관통)
    - Y0150 specific feature only (자해·정신증)
    - Y0032 specific feature only (편마비·GCS·극심한 두통)
- `research/prektas-to-y-mapping-v0.2.json` (4,689 entries)
  - A:434 (9.3%) / B:295 (6.3%) / C:45 (1.0%) / unmapped:3,915 (83.5%)

### Phase 9d — Directional 통계 (informational only)
- `scripts/research/validate-v0_2.py` (~250 lines)
- `research/validation-results-v0.2.json` (130,536 visits, informational)
  - Confident only: sens 0.134, spec **0.934**, F1 0.162
  - Confident + candidate: sens 0.329, spec **0.845**, F1 0.257
  - v0.1 비교: sens 0.394, spec 0.808
  - **Specificity 향상** (over-trigger 좁히기 효과 0.808 → 0.845)
  - **Tier agreement 85.7%** (사전 등록 H4 임계 0.80 directional 통과)
  - Type-A 모순 200건 (text rule 정밀화 후속)
  - Type-B 일치율 67.5%

### Phase 9e — 보고서·페이지 reframe
- `research/prektas-validation-report-v2.0.md` (8 섹션)
  - 통계 임계값 폐기 명시
  - 임상 정합성 우선 framing
  - 광주·전라 데이터 caveat 강조
- `prektas-research.html` 전면 교체
  - 헤드라인: "현장 정보의 한계는 인정. 명확한 case만 매핑, 나머지는 tier 직송"
  - Reframe verdict 박스 (good 색상): "활용 불가 아닌 활용 가능 범위 정의"
  - 광주·전라 데이터 caveat 박스 (accent)
  - 매핑성 매트릭스 시각화 3 카드 (A·B·C)
  - 자문자 변경 5건 표
  - v0.2 binary metrics + tier agreement (informational)
  - 자문자 원칙 pullquote
  - 산출물 8개 GitHub 링크
- `scripts/build-research-page.mjs` 재작성 (v2.0 결과 임베드)
- `run.sh` print_url에 자문 도구 + 추천 도구 URL 추가
- `public/` 심볼릭 링크 추가 (mappability-review.html, consultation.html)

### 핵심 framing 전환
| | v1.0 | v2.0 |
|---|---|---|
| Framing | "sens 39.4% → 임상 활용 불가" | "현장 정보 한계 인정 + 명확 case 매핑 + tier 직송" |
| Primary authority | 통계 임계값 (sens 0.80, spec 0.80) | 임상 정합성 (응급의학 추론) |
| 광주·전라 데이터 | sensitivity 평가 근거 | directional probe (informational only) |
| C 그룹 | recall 0% = "rule absent" | 의도된 tier-only (자문자 결정) |

### Review (Pre-Landing Audit)
- Quality Score (Phase 9b): 8.5/10 (4 informational, 0 critical)
- Quality Score (Phase 9c+d+e): 9/10 (자문자 framing 내재화 + reframe 일관성)

### 배포
- main pushed: `fd0b908`, `5515015`
- Vercel production: `https://119chat.emergency-info.com/prektas-research.html`
- 자문 도구 Tailscale: `http://100.106.31.34:3489/mappability-review.html`

### 다음 단계 (사용자 결정 필요)
- v0.3: Type-A 200건 audit + text rule 정밀화 + C 그룹 trigger 키워드 확장
- 9f: 챗봇 통합 (마법사에 mappability·confidence·tier 표시) — 별도 plan 가능
- 외부 cohort 확보 (수도권 데이터)

---

## [2026-04-26] Phase 9a (draft): v0.2 매핑성 매트릭스 1차 초안 — 임상 정합성 reframe

> v0.1 보고서의 "sensitivity 39.4% → 임상 활용 불가" framing이 임상 자문자(응급의학 전문의) 의견에 따라 reframe됨. 통계 sensitivity 임계 폐기, 임상 정합성 + 모순 검출 우선. 1 commit (draft).

### 변경 동기 (사용자 의견 반영)
- Pre-KTAS + 0–3 질문은 현장 정보의 본질적 한계가 큰 input. 통계로 sens 0.70 강제는 임상 현실과 맞지 않음.
- **명확한 case만 Y코드 매핑, 모호한 case는 tier만 권고**가 임상적으로 옳음.
- 코드만으로 잘 매핑: 심근경색·정신과·내시경·산과
- 코드로 매핑 불가: 담낭/담도 (이미지 전 구별 불가), 투석 (secondary 적응)
- 광주·전라 데이터는 검증 안 됨 (수십% 오류 가능). 통계는 directional probe, 결정 X.
- LLM은 ground truth 결정자 X, 최종 병원 선택자 (Phase 6 흐름 유지).

### Plan
- 새 plan: `~/.claude/plans/mighty-herding-sutton.md` (Phase 9: v0.2 reframe)
- Sub-phases: 9a 매트릭스 초안 → 9b 자문자 검토 → 9c 알고리즘 → 9d 모순 검출 → 9e 보고서·페이지 → 9f 챗봇 통합(선택)

### Added (Phase 9a 1차 초안)
- **`research/y-code-mappability-matrix.json`** v1.0-draft (~290 lines, awaiting_consultant_review)
  - 27 Y코드 × A/B/C 분류
    - **A (Confident)**: 12 — Y0010·Y0081·Y0082·Y0091·Y0092·Y0100·Y0111·Y0112·Y0120·Y0131·Y0132·Y0150
    - **B (Candidate)**: 7 — Y0020·Y0031·Y0032·Y0041·Y0042·Y0113·Y0160
    - **C (Tier-only)**: 8 — Y0051·Y0052·Y0060·Y0070·Y0141·Y0142·Y0171·Y0172
  - 각 Y코드 entry: group · rationale · trigger_pre_ktas · questions_needed · limitation · co_candidates · v01_issue · user_note
  - 그룹 정의 + 검증 framing + 데이터 caveat 명시
  - consultant_review_questions 8 항목 (B↔C 이동 후보, 각 그룹 적절성, over-trigger 좁히기, A/B 승격 가능성)
  - v0.2 알고리즘 출력 schema 명세 (mappability + y_candidates with confidence + tier_recommendation)

### 사용자 명시 의견 보존 (각 entry의 user_note field)
- Y0010 심근경색·Y0081/0082 내시경·Y0111/0112 산과·Y0150 정신과 → A (사용자 명시 "코드만으로 잘 매핑")
- Y0051/0052 담낭/담도 → C (사용자 명시 "이미지 전 구별 불가")
- Y0141/0142 응급투석 → C (사용자 명시 추측 "다른 primary focus의 secondary, dialysis-specific Pre-KTAS 코드 부재")

### Pending
- **9b 자문자 검토** (사용자 응답 대기)
- 검토 후 v1.0 frozen → 9c v0.2 알고리즘 구현 → 9d 모순 검출 → 9e 보고서·페이지 reframe

### Review (Pre-Landing Audit, post-merge)
- Quality Score: **8.5/10** (4 informational, 0 critical)
- INFO: 자문자 검토 대기 상태 (status="awaiting_consultant_review" 명시)
- INFO: 사용자 명시 의견과 maintainer 추론이 user_note로 구분 가능 (추적성)
- INFO: A 12 · B 7 · C 8 — 27개 모두 분류, 누락 없음
- INFO: consultant_review_questions 8 항목이 적절한 분량 (~30분 검토)

---

## [2026-04-26] Phase 8b–i 완료: v0.1 진단정확도 검증 결과 (H1 FAIL, H2 PASS)

> 응급의학 전문의가 잠자러 가면서 "남은 모든 작업 자동 진행" 지시 ("loopy" 명령). Phase 8a-1 crosswalk 작성 후 Phase 8b–8i 통합 분석 완료. 3 commits.

### 변경 동기
- Phase 8a-2 frozen reference standard 동결 후 즉시 검증 단계 진입
- 사용자 부재 시간 활용 (자동화 가능 부분만 실행)
- v0.2 룰 개선(8h)은 임상 판단이 핵심이라 권고만 남기고 사용자 검토 대기

### Commits
| # | 작업 | Commit |
|---|---|---|
| 1 | Phase 8a-1 — Pre-KTAS 5자/6자 코드 crosswalk v1.0 | `f396343` |
| 2 | Phase 8b–i 통합 분석 — v0.1 검증 완료 | `8bcef0c` |

### 핵심 결과 (130,536 included visits, source-prektas.csv)
- **Sensitivity = 0.394** (95% CI 0.386–0.401) — H1 0.80 임계 **FAIL**
- **Specificity = 0.808** (95% CI 0.805–0.810) — H2 0.80 임계 **PASS**
- Oracle marginal gain = +0.000 — H3 FAIL (rule gap 본질 문제)
- F1 = 0.27, Balanced Acc = 0.60, κ = 0.16
- Severe prevalence = 11.19% (frozen multi-label cluster 효과)
- **임상 활용 불가 판정**. 60.6% under-triage.

### Added (Phase 8a-1)
- `research/prektas-code-crosswalk.json` — 5자(C/D prefix) ↔ 6자(A prefix + suffix 0/9) crosswalk
  * Pattern: `[A][L2][L3][L4_2chars][group_suffix]` → `[group_letter][L2][L3][L4_2chars]`
  * suffix 0=adult, 9=pediatric
  * mapped 1,843 / 3,106 unique codes (59.3%)
  * unmapped: codebook 부재 ~438, suffix 1/2/3 (의미 불명) 205

### Added (Phase 8b–i)
- `scripts/research/validate-phase8.py` — 통합 분석 (Python, single-pass 225k 행)
  * EUC-KR streaming via iconv
  * crosswalk + codebook lookup + ICD-10 multi-label 매칭
  * Wilson 95% CI, per-Y-code metrics
  * Stratified (region/age/grade)
  * Top FN/FP pattern 자동 추출
- `research/validation-results-v0.1.json` — primary metrics + 27 Y-code per-class
- `research/validation-stratified.json` — region/age/grade
- `research/validation-error-audit.json` — top 50 FN/FP patterns
- `research/prektas-validation-report-v1.0.md` — 9 섹션 최종 보고서

### 주요 발견
- **Rule absent (recall 0)**: Y0141 응급HD, Y0142 CRRT, Y0060 복부응급, Y0051 담낭
- **Massive over-trigger**: Y0032 뇌출혈 13,929 FP (신경계 카테고리 광범위 trigger)
- **Best**: Y0120 화상 (F1 0.60), Y0113 부인과 (F1 0.49)
- Grade 1 sensitivity 18.5% — 가장 위급한 환자의 80%가 unmapped
- 지역 일관성 ±5%p (광주·전남·전북 cohort)

### Changed
- `prektas-research.html` — Lede에 v1.0 결과 요약 (sens 39.4%, spec 80.8%) + 보고서 링크
- `scripts/build-research-page.mjs` — Lede 결과 반영 + 광주→광주·전남·전북 정정

### Phase 8h v0.2 권고 (보고서 §6)
- **Critical**: Y0141/0142/0060/0051 적응 룰 신규 작성 (recall 0)
- **High**: Y0032/0010/0041 over-trigger 좁히기
- **Medium**: Y0082·Y0020 recall 보강
- **목표**: v0.2 sens ≥ 0.70, spec ≥ 0.75

### 한계 (보고서 §7)
- 단일 cohort, retrospective (광주·전남·전북 편중)
- 27.5% 데이터 손실 (crosswalk + codebook 부재 + 진단 결측)
- Conditional include / clinical_split 미적용 (단순 prefix matching, Phase 8c+ 권고)
- Oracle 시뮬레이션은 best-case

### 배포
- main pushed: `8bcef0c`
- Vercel production: `https://119chat.emergency-info.com/prektas-research.html` (보고서 링크 포함)

### 사용자 깨어났을 때 검토 항목
- 보고서 §6 v0.2 권고 임상 검토
- 5/6자 crosswalk 미매핑 코드 (suffix 1/2/3, 205개) 임상 의미 자문
- v0.2 알고리즘 작성 진입 여부 결정

---

## [2026-04-25] Phase 8a-2 (consultation tool): 응급의학 전문의 자문 도구

> Phase 8a-2 ground truth 동결 작업을 효율화하는 web 자문 도구. 사용자가 응급의학 전문의 자격을 알리면서 자문 시작. 1 commit.

### 변경 동기
- Phase 8a-2: Y-code → ICD-10 cluster reference standard frozen 위해 응급의학 전문의 1인 임상 판단 필요
- 사용자 본인이 자문자라 즉시 실행 가능
- 효율적 작업 방식 4안 (markdown form / 대화형 Q&A / 개별 세션 / web 도구) 중 web 도구 선택
- 27 Y-code × 평균 8 ICD-10 = 216 코드 결정을 zero-default에서 하면 6+시간 소요 → prefill로 2-3시간 단축

### Commits
| # | 작업 | Commit |
|---|---|---|
| 1 | Phase 8a-2 응급의학 전문의 자문 도구 + research.html 링크 추가 | `c13f582` |

### Added
- **`prektas-consultation.html`** (49.4 KB, standalone single-file SPA)
  - 좌측 사이드바: 27 Y-code navigation + 진행률 표시 + section navigation
  - 본문 4 영역:
    1. **Welcome** — 자문 안내 + 시작 가이드
    2. **Y코드 27개** — 각 Y-code별 ICD-10 cluster + 임상 결정 + 자유 메모
    3. **가설 임계값** — H1-H4 4개 임계값 검토 + 변경 사유
    4. **Red flags** — Critical FN 시나리오 자유 추가
  - 각 Y-code 페이지 구성:
    * 사전 제안 ICD-10 후보 표 (default 체크 상태) — 응급의학 임상 통상 기준 prefill
    * 추가 ICD-10 코드 입력 (custom field)
    * 임상 결정 사항 radio button — Y-code별 protocol-flagged decisions:
      - Y0010 STEMI vs NSTEMI · Y0020 발병시각 · Y0031/0032 외상성 split
      - Y0041 vs Y0042 anatomic split · Y0051/0052 담낭염 strict
      - Y0060 췌장염 severity · Y0070·0082·0092·0172 영유아 cutoff
      - Y0120 BSA + 호흡기 화상 · Y0131/0132 부분 절단
      - Y0141 vs Y0142 ICD-blind · Y0150 자해 vs 정신증
      - Y0160 각막외상 · Y0171 PE · Y0172 영유아 (총 12+ decisions)
    * 자문 의견 자유 textarea
  - localStorage auto-save (key: `emris_consultation_v1`)
  - JSON export (다운로드 + 클립보드 복사)
  - 디자인: 매거진 스타일 (모노크롬 + accent 레드 + sharp corners)
  - 모바일 대응 (880px 미만 사이드바 하단 고정)
  - XSS 안전: `el()` helper + textContent + createElement (innerHTML 미사용)

### Changed
- **`scripts/build-research-page.mjs`** — 헤더·푸터 nav에 "전문의 자문 도구" 링크 추가
- **`prektas-research.html`** 재빌드 (자문 도구 링크 반영)

### Honest reporting 디자인
- Y0141/0142 등 ICD-10만으로 분류 불가한 케이스에 **"icd_blind" 옵션** 명시 제공
- 강제 분류 강요 없음 — 전문의가 정직한 답변 가능
- 모든 임상 결정에 default 옵션 + 자유 메모 병행 → prefill bias 최소화

### Review (Pre-Landing Audit, post-merge)
- Quality Score: **8.5/10** (3 informational, 0 critical)
- INFO: ICD-10 prefill 정확성은 사용자(전문의) 검토·수정으로 보완 ✓
- INFO: localStorage 단일 키 — 다중 사용자 out of scope (PoC 한 명 자문 시나리오)
- INFO: "icd_blind" honest reporting 옵션은 옳은 디자인 결정

### 배포
- main pushed: `c13f582`
- Vercel production: `https://119chat.emergency-info.com/prektas-consultation.html`
- prektas-research.html 헤더에서도 접근 가능

### 다음 단계
- 사용자(응급의학 전문의)가 자문 도구로 작업 → JSON export → maintainer에게 전달
- maintainer가 JSON → frozen `research/y-code-icd10-clusters.json`로 commit (Phase 8a-2 완료)
- Phase 8b (데이터 표준화) 자동 파이프라인 진입

---

## [2026-04-25] Phase 8 (protocol): Pre-KTAS 진단정확도 학술 검증 계획 v1.0

> Pre-KTAS + 0–3 질문 시스템이 정말 중증응급환자를 가려내는가? STARD 2015 준수 사전 등록 분석 계획. 1 commit.

### 변경 동기
- Phase 1-7 산출물(v0.1 룰 19% coverage)은 정확도 지표가 아님
- 응급의료 도메인에서 sensitivity·specificity 측정 없이 알고리즘 배포 불가
- `source-prektas.csv` 225,017 visits에 퇴실진단 ICD-10 ground truth 가용 → retrospective observational diagnostic accuracy study 가능
- 학술적 정합성 (사전 등록·동결된 분석 계획)으로 honest reporting 보장

### Commits
| # | 작업 | Commit |
|---|---|---|
| 1 | Phase 8 protocol v1.0 + research.html 전면 교체 | `6755041` |

### Added
- **`research/prektas-validation-protocol.md`** (437 lines) — 사전 등록된 분석 계획 (Protocol ID: PREKTAS-VAL-2026-001)
  - 4 가설: H1 sensitivity≥0.85, H2 specificity≥0.90, H3 한계효용≥0.03, H4 tier 일치≥0.70
  - Index test (frozen commit hash) ↔ Reference standard (Y-code → ICD-10 cluster, 응급의학 전문의 1인 자문)
  - Phase 8 sub-phases 11개 (8a-1 코드 crosswalk → 8a-2 ICD-10 cluster → 8b 표준화 → 8c 라벨링 → 8d 적용 → 8e-f 분석 → 8g audit → 8h v0.2 → 8i 보고 → 8j 재현성 패키지)
  - Sample size 정당화 (예상 TP ~11,250, primary endpoint CI 폭 ≤0.015)
  - Sensitivity analyses (cluster strict/inclusive, complete case vs imputation, bootstrap seed=20260425)
  - Threats to validity 표 + 완화책 (10 항목)
  - 윤리·재현성·한계 명시
- 1차 데이터 스캔 결과 (protocol에 사전 반영):
  - Total 225,017 visits, 99.2% 매칭률, 추정 severe prevalence ~5%
  - Y-code별 ICD-10 prefix 매칭 추정 표 (Y0010 심근경색 987건, Y0020 뇌경색 3,378건 등)

### Changed
- **`prektas-research.html` 전면 교체** — 기존 v0.1 룰 설명 페이지 → validation protocol 요약·시각화 페이지
  - 매거진 레이아웃 유지 (모노크롬 + accent 레드 + sharp corners)
  - 10 chapters: 배경 / 가설 카드 4개 / 설계 / 데이터 정합성 (5자↔6자 crosswalk 경고 ⚠) / 분석 계획 / 타당성 위협 표 / Phase 8 로드맵 / 재현성·윤리 / 한계 / 참고문헌
- **`scripts/build-research-page.mjs` 재작성** — protocol 요약 렌더 (codebook stats 일부 임베드)
- 본문 protocol markdown은 source of truth, HTML은 그 요약 시각화 임을 명시

### 데이터 정합성 핵심 발견 (Phase 8a-1 우선 격리)
- 정본 codebook: 5자 (예: `CAAAA`, group prefix C/D)
- 실측 CSV `최초KTAS분류과정`: 6자 (예: `AIACA0`, A prefix)
- 첫 글자 A=175,237/225,017 = **77.9%**
- → 두 코드 체계의 crosswalk(`research/prektas-code-crosswalk.json`)이 분석 전제 조건
- → protocol §4.6 + 페이지 §04 ⚠ 경고 박스로 명시
- → 분석을 시작한 뒤 발견했다면 표본 손실 + post-hoc bias로 이어질 risk를 사전 차단

### Review (Pre-Landing Audit, post-merge)
- Quality Score: **9/10** (3 informational, 0 critical)
- INFO: protocol markdown ↔ build-script content 동기화 — 둘 다 수정 시 누락 위험 (현재 PoC acceptable, KNOWLEDGE에 명시)
- INFO: 1차 prevalence는 ICD-10 prefix raw 추정. Final cluster 적용 후 재산출 예정 ✓
- INFO: 5자/6자 정합성 발견의 사전 격리는 honest reporting 위해 옳은 결정

### 배포
- main pushed: `6755041`
- Vercel production: `https://119chat.emergency-info.com/prektas-research.html` 마커 검증 완료
- protocol page는 STARD 2015 항목 (preregistered, frozen index test, frozen reference standard, sensitivity analyses, threats to validity, sample size justification) 모두 충족

### Out of Scope (다음 phase 진입 시 결정 필요)
- Phase 8a-1 5자/6자 crosswalk 작성 (자체 가능, ~1주)
- Phase 8a-2 응급의학 전문의 자문 섭외 (사람 자원, ~1-2주)
- Phase 8b-f 자동 분석 파이프라인 (코드 작업, ~1-2주)

---

## [2026-04-25] Phase 7: AI 모드 폴백 제거 + follow-up 컨텍스트 + 용어 통일 + 리본 UX

> Phase 6 직후 PoC 데모 피드백 라운드. 5개 atomic commits.

### 변경 동기
1. **AI 폴백이 사용자에게 잘못된 신뢰를 줌** — LLM 실패 시 클라이언트 룰 기반 결과로 조용히 떨어지면 응급의료 추천 도메인에서 위험.
2. **마법사로 받은 추천에 후속 질문 시 컨텍스트 끊김** — sendMessage가 새 검색으로 오인하여 "지역과 증상을 함께 말씀해주세요" 응답.
3. **기록 패널 클릭이 console.log만 찍고 동작 안 함** (TODO 상태).
4. **"마법사" 용어가 평가 도구 정체성을 흐림** — Pre-KTAS 코드북 결정론 평가이므로 도구명을 직설적으로.
5. **모바일에서 리본 좌우 끝 항목 접근성 부족** — 화살표·드래그 없음.

### Commits
| # | 작업 | Commit |
|---|---|---|
| 1 | 새 케이스 시 wizard reset + Y코드 매핑 → 평이 한국어 | `dd1dc9f` |
| 2 | AI 모드 폴백 제거 + 점증 backoff 재시도 + 에러 카드 | `ddbe35b` |
| 3 | follow-up 컨텍스트 보존 + 기록 패널 read-only 보기 | `a0ed5a3` |
| 4 | "마법사" → "Pre-KTAS" 용어 통일 (24+ 곳) | `7dd3739` |
| 5 | 리본 좌우 화살표·드래그 스크롤 + Pre-KTAS 평가 Level 표기 | `c363110` |

### Added
- `callLLMWithRetry(fetchFn, opts)` — 점증 gap [0, 1s, 3s, 5s, 10s] 4회 재시도 헬퍼. 401/403/429는 재시도 무의미하므로 즉시 반환. 5xx/network/parse는 재시도 대상.
- `renderLLMError({ error, onRetry })` — sharp corners + accent 좌측 보더, 한국어 라벨, `<details>` 진단 정보 (kind/HTTP status/message), "🔄 다시 시도" 버튼.
- `llmErrorLabel(kind)` — auth/rate_limit/network/parse/5xx/4xx/unknown 한국어 매핑.
- `HARNESS_FOLLOWUP_PROMPT` — 직전 환자 컨텍스트·추천 존중하는 평문 한국어 follow-up 시스템 프롬프트. 인근 시도/권역 인접 광역 안내 + 재조회 필요 명시 + Y코드 노출 금지.
- `runFollowUp(text)` — 활성 케이스 messages를 LLM contents로 직렬화. 에러 카드 메시지 prefix 필터링으로 잡음 제거.
- `viewCaseReadOnly(caseObj)` — drawer 닫고 chat 영역 메시지 리플레이 + 케이스 헤더 배너 + 마감 케이스 안내 노트.
- `enhanceRibbonScroll(rowEl)` — `.ribbon-wrap` 컨테이너 + `.ribbon-arrow` 좌·우 오버레이 + pointerdown/move/up 드래그 + 드래그 후 단발 click suppress.
- CSS: `.llm-error-card`, `.ribbon-wrap`, `.ribbon-arrow`, `.ribbon-row.dragging`.

### Changed
- AI 디폴트 ON 명시화: `localStorage.getItem('emris_ai') === null ? true : ...` (line 1195).
- `parseWithLLM` — `keywordFallback` 폴백 제거. 실패 시 `{ _llmError, kind, status, message }` 반환. 호출자(sendMessage)에서 에러 카드 + retry 버튼.
- `interpretWithHarness` — null 반환 → `_llmError`/`_rateLimit` 반환. `searchAndShow` LLM 분기 폴백을 `renderLLMError`로 교체. AI OFF 분기는 사용자 명시 선택이므로 본래 룰 기반 동작 유지.
- `renderRateLimitChoice` — "AI 미사용 답변" 버튼 제거. "🔄 AI 재시도"만 노출. `prektasContext` 인자 추가하여 마법사 모드 follow-up retry 정확화.
- `sendMessage` — 활성 케이스에 `hospitals_snapshot` + `messages.length > 1` 있고 keywordFallback 미스 시 `runFollowUp` 호출하여 새 검색 흐름 우회.
- 헤더 입력 모드 토글: "📋 Pre-KTAS 마법사" → "📋 Pre-KTAS".
- 케이스 시작 메시지: "📋 마법사 평가 — CIHAD · 실신/전실신 / 쇼크" → "📋 Pre-KTAS 평가 — CIHAD (Level 2) · 실신/전실신 / 쇼크".
- prektas_review UI 라벨 한국어화: "🔍 Y코드 매핑 검토" → "🔍 중증 응급질환 여부 판정". "AI 제안 Y코드" → "AI 추가 진단 후보". "🔄 이 Y코드로 추가 조회" → "🔄 추가 진단 포함하여 다시 조회".
- LLM 시스템 프롬프트(임무 A): comment 출력에 Y코드 미노출 명시. "현재 판정이 적절합니다" / "현재 판정 외에도 [추가 진단]이 적절할 수 있습니다 — [임상 근거]" 패턴.

### Fixed
- 새 케이스 버튼이 마법사 첫 단계까지 reset하도록 `WizardController.reset()` 호출 추가. `window.WizardController` 전역 노출.
- 기록 패널 케이스 항목 클릭 시 `console.log` → `viewCaseReadOnly(c)` 호출.

### Review (Pre-Landing Audit, post-merge)
- Quality Score: **8.5/10** (3 informational, 0 critical).
- INFO: `runFollowUp` lacks generation token (rapid follow-ups could arrive out-of-order via retry button) — confidence 7/10. PoC acceptable.
- INFO: `buildFollowUpMessages` 에러 카드 prefix 필터 의존 — confidence 6/10. 강건성 위해 `_synthetic: true` 메타 마커가 더 깔끔.
- INFO: `viewCaseReadOnly` 활성 케이스 모호성 — confidence 8/10. 배너 안내로 mitigated. PoC 범위 외.
- XSS / localStorage / 드래그 충돌 처리: 모두 안전.

### 배포
- main pushed: `dd1dc9f` → `c363110` (5 commits)
- Vercel production deployed: `https://119chat.emergency-info.com` 에 모든 마커 반영 확인

---

## [2026-04-25] Phase 6 (완료): 챗봇 통합 — Pre-KTAS 마법사를 챗봇 입력 모드로 흡수

> 16단계 대규모 리팩터 **전부 완료**. 자세한 plan: `~/.claude/plans/mighty-herding-sutton.md`.

### 핵심 통합
- **두 입력 경로가 한 챗봇에서 합류**:
  - 자유 채팅: 자유 텍스트 → LLM 파싱(HARNESS_PARSE_PROMPT, 1회) → EMRIS 조회 → LLM 추천(1회).
  - 마법사: 결정론 4단계(group/L2/L3/L4) + 추가 질문 narrowing → EMRIS 조회 → LLM 추천+Y코드 검토(1회).
- **LLM 중복 호출 제거**: 추천·설명 단계에서만 호출. 마법사가 룰 기반 결과를 LLM에 ground truth로 넘김. LLM은 4임무 동시 수행 (Y코드 검토 / 자원 요건 / 병원 추천 / 후속 가이드).
- **케이스 기반 history**: localStorage에 case 단위 보존. 새 케이스, 기록 drawer, follow-up Q&A 컨텍스트 보존.
- **동시 접속자 독립**: PoC 데모용 — 각 브라우저 독립 localStorage. 동기화 없음.

### Step별 commits
| # | 작업 | Commit |
|---|---|---|
| 1 | 디자인 토큰 layer | `b8402c4` |
| 2 | 디자인 갱신 (모노크롬+sharp) | `4ac33a8` |
| 3 | CaseStore localStorage 모듈 | `747e326` |
| 4 | 헤더 [새 케이스] [기록] + drawer | `df3ffbc` |
| 5 | sendMessage ↔ CaseStore | `339a072` |
| 6 | 입력 모드 토글 | `a266208` |
| 7 | 마법사 inline 통합 + 페이로드 빌더 | `2f948ee` |
| 8 | 합류 함수 runCaseFromInput | `6f2aafd` |
| 9 | LLM 4임무 prompt addendum | `45915d2` |
| 10 | LLM 페이로드 빌더 (Step 8 통합) | — |
| 11 | prektas_review 카드 렌더 | `0119a91` |
| 12 | Override 재조회 버튼 | `325698f` |
| 13 | Follow-up Q&A (CaseStore 자동) | — |
| 14 | recommender 교육·연구용 라벨 | `497df67` |
| 15 | e2e 시나리오 문서 | (이 commit) |
| 16 | docs wrap | (이 commit) |

### Added
- `lib/chatbot-payload.js` — 정본 데이터 페이로드 (codebook 4,689 + Y매핑 + tier + question effects). 671KB.
- `scripts/build-chatbot-payload.mjs` — 페이로드 빌드 스크립트.
- `public/chatbot.html`, `public/lib` — dev 서버용 심볼릭 링크.
- `ui-audit/phase6-e2e-scenarios.md` — 7개 통합 테스트 시나리오 (자유 채팅 회귀, 마법사 단독, override 재조회, follow-up, 새 케이스, 다중 브라우저, 모바일).

### Changed
- `index.html` 2,320 → ~3,200 lines:
  - CSS: 디자인 토큰 v2 + 마법사 인라인 컴포넌트 + drawer + prektas_review 카드.
  - JS: CaseStore 모듈 + WizardController IIFE + 합류 함수 + 입력 모드 토글 + override 재조회.
- `index.html`의 `HARNESS_INTERPRET_PROMPT`에 마법사 4임무 addendum 추가 (조건부, prektas_context 있을 때만).
- `searchAndShow(queryText, region, diseases, prektasContext?)` — 4번째 optional 인자 추가, 기존 5개 호출자 무영향.
- `interpretWithHarness(apiData, userText, prektasContext?)` — LLM prompt JSON에 prektas_context inject.
- `prektas-hospital-recommender.html` 헤더 위에 "📚 교육·연구용" 배너 + 챗봇 링크.
- `package.json` — `build:chatbot-payload`, `build:all` scripts.

### Out of Scope (다음 phase)
- v0.2 mapping rule 개선 (Y0010 단독 분기 등).
- false negative rate 측정 (`source-prektas.csv` 225k 실측).
- 응급의학 전문의 임상 리뷰.
- prektas-hospital-recommender 완전 deprecate (현재 교육용 보존).



### Context
- PoC. 데모 동시 접속자 간 동기화 없음 (각 브라우저 localStorage 독립).
- LLM 중복 호출 방지: 추천·설명 단계에서만 LLM (마법사 모드는 1회, 자유 채팅은 파싱+추천 2회).
- 마법사 모드는 LLM에게 룰 기반 Y코드 매핑 검토 임무 동시 부여 (4임무 통합 프롬프트).
- 케이스 모델 + 새 케이스 + 기록 + in-session follow-up.
- 디자인 갱신 (마법사 v1.1과 시각 통일).

### Step 1 — 디자인 토큰 layer (`b8402c4`)
- `index.html` `:root`에 v2 디자인 토큰 추가: color/spacing/radius/font/transition.
- 레거시 변수 보존 (회귀 위험 0).

### Step 2 — 디자인 갱신 (`4ac33a8`)
- 레거시 변수를 v2 토큰으로 alias 매핑 (값만 swap).
- 모노크롬 + 빨간 accent + sharp corners (Python regex로 모든 border-radius sweep).
- AI 토글, ribbon-btn, badge, hospital-card 등 컴포넌트 톤 통일.
- `body` font-family를 `var(--t-font-sans)` (Pretendard 우선)로 변경.
- `public/chatbot.html` 심볼릭 링크 추가 (dev 서버 테스트용).

### Step 3 — CaseStore 모듈 (`747e326`)
- localStorage 기반 케이스 저장소: list/get/getActive/startNew/appendMessage/updateActive/closeActive/remove/_wipe.
- Storage: `emris_cases_v1` (배열), `emris_active_case_id` (문자열).
- 50건 cap, FIFO eviction (closed case부터).
- smoke test: startNew → append × 3 → update → 두번째 startNew (자동 archive) → list (최신순) → closeActive 모두 정상.
- 챗봇은 아직 미사용 (Step 5에서 sendMessage에 연결).

### Out of Scope (Phase 6 종료까지)
- v0.2 mapping rule 개선 (Y0010 단독 분기) — 별도 phase
- false negative rate 측정 (`source-prektas.csv`) — 별도 phase
- 응급의학 전문의 임상 리뷰

## [2026-04-24] Phase 5.3: 로컬 서버 3489 + prektas 전용 라우팅 격리

### Added
- `run.sh` 재작성 (이전 3344 + 삭제된 `prektas-research-*` 파일 참조였음). 포트 **3489**로 변경. `{start|stop|restart}` 서브커맨드 유지. 필요 시 `npm run build:html` 자동 실행.
- `public/` 디렉토리 + 심볼릭 링크:
  - `public/index.html` → `../prektas-hospital-recommender.html`
  - `public/research.html` → `../prektas-research.html`
- `python3 -m http.server --directory public`로 서빙. 결과: `GET /` → 추천 도구 직접 진입, `GET /research.html` → 연구 설명.

### Why
- 루트 `index.html`은 기존 Gemini 챗봇 UI이며 prektas 연구와 **별개 서비스**. 같은 디렉토리를 서빙하면 `/`로 접근 시 챗봇이 먼저 열려 혼동 발생.
- 빌드 산출물(`prektas-*.html`)은 루트에 유지해 Vercel 배포·git 추적 보존. 심볼릭 링크로 서빙 경로만 격리.

### Paths
- Tailscale: `http://100.106.31.34:3489/` (추천 도구), `/research.html` (연구 설명)
- Local: `http://127.0.0.1:3489/`

## [2026-04-24] Phase 5.2: Stage 1 정본 카운트 명시 + Stage 2 추론 근거 대폭 강화

### Changed
- `scripts/build-hospital-recommender.mjs` Stage 1 prompts: "정본 Pre-KTAS N개 카테고리" 등 filter 근거 명시. 327개 (group, l2, l3) 조합 × 평균 14.3개 L4 (min 1, max 37) — 이론치 676 대비 극히 제한적임이 실측 확인됨.
- Stage 2 대폭 개편:
  - 상단 context-card: Pre-KTAS 코드 · grade · level 경로 + 초기 Y후보를 **한글 질환명과 함께** 나열 (제거된 건 dimmed).
  - 질문 옵션 버튼마다 narrowing preview: 선택 전 "→ Y후보 N개 생존: 심근경색 · 흉부대동맥" 미리보기 (simulateNarrow).
  - 하단 sticky preview에 rationale 서술: "초기 Y후보 3개 → 답변으로 Y0020/Y0031 제외 → 생존 Y0032 권역 전용".

## [2026-04-24] Phase 5.1: 추천 도구 모바일 스텝 마법사 재작성 + live tier narrowing + mock 병원

### Changed
- `scripts/build-hospital-recommender.mjs` 전면 재작성. 데스크톱 2단 레이아웃 → **모바일 우선 3단계 스텝 마법사**. 큰 터치 타겟, sticky header `[← 이전] · 단계 · [↺ 처음]` + 누적 코드 스트립, 스크롤 최소화.
  - Stage 1 (Pre-KTAS 입력): 연령 2버튼 → 대분류 17버튼(2열) → 3단계 버튼(2열) → 4단계 버튼(1열, grade 표시). 선택 즉시 다음 sub-step 이동.
  - Stage 2 (추가 질문 + live tier): 질문 1개씩 순차 표시. 선택 시 **즉시 후보 Y코드 필터링·tier 재계산**. 하단 sticky preview에 tier 이름·acceptable·Y pills(제거된 건 취소선) 실시간 표시. 질문 skip 가능, 답변 중 변경 시 재render.
  - Stage 3 (병원 추천): 지역 그리드(mock 17개 시도) → 병원 카드 리스트. tier preference × Y코드 커버 수 × 거리 기반 스코어링. 1위 "가장 적합" 배지.
- `prektas-hospital-recommender.html` 재빌드 — 2.4MB → **890KB** (entries payload 압축).

### Added
- `data/mock-hospitals.json` — 20개 mock 병원 (권역 7 · 지역센터 8 · 지역기관 3 + 기타). 실제 병원명 + mock tier/거리/Y코드 지원.
- Question effects (build script inline) — 각 질문 옵션이 후보 Y코드를 어떻게 좁히는지 정의 (`y_keep` / `y_remove`). 예: `chest_pain_character` "압박성" → Y0010만, "찢어지듯" → Y0041/Y0042만.

### Key UX Improvement
- 이전: 질문 답변이 "기록만" 되고 추천 tier에 영향 없음.
- 이후: 답변이 **실제로 후보를 줄이고 tier를 바꿈**. "답변 전 권역 → 답변 후 지역센터" 같은 전환이 화면에서 즉시 보임.

### Out of Scope
- 실제 EMRIS 데이터 연동 (`emris-data/devdocs/hospitals.json` 410개) — Phase 6.
- 실시간 병상 정보 (messages.json) — Phase 6.

## [2026-04-24] Phase 5: standalone HTML — 병원 추천 도구 + 연구 설명

### Added
- `scripts/build-hospital-recommender.mjs` — 정본 JSON 4개(codebook·mapping·tier·y-codes)를 embed한 standalone 추천 도구 생성기. 외부 의존 없음.
- `scripts/build-research-page.mjs` — 연구 배경·방법·한계 설명 매거진 레이아웃 HTML 생성기.
- `prektas-hospital-recommender.html` (2.4MB, 빌드 산출) — 구급대원용 프로토타입. 단계별 selector(연령→대분류→3단계→4단계) 또는 5자 코드 직접 입력 → tier 카드 + Y후보 + rationale + safety note.
- `prektas-research.html` (12KB, 빌드 산출) — 7섹션 서술형 연구 노트. 마스트헤드, 드롭캡, pull quote, 데이터 파이프라인 ASCII 다이어그램. CLAUDE.md 기본 디자인 가이드라인 준수(모노크롬 + 단일 accent, grotesque sans-serif, 매거진 레이아웃, sharp corners).

### Changed
- `package.json` — `build:html:recommender`, `build:html:research`, `build:html` 3개 scripts 추가.

### Security
- 생성 HTML의 XSS 방어:
  - embed JSON payload는 `.replace(/</g, '\\u003c')` 후처리로 `</script>` 시퀀스 차단.
  - runtime DOM 조작은 `textContent` 및 `createElement` 기반. 사용자 입력 코드는 `/^[A-Z]{5}$/` whitelist.

### Out of Scope
- 실병원 목록·실시간 병상 데이터 통합 — Phase 6.
- v0.2 mapping rule 개선 — 이후.
- 응급의학 전문의 임상 리뷰.

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

