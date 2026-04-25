# Phase 6 통합 e2e 테스트 시나리오

비밀번호 인증 + EMRIS API 토큰이 필요하므로 자동화는 제한적. 데모 환경에서 manual 진행 권장.

## 환경 준비

```bash
./run.sh restart
# Tailscale: http://100.106.31.34:3489/chatbot.html
# 또는 Vercel 배포 URL의 / 진입
```

비밀번호 입력 (구급대원 전용 access code).

## Scenario 1: 자유 채팅 회귀 (Phase 5 이전 동작 보존)

1. AI 토글 ON.
2. "대구 심근경색" 입력 → 전송.
3. **확인**: 기존 chat bubble UI + 적응형 결과 표 + 추천 narrative.
4. **회귀 확인**: prektas_review 카드 미표시 (자유 채팅은 prektas_context 없음).
5. drawer 열기 → "대구 심근경색" 케이스 1건 (CHAT, 진행 중).

**기대**: 회귀 0건. Phase 1–5의 모든 동작 그대로.

---

## Scenario 2: 마법사 모드 단독 (LLM 1회 호출)

1. 입력 토글 → "📋 Pre-KTAS 마법사".
2. 성인 → 심혈관계 → 흉통(심장성) → AA 중증 호흡곤란 (CICAA · g1).
3. 첫 질문 "흉통의 특성" → "조이듯이 압박성".
4. 두번째 질문 "대동맥 응급 의심 부위" → "흉부".
5. live preview "권역응급의료센터 + 지역센터 가능" 확인.
6. "병원 추천 받기 →" → submit stage.
7. 지역 "서울" 선택 → "병원 추천 시작 →".
8. **확인**:
   - 자유 채팅 모드로 자동 전환.
   - "📋 마법사 평가 — CICAA · 흉통(심장성) / 중증 호흡곤란" user bubble.
   - region ribbon "서울" active.
   - bot loading → 적응형 결과 표 + recommendation.
   - **prektas_review 카드 표시** (verdict='appropriate' 또는 'needs_revision').
9. drawer 열기 → 케이스 1건 (WIZARD 칩, 진행 중, 코드+증상 summary).

**기대**: LLM 호출 1회 (HARNESS_INTERPRET_PROMPT 4임무). prektas_context 페이로드 포함.

---

## Scenario 3: Override 재조회

1. 마법사 → 룰 빈틈이 있을 케이스 진행 (예: 패혈증 의증 g1):
   - 성인 → 물질오용 → 물질오용/중독 → AJ 패혈증 의증.
2. 추가 질문 0개 (ruleEngine이 이 케이스에 catalog 매칭 없음 가능).
3. submit → 서울 → 병원 추천 시작.
4. **확인**: prektas_review가 needs_revision + suggested_y_codes (예: Y0091) + "🔄 이 Y코드로 추가 조회" 버튼 활성.
5. 버튼 클릭 → "🔄 LLM 제안 Y코드 추가 조회: ..." user bubble + 새 결과.

**기대**: EMRIS 재조회 + LLM 2회째 호출 (사용자 명시 트리거). 기존 결과는 conversation에 보존.

---

## Scenario 4: Follow-up Q&A 컨텍스트 보존

1. 마법사 평가 완료 후 자유 채팅 모드 유지.
2. user 입력: "지역센터로 가도 안전한가?".
3. **확인**: LLM이 직전 case 컨텍스트 + ground truth 알고 답변. acceptable 범위 좁히지 않음.
4. drawer → 같은 케이스, messages 누적 (system prompt + 마법사 user + 첫 assistant + follow-up user + 두번째 assistant).

**기대**: 한 case 안에서 follow-up이 자연스럽게 이어짐.

---

## Scenario 5: 새 케이스 + 기록

1. 헤더 [🆕 새 케이스] 클릭.
2. 진행 중 케이스 있으면 confirm 다이얼로그 → "확인".
3. **확인**: chat 영역 비워짐 + 환영 메시지 + active case null.
4. 새 자유 채팅 또는 마법사 진행.
5. drawer → 직전 케이스 "마감", 새 케이스 "진행 중".
6. 직전 케이스 클릭 → console.log (Step 5+ TODO: read-only chat 보기).

**기대**: 케이스 archive 정상. localStorage에 보존.

---

## Scenario 6: 다중 브라우저 독립성 (PoC 데모)

1. 브라우저 A: 비밀번호 입력 → 마법사 평가 1건.
2. 브라우저 B (incognito): 비밀번호 입력 → 자유 채팅 1건.
3. **확인**: 양쪽 drawer가 각자 1건만 표시. 동기화 없음.

**기대**: 데모 동시 접속자 간 독립 history.

---

## Scenario 7: 모바일 반응형 (375px)

1. dev tools에서 viewport 375×812.
2. 마법사 진입 → 단계별 큰 터치 타겟 확인 (44px+).
3. 가로 스크롤 없음.
4. drawer 열림 (좌측 슬라이드).

**기대**: 마법사 v1.1 디자인 통일된 터치 UX.

---

## 회귀 점검표 (Phase 5 이전 기능)

- [ ] 비밀번호 모달 정상 작동
- [ ] AI 토글 ON/OFF 토글 + localStorage 저장
- [ ] region·disease ribbon 클릭 → searchAndShow 호출
- [ ] 추천 쿼리 chip 클릭 → 자동 입력
- [ ] LLM rate-limit (429) 시 fallback UI
- [ ] LLM 실패 시 클라이언트 HARNESS fallback
- [ ] 결과 표 (적응형 헤더, 등급 태그, conditional 마크)
- [ ] 인접 지역 안내, 골든타임 alert
