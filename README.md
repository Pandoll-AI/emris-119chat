# EMRIS 119 응급실 안내 챗봇

119구급대원을 위한 실시간 응급실 병상·질환 대응 현황 안내 챗봇.

**배포 URL**: https://119chat.emergency-info.com

---

## 단순 나열이 아닌, 판단을 하는 시스템

단순히 병상 정보를 나열하는 것에서 벗어나, 구급대원의 판단 로직을 시스템에 심었습니다.

**진단이 불확실할 때, 놓치지 않습니다.**
기도에 걸렸는지 식도에 걸렸는지 모르면 기관지·위장관 내시경 가능 병원을 동시에 찾아, 둘 다 되는 곳을 우선 추천합니다.

**한 병원이 못하면, 두 병원을 엮습니다.**
제주에서 분만은 가능하지만 신생아 중환자실이 없으면, "서귀포의료원에서 제왕절개, 제주한라병원으로 NICU 전원" 연계 이송 시나리오를 제안합니다.

**"가용"이라고 다 같은 가용이 아닙니다.**
시스템은 가용이라고 표시하지만 "본원 환자만", "사전문의 필요" 같은 조건이 숨어 있습니다. 이 조건을 자동으로 찾아내 실질적인 수용 가능 여부를 재판정합니다.

**0곳이면, 다음 행동을 알려줍니다.**
대전에서 화상 전문기관이 0곳이면 "없습니다"로 끝나지 않습니다. 인접 광역권(충남, 충북, 세종)을 안내하고 헬기 이송 검토를 권고합니다.

**1곳뿐이면, 백업을 준비합니다.**
울산에서 안과 응급수술이 가능한 곳이 단 1곳이면, "유일 기관"임을 경고하고 수용 불가 시 부산으로 전환하라는 백업 경로를 함께 제시합니다.

**골든타임 질환은, 다르게 대합니다.**
심근경색 90분, 뇌출혈 분 단위, 사지접합 6시간. 시간이 생명인 질환은 선택지를 압축하고, 이동 중 병원에 무엇을 준비시킬지까지 안내합니다.

**미보고와 미보유를 구분합니다.**
시스템에 등록하지 않은 것과 역량이 없는 것은 다릅니다. 권역급 대형병원이 미보고 상태라면, 역량 보유 가능성이 높다고 판단하고 직접 전화 확인을 권고합니다.

---

## 두 가지 모드

### AI OFF (기본, ~1초)

키워드 매칭 → EMRIS API → 클라이언트 HARNESS 분석 엔진 → 즉시 결과.
LLM 호출 0회. 13개 의사결정 패턴을 클라이언트 JavaScript로 실행 (0.016ms).

### AI ON (~5초)

Gemini Flash Lite가 HARNESS 13개 패턴을 시스템 프롬프트로 받아, 질환별 맞춤 표 구조를 자유롭게 생성.
분만 조회 시 `병원|판정|분만|산과수술`, 뇌출혈 시 `병원|판정|거미막하|뇌내출혈` 등 매번 다른 표.
추천, 시사점, 연계이송 시나리오까지 포함.

---

## 파일 구조

```
emris-119chat/
├── index.html       # 단일 파일 SPA (~2200줄)
│                     #   HARNESS 분석 엔진 (13패턴 클라이언트 JS)
│                     #   적응형 테이블 렌더링 (AI ON)
│                     #   스마트 카드 렌더링 (AI OFF)
├── api/
│   └── llm.js       # Vercel serverless — Gemini REST API 프록시
├── vercel.json      # SPA 라우팅 + maxDuration 30
└── test-llm.mjs     # LLM 엔드포인트 테스트 스크립트
```

---

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `GEMINI_API_KEY` | Y | Google Gemini API 키 (기본) |
| `GEMINI_API_KEY_1` ~ `_10` | | 추가 키 (랜덤 라우팅으로 rate limit 분산) |
| `GEMINI_API_MODEL` | | 모델명 (기본: `gemini-2.5-flash-lite`) |
| `EMRIS_API_KEY` | Y | 프록시 접근 토큰 (클라이언트 인증) |

---

## 로컬 개발

Vercel CLI로 로컬에서 실행:

```bash
# 환경 변수 설정
cp .env.example .env  # GEMINI_API_KEY, EMRIS_API_KEY 입력

# Vercel 로컬 개발 서버
vercel dev
```

LLM 엔드포인트 테스트:

```bash
node test-llm.mjs
```

---

## 배포

```bash
vercel --prod
```

Vercel 프로젝트: `chatbot` (프로젝트 ID: `prj_hDWc8p0ps4C8n6NfdTKJoBP1rd0w`)
커스텀 도메인: `119chat.emergency-info.com`

---

## 아키텍처

```
사용자 입력
    │
    ├─ AI OFF ──────────────────────────────────────
    │   keywordFallback()         ← 내장 키워드 맵 (즉시)
    │       │
    │       ▼
    │   EMRIS Worker /query       ← 실시간 병상+질환 데이터
    │       │
    │       ▼
    │   analyzeResults()          ← HARNESS 13패턴 (0.016ms)
    │       │                        교차검증, 골든타임, 에스컬레이션,
    │       │                        연계이송, 등급 필터, 데이터 품질...
    │       ▼
    │   renderSmartResult()       ← 카드 레이아웃 즉시 표시
    │
    ├─ AI ON ───────────────────────────────────────
    │   keywordFallback()         ← 키워드 우선
    │   parseWithLLM() fallback   ← 실패 시 Gemini 파싱 (HARNESS 프롬프트)
    │       │
    │       ▼
    │   EMRIS Worker /query
    │       │
    │       ▼
    │   interpretWithHarness()    ← Gemini + HARNESS 시스템 프롬프트
    │       │                        질환별 맞춤 표 구조 생성
    │       ▼
    │   renderAdaptiveResult()    ← 적응형 테이블 + 추천 + 시사점
    │
    └─ 429 Rate Limit ──────────────────────────────
        "LLM 리밋입니다. 1분 안에 복구될 가능성이 높습니다."
        [AI 미사용 답변]  [AI 재시도]
```

---

## 의존성

외부 라이브러리 없음. 순수 HTML/CSS/JS 단일 파일.

| 항목 | 값 |
|------|-----|
| 런타임 | 브라우저 |
| 배포 | Vercel (Serverless Function) |
| API | EMRIS Worker (`emris-crawler.pandoll-ai.workers.dev`) |
| LLM | Google Gemini (`gemini-2.5-flash-lite`) |
| HARNESS | 13개 의사결정 패턴 (클라이언트 JS 내장) |

---

## 관련 프로젝트

| 프로젝트 | 설명 |
|----------|------|
| [emris-data](https://github.com/Pandoll-AI/emris-data) | EMRIS 데이터 수집·가공 파이프라인 + Worker API |
