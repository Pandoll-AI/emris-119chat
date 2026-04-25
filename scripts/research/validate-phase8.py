#!/usr/bin/env python3
"""
Phase 8 통합 검증 스크립트 (Phase 8b-e+f)
─────────────────────────────────────────────
입력:
  - source-prektas.csv (외부, EUC-KR, 225,017 rows)
  - data/prektas-codebook.json (정본 codebook v2.0.0)
  - research/prektas-to-y-mapping.json (v0.1 룰 매핑)
  - research/y-code-icd10-clusters.json (frozen reference standard v1.0)
  - research/prektas-code-crosswalk.json (5자/6자 crosswalk)

출력:
  - research/validation-results-v0.1.json (per-Y-code metrics + 이항 sensitivity·specificity 95% Wilson CI)
  - research/validation-stratified.json (region/age/grade stratified)
  - research/validation-error-audit.json (top FN/FP patterns)

사전 등록 protocol: PREKTAS-VAL-2026-001 v1.1
"""
import json
import math
import os
import re
import subprocess
import sys
from collections import defaultdict, Counter

REPO_ROOT = '/Users/sjlee/Projects/emris-119chat'
CSV_PATH = '/Users/sjlee/Projects/prektas-research/source-prektas.csv'

# ─────────── Load reference data ───────────
def load_json(p):
    with open(os.path.join(REPO_ROOT, p), 'r', encoding='utf-8') as f:
        return json.load(f)

print('[1/7] Loading reference data...', file=sys.stderr)
codebook = load_json('data/prektas-codebook.json')
mapping = load_json('research/prektas-to-y-mapping.json')
clusters = load_json('research/y-code-icd10-clusters.json')
crosswalk = load_json('research/prektas-code-crosswalk.json')

CODE_TO_ENTRY = {e['code']: e for e in codebook['entries']}
CODE_TO_MAPPING = {m['code']: m for m in mapping['mappings']}
CW_MAP = crosswalk['mappings']

# Build ICD-10 → Y-code lookup from frozen clusters
def expand_icd10_pattern(pat):
    """Expand .x suffix or X-Y range or exact."""
    if '-' in pat and not pat.startswith(('S','T','I','K','F','O','N','H','E','R','A','P','Q','D','M','Z','X','Y','J','G','C','B')):
        return [pat]  # not a range
    if pat.endswith('.x'):
        prefix = pat[:-2]  # e.g. 'T17'
        return [f'{prefix}.{i}' for i in '0123456789'] + [prefix]  # also bare prefix
    if re.match(r'^[A-Z][0-9]+-[A-Z][0-9]+$', pat):
        # e.g. X60-X84
        m = re.match(r'^([A-Z])([0-9]+)-([A-Z])([0-9]+)$', pat)
        L, a, R, b = m.group(1), int(m.group(2)), m.group(3), int(m.group(4))
        if L != R: return [pat]
        return [f'{L}{i:02d}' for i in range(a, b+1)] + [f'{L}{i:02d}.{j}' for i in range(a,b+1) for j in '0123456789']
    return [pat]

ICD_TO_YCODES = defaultdict(set)  # icd_prefix → set of Y-codes (multi-label)
ICD_CONDITIONAL = defaultdict(list)  # icd → list of {ycode, key, reason}
for ycode, info in clusters['y_codes'].items():
    for icd_pat in info.get('include', []):
        for icd in expand_icd10_pattern(icd_pat):
            ICD_TO_YCODES[icd].add(ycode)
    for cond in info.get('conditional_include', []):
        for icd in expand_icd10_pattern(cond['code']):
            ICD_CONDITIONAL[icd].append({
                'ycode': ycode, 'key': cond.get('key',''), 'reason': cond.get('reason','')
            })

def icd_to_ycodes(dx):
    """Return set of Y-codes that match the given ICD-10 (full + prefix lookup)."""
    if not dx: return set()
    dx = dx.strip().upper()
    ys = set()
    # Try exact
    if dx in ICD_TO_YCODES:
        ys |= ICD_TO_YCODES[dx]
    # Try with decimal stripped (e.g. I210 → I21.0 or I21)
    # And try prefix matches
    for k, v in ICD_TO_YCODES.items():
        if dx == k or dx.startswith(k + '.') or k == dx[:len(k)]:
            ys |= v
    # Also try prefix with first 3-4 chars
    for plen in (5, 4, 3):
        if len(dx) >= plen:
            pref = dx[:plen]
            if pref in ICD_TO_YCODES:
                ys |= ICD_TO_YCODES[pref]
    return ys

# Pre-compute a flat ICD prefix index for faster matching
ICD_PREFIX_INDEX = defaultdict(set)
for k, v in ICD_TO_YCODES.items():
    # Normalize: 'I21.0' → both 'I21.0' and 'I210' (no dot)
    nodot = k.replace('.', '')
    ICD_PREFIX_INDEX[k] = v
    ICD_PREFIX_INDEX[nodot] = v

def fast_icd_match(dx):
    if not dx: return set()
    dx = dx.strip().upper().replace('.', '')
    ys = set()
    # Try lengths 5,4,3 prefix lookup
    for plen in range(min(len(dx),5), 2, -1):
        pref = dx[:plen]
        if pref in ICD_PREFIX_INDEX:
            ys |= ICD_PREFIX_INDEX[pref]
    return ys

# ─────────── Counters ───────────
print('[2/7] Initializing counters...', file=sys.stderr)
total_rows = 0
matched_rows = 0  # 네디스매칭 = 매칭
included_rows = 0  # all inclusion criteria 통과
excluded_reasons = Counter()
prevalence_count = Counter()  # ground truth Y-code prevalence

# Confusion matrix (이항: severe vs not-severe)
# q0 = no questions (raw v0.1 candidates)
# q_oracle = oracle simulation (ground truth가 candidates에 있으면 정답 도달)
binary_cm = {
    'q0': {'tp':0, 'fp':0, 'tn':0, 'fn':0},
    'q_oracle': {'tp':0, 'fp':0, 'tn':0, 'fn':0},
}

# Multi-class (per Y-code)
per_ycode = defaultdict(lambda: {'tp':0, 'fp':0, 'fn':0, 'tn':0, 'support':0})

# Stratified
strat_region = defaultdict(lambda: {'q0':{'tp':0,'fp':0,'tn':0,'fn':0}, 'n':0})
strat_age_group = defaultdict(lambda: {'q0':{'tp':0,'fp':0,'tn':0,'fn':0}, 'n':0})
strat_grade = defaultdict(lambda: {'q0':{'tp':0,'fp':0,'tn':0,'fn':0}, 'n':0})

# Top FN/FP patterns
fn_patterns = Counter()  # (level2, ground_truth_ycode) → count
fp_patterns = Counter()  # (level2, predicted_ycode) → count

# Code mapping coverage (visit-weighted)
code_unmapped_visits = 0
unknown_suffix_visits = 0
codebook_missing_visits = 0

# ─────────── CSV processing ───────────
print('[3/7] Streaming CSV...', file=sys.stderr)

def stream_csv():
    """Stream EUC-KR CSV via iconv subprocess."""
    proc = subprocess.Popen(['iconv', '-f', 'EUC-KR', '-t', 'UTF-8', CSV_PATH],
                            stdout=subprocess.PIPE, text=True, encoding='utf-8',
                            errors='replace')
    return proc.stdout

def age_group(age):
    try: a = int(age)
    except: return 'unknown'
    if a < 12: return 'pediatric_<12'
    elif a < 18: return 'adolescent_12_17'
    elif a < 65: return 'adult_18_64'
    else: return 'elderly_65+'

stream = stream_csv()
header = next(stream)
COL_LOC = 0     # 지역
COL_PRE = 2     # PRE_KTAS
COL_AGE = 3     # 연령
COL_AVPU = 4    # 의식상태
COL_MATCH = 9   # 네디스매칭여부
COL_TIER = 12   # 종별
COL_DX = 18     # 퇴실진단코드
COL_OUTCOME = 17  # 응급진료결과
COL_KTAS = 15   # 최초KTAS
COL_PREKTAS_CODE = 23  # 최초KTAS분류과정 (Pre-KTAS 6자)

for line in stream:
    total_rows += 1
    cols = line.rstrip('\n').split(',')
    if len(cols) < 24:
        excluded_reasons['malformed'] += 1
        continue

    if cols[COL_MATCH] != '매칭':
        excluded_reasons['unmatched'] += 1
        continue
    matched_rows += 1

    raw_code = cols[COL_PREKTAS_CODE].strip()
    if not raw_code or len(raw_code) < 6:
        excluded_reasons['no_prektas_code'] += 1
        continue
    raw_code = raw_code[:6]

    dx = cols[COL_DX].strip()
    if not dx:
        excluded_reasons['no_diagnosis'] += 1
        continue

    # Crosswalk 6 → 5
    code5 = CW_MAP.get(raw_code)
    if not code5:
        # Try suffix-based
        if raw_code[0] == 'A' and len(raw_code) == 6:
            sfx = raw_code[5]
            if sfx == '0': code5 = 'C' + raw_code[1:5]
            elif sfx == '9': code5 = 'D' + raw_code[1:5]
            else:
                unknown_suffix_visits += 1
                excluded_reasons['unknown_suffix'] += 1
                continue
            if code5 not in CODE_TO_ENTRY:
                codebook_missing_visits += 1
                excluded_reasons['codebook_missing'] += 1
                continue
        else:
            code_unmapped_visits += 1
            excluded_reasons['code_format'] += 1
            continue

    if code5 not in CODE_TO_ENTRY:
        codebook_missing_visits += 1
        excluded_reasons['codebook_missing'] += 1
        continue

    included_rows += 1

    entry = CODE_TO_ENTRY[code5]
    grade = entry.get('grade')
    map_entry = CODE_TO_MAPPING.get(code5, {})
    candidates = set(map_entry.get('candidates') or [])

    # Ground truth Y-codes from ICD-10
    gt_ycodes = fast_icd_match(dx)

    # Binary outcomes
    has_gt_severe = bool(gt_ycodes)
    has_pred_severe_q0 = bool(candidates)
    intersect = candidates & gt_ycodes

    # q0 binary
    if has_gt_severe and intersect:
        binary_cm['q0']['tp'] += 1
    elif has_gt_severe and not intersect:
        binary_cm['q0']['fn'] += 1
    elif not has_gt_severe and has_pred_severe_q0:
        binary_cm['q0']['fp'] += 1
    else:
        binary_cm['q0']['tn'] += 1

    # q_oracle: oracle question simulation
    # candidates ⊇ gt_ycodes 일부면 정답 도달로 간주 (best-case)
    if has_gt_severe and intersect:
        # any overlap → oracle 정답
        binary_cm['q_oracle']['tp'] += 1
    elif has_gt_severe:
        binary_cm['q_oracle']['fn'] += 1
    elif has_pred_severe_q0:
        binary_cm['q_oracle']['fp'] += 1
    else:
        binary_cm['q_oracle']['tn'] += 1

    # Per-Y-code (multi-class)
    for y in gt_ycodes:
        per_ycode[y]['support'] += 1
        if y in candidates:
            per_ycode[y]['tp'] += 1
        else:
            per_ycode[y]['fn'] += 1
    for y in candidates:
        if y not in gt_ycodes:
            per_ycode[y]['fp'] += 1

    # FN/FP patterns
    if has_gt_severe and not intersect:
        for y in gt_ycodes:
            fn_patterns[(entry.get('level2', {}).get('name', '?') if isinstance(entry.get('level2'), dict) else str(entry.get('level2','?')), y)] += 1
    if not has_gt_severe and candidates:
        for y in candidates:
            fp_patterns[(entry.get('level2', {}).get('name', '?') if isinstance(entry.get('level2'), dict) else str(entry.get('level2','?')), y)] += 1

    # Stratified
    region = cols[COL_LOC].strip() or 'unknown'
    ag = age_group(cols[COL_AGE])
    grade_str = str(grade) if grade else '?'

    for strat, key in [(strat_region, region), (strat_age_group, ag), (strat_grade, grade_str)]:
        strat[key]['n'] += 1
        if has_gt_severe and intersect: strat[key]['q0']['tp'] += 1
        elif has_gt_severe: strat[key]['q0']['fn'] += 1
        elif has_pred_severe_q0: strat[key]['q0']['fp'] += 1
        else: strat[key]['q0']['tn'] += 1

    # Prevalence
    for y in gt_ycodes:
        prevalence_count[y] += 1

    if total_rows % 50000 == 0:
        print(f'  processed {total_rows} rows, included {included_rows}', file=sys.stderr)

print(f'[4/7] CSV done. total={total_rows} matched={matched_rows} included={included_rows}', file=sys.stderr)

# ─────────── Metrics ───────────
print('[5/7] Computing metrics...', file=sys.stderr)

def wilson_ci(p, n, z=1.96):
    if n == 0: return [0, 0]
    p_hat = p / n
    denom = 1 + z*z/n
    center = p_hat + z*z/(2*n)
    spread = z * math.sqrt(p_hat*(1-p_hat)/n + z*z/(4*n*n))
    return [round((center-spread)/denom, 4), round((center+spread)/denom, 4)]

def metrics(cm):
    tp, fp, tn, fn = cm['tp'], cm['fp'], cm['tn'], cm['fn']
    n = tp+fp+tn+fn
    sens_n = tp+fn; sens = tp/sens_n if sens_n else 0
    spec_n = tn+fp; spec = tn/spec_n if spec_n else 0
    ppv_n = tp+fp; ppv = tp/ppv_n if ppv_n else 0
    npv_n = tn+fn; npv = tn/npv_n if npv_n else 0
    f1 = 2*ppv*sens/(ppv+sens) if (ppv+sens) else 0
    bacc = (sens+spec)/2
    # Cohen's kappa
    p_obs = (tp+tn)/n if n else 0
    p_pos = ((tp+fp)*(tp+fn))/(n*n) if n else 0
    p_neg = ((fn+tn)*(fp+tn))/(n*n) if n else 0
    p_exp = p_pos+p_neg
    kappa = (p_obs-p_exp)/(1-p_exp) if p_exp != 1 else 0
    return {
        'tp': tp, 'fp': fp, 'tn': tn, 'fn': fn, 'n': n,
        'sensitivity': round(sens, 4), 'sensitivity_95CI': wilson_ci(tp, sens_n),
        'specificity': round(spec, 4), 'specificity_95CI': wilson_ci(tn, spec_n),
        'ppv': round(ppv, 4), 'ppv_95CI': wilson_ci(tp, ppv_n),
        'npv': round(npv, 4), 'npv_95CI': wilson_ci(tn, npv_n),
        'f1': round(f1, 4),
        'balanced_accuracy': round(bacc, 4),
        'cohens_kappa': round(kappa, 4),
    }

# Hypothesis evaluation
THRESH = clusters['thresholds']
def eval_hypothesis(m, h_id):
    val = THRESH[h_id]['value']
    if h_id == 'h1_sensitivity':
        lower = m['sensitivity_95CI'][0]
        return {'threshold': val, 'lower_ci': lower, 'pass': lower >= val}
    if h_id == 'h2_specificity':
        lower = m['specificity_95CI'][0]
        return {'threshold': val, 'lower_ci': lower, 'pass': lower >= val}
    return None

q0_metrics = metrics(binary_cm['q0'])
q_oracle_metrics = metrics(binary_cm['q_oracle'])

# Marginal gain
marginal_gain_q_oracle = round(q_oracle_metrics['sensitivity'] - q0_metrics['sensitivity'], 4)

# Per-Y metrics
per_y_metrics = {}
for y, cm in per_ycode.items():
    tp, fp, fn = cm['tp'], cm['fp'], cm['fn']
    sup = cm['support']
    prec = tp/(tp+fp) if (tp+fp) else 0
    rec = tp/(tp+fn) if (tp+fn) else 0
    f1 = 2*prec*rec/(prec+rec) if (prec+rec) else 0
    per_y_metrics[y] = {
        'support': sup, 'tp': tp, 'fp': fp, 'fn': fn,
        'precision': round(prec,4), 'recall': round(rec,4), 'f1': round(f1,4),
        'recall_95CI': wilson_ci(tp, sup),
    }

# Macro / weighted F1
y_with_support = [y for y in per_y_metrics if per_y_metrics[y]['support'] > 0]
macro_f1 = sum(per_y_metrics[y]['f1'] for y in y_with_support) / max(1, len(y_with_support))
total_support = sum(per_y_metrics[y]['support'] for y in y_with_support)
weighted_f1 = sum(per_y_metrics[y]['f1'] * per_y_metrics[y]['support'] for y in y_with_support) / max(1, total_support)

# ─────────── Output: validation-results-v0.1.json ───────────
print('[6/7] Writing results...', file=sys.stderr)

import datetime
out_main = {
    'protocol_id': 'PREKTAS-VAL-2026-001',
    'protocol_version': '1.1',
    'algorithm_version': 'v0.1',
    'analysis_at': datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
    'reference_standard': 'research/y-code-icd10-clusters.json v1.0',
    'sample': {
        'csv_total_rows': total_rows,
        'matched_rows': matched_rows,
        'included_rows': included_rows,
        'excluded_reasons': dict(excluded_reasons),
        'crosswalk_visit_weighted': {
            'unknown_suffix_visits': unknown_suffix_visits,
            'codebook_missing_visits': codebook_missing_visits,
            'code_format_visits': code_unmapped_visits,
        }
    },
    'prevalence': {
        'severe_count': sum(prevalence_count.values()),
        'severe_unique_visits': binary_cm['q0']['tp'] + binary_cm['q0']['fn'],
        'severe_pct': round((binary_cm['q0']['tp'] + binary_cm['q0']['fn'])/included_rows*100, 2) if included_rows else 0,
        'per_ycode': {y: prevalence_count[y] for y in sorted(prevalence_count, key=lambda x: -prevalence_count[x])},
    },
    'binary_metrics': {
        'q0_no_questions': q0_metrics,
        'q_oracle_best_case': q_oracle_metrics,
        'marginal_gain_oracle_vs_q0_sensitivity': marginal_gain_q_oracle,
    },
    'hypothesis_tests': {
        'h1_sensitivity_q0': eval_hypothesis(q0_metrics, 'h1_sensitivity'),
        'h2_specificity_q0': eval_hypothesis(q0_metrics, 'h2_specificity'),
        'h1_sensitivity_q_oracle': eval_hypothesis(q_oracle_metrics, 'h1_sensitivity'),
        'h2_specificity_q_oracle': eval_hypothesis(q_oracle_metrics, 'h2_specificity'),
    },
    'per_ycode_metrics': per_y_metrics,
    'macro_f1': round(macro_f1, 4),
    'weighted_f1': round(weighted_f1, 4),
}

with open(os.path.join(REPO_ROOT, 'research/validation-results-v0.1.json'), 'w', encoding='utf-8') as f:
    json.dump(out_main, f, ensure_ascii=False, indent=2)

# Stratified output
def stratify_to_metrics(strat):
    return {k: {'n': v['n'], 'metrics': metrics(v['q0'])} for k,v in strat.items()}

out_strat = {
    'protocol_id': 'PREKTAS-VAL-2026-001',
    'analysis_at': datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
    'by_region': stratify_to_metrics(strat_region),
    'by_age_group': stratify_to_metrics(strat_age_group),
    'by_grade': stratify_to_metrics(strat_grade),
}
with open(os.path.join(REPO_ROOT, 'research/validation-stratified.json'), 'w', encoding='utf-8') as f:
    json.dump(out_strat, f, ensure_ascii=False, indent=2)

# Error audit
top_fn = sorted(fn_patterns.items(), key=lambda x: -x[1])[:50]
top_fp = sorted(fp_patterns.items(), key=lambda x: -x[1])[:50]

out_audit = {
    'protocol_id': 'PREKTAS-VAL-2026-001',
    'analysis_at': datetime.datetime.utcnow().isoformat(timespec='seconds') + 'Z',
    'note': 'Top FN: 시스템이 unmapped로 처리했으나 ICD-10 ground truth가 severe Y코드. Top FP: 시스템이 severe로 예측했으나 ICD-10 ground truth는 not-severe.',
    'top_fn_patterns': [{'level2': k[0], 'ground_truth_ycode': k[1], 'count': v} for k,v in top_fn],
    'top_fp_patterns': [{'level2': k[0], 'predicted_ycode': k[1], 'count': v} for k,v in top_fp],
}
with open(os.path.join(REPO_ROOT, 'research/validation-error-audit.json'), 'w', encoding='utf-8') as f:
    json.dump(out_audit, f, ensure_ascii=False, indent=2)

# ─────────── Console summary ───────────
print('[7/7] Summary', file=sys.stderr)
print(f"\n{'='*60}")
print(f"Phase 8 Validation Results — v0.1 algorithm vs frozen reference standard v1.0")
print(f"{'='*60}")
print(f"Sample: {included_rows:,} included / {matched_rows:,} matched / {total_rows:,} total")
print(f"Severe prevalence: {(binary_cm['q0']['tp']+binary_cm['q0']['fn'])/included_rows*100:.2f}%")
print(f"")
print(f"Binary (q0, no questions):")
print(f"  Sensitivity: {q0_metrics['sensitivity']:.4f}  95% CI: {q0_metrics['sensitivity_95CI']}")
print(f"  Specificity: {q0_metrics['specificity']:.4f}  95% CI: {q0_metrics['specificity_95CI']}")
print(f"  PPV: {q0_metrics['ppv']:.4f}  NPV: {q0_metrics['npv']:.4f}")
print(f"  F1: {q0_metrics['f1']:.4f}  Balanced Acc: {q0_metrics['balanced_accuracy']:.4f}")
print(f"")
print(f"Binary (q_oracle, best-case):")
print(f"  Sensitivity: {q_oracle_metrics['sensitivity']:.4f}")
print(f"  Marginal gain (q_oracle vs q0): {marginal_gain_q_oracle:+.4f}")
print(f"")
print(f"H1 (sens ≥ {THRESH['h1_sensitivity']['value']}): q0 {'PASS' if q0_metrics['sensitivity_95CI'][0] >= THRESH['h1_sensitivity']['value'] else 'FAIL'}")
print(f"H2 (spec ≥ {THRESH['h2_specificity']['value']}): q0 {'PASS' if q0_metrics['specificity_95CI'][0] >= THRESH['h2_specificity']['value'] else 'FAIL'}")
print(f"")
print(f"Macro F1: {macro_f1:.4f}  Weighted F1: {weighted_f1:.4f}")
print(f"{'='*60}\n")
print('Outputs:')
print('  research/validation-results-v0.1.json')
print('  research/validation-stratified.json')
print('  research/validation-error-audit.json')
