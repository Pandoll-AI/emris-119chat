#!/usr/bin/env python3
"""
Phase 11d — v0.3 directional 검증 + v0.2 vs v0.3 비교.

자문자 원칙 그대로: 광주·전라 데이터는 검증 안 됨, 통계는 directional probe.
v0.3 변경의 directional impact 측정 — 결정의 근거 X.

핵심 평가:
  - v0.2 vs v0.3 binary metrics 차이
  - mappability 분포 변화 (A:387→? B:266→? C:64→? unmapped:?)
  - Type-A 모순 (confident인데 ground truth 매칭 안 됨) 수 변화
  - Tier 일치율 변화
"""
import json, math, os, subprocess, sys
from collections import defaultdict, Counter

REPO_ROOT = '/Users/sjlee/Projects/emris-119chat'
CSV_PATH = '/Users/sjlee/Projects/prektas-research/source-prektas.csv'

def load(p):
    with open(os.path.join(REPO_ROOT, p), 'r', encoding='utf-8') as f:
        return json.load(f)

print('[1/5] Loading v0.2 + v0.3 mappings + reference data...', file=sys.stderr)
codebook = load('data/prektas-codebook.json')
v02 = load('research/prektas-to-y-mapping-v0.2.json')
v03 = load('research/prektas-to-y-mapping-v0.3.json')
clusters = load('research/y-code-icd10-clusters.json')
crosswalk = load('research/prektas-code-crosswalk.json')

CODE_TO_V02 = {m['code']: m for m in v02['mappings']}
CODE_TO_V03 = {m['code']: m for m in v03['mappings']}
CW = crosswalk['mappings']

# ICD → Y lookup (same as v0.2)
import re
def expand(pat):
    if pat.endswith('.x'):
        prefix = pat[:-2]
        return [f'{prefix}.{i}' for i in '0123456789'] + [prefix]
    if re.match(r'^[A-Z][0-9]+-[A-Z][0-9]+$', pat):
        m = re.match(r'^([A-Z])([0-9]+)-([A-Z])([0-9]+)$', pat)
        L, a, R, b = m.group(1), int(m.group(2)), m.group(3), int(m.group(4))
        if L != R: return [pat]
        return [f'{L}{i:02d}' for i in range(a, b+1)] + [f'{L}{i:02d}.{j}' for i in range(a,b+1) for j in '0123456789']
    return [pat]

ICD_PREFIX = defaultdict(set)
for ycode, info in clusters['y_codes'].items():
    for icd_pat in info.get('include', []):
        for icd in expand(icd_pat):
            ICD_PREFIX[icd].add(ycode)
            ICD_PREFIX[icd.replace('.','')].add(ycode)

def fast_icd(dx):
    if not dx: return set()
    dx = dx.strip().upper().replace('.','')
    ys = set()
    for plen in range(min(len(dx),5), 2, -1):
        pref = dx[:plen]
        if pref in ICD_PREFIX:
            ys |= ICD_PREFIX[pref]
    return ys

# Counters per algorithm
def make_counters():
    return {
        'binary_confident': {'tp':0,'fp':0,'tn':0,'fn':0},
        'binary_with_candidate': {'tp':0,'fp':0,'tn':0,'fn':0},
        'mappability_dist': Counter(),
        'type_a_misses': [],
        'type_b_matches': Counter(),
        'tier_match': {'agree':0,'disagree':0,'no_tier_info':0},
    }
v02c = make_counters()
v03c = make_counters()

total = matched = included = 0
excluded = Counter()
prev = Counter()

print('[2/5] Streaming CSV...', file=sys.stderr)
proc = subprocess.Popen(['iconv','-f','EUC-KR','-t','UTF-8',CSV_PATH],
                        stdout=subprocess.PIPE, text=True, encoding='utf-8', errors='replace')
stream = proc.stdout
header = next(stream)

COL_MATCH = 9
COL_TIER = 12
COL_DX = 18
COL_PREKTAS_CODE = 23

TIER_NAME_MAP = {
    '권역응급의료센터': 'regional',
    '지역응급의료센터': 'local_center',
    '지역응급의료기관': 'local_institution',
}

def update_counters(c, entry, gt_y, has_gt_severe, actual_tier):
    mappability = entry['mappability']
    c['mappability_dist'][mappability] += 1
    confident_y = {x['code'] for x in entry['y_candidates'] if x['confidence']=='confident'}
    candidate_y = {x['code'] for x in entry['y_candidates'] if x['confidence']=='candidate'}
    all_y = confident_y | candidate_y

    intersect_confident = confident_y & gt_y
    has_pred_confident = bool(confident_y)
    if has_gt_severe and intersect_confident: c['binary_confident']['tp'] += 1
    elif has_gt_severe: c['binary_confident']['fn'] += 1
    elif has_pred_confident: c['binary_confident']['fp'] += 1
    else: c['binary_confident']['tn'] += 1

    intersect_all = all_y & gt_y
    has_pred_any = bool(all_y)
    if has_gt_severe and intersect_all: c['binary_with_candidate']['tp'] += 1
    elif has_gt_severe: c['binary_with_candidate']['fn'] += 1
    elif has_pred_any: c['binary_with_candidate']['fp'] += 1
    else: c['binary_with_candidate']['tn'] += 1

    if mappability == 'A' and has_gt_severe and not intersect_confident:
        if len(c['type_a_misses']) < 200:
            c['type_a_misses'].append({
                'code': entry['code'],
                'level2': entry['level2'],
                'level3': entry['level3'],
                'confident_y': sorted(confident_y),
                'gt_y': sorted(gt_y),
            })
    if mappability == 'B' and has_gt_severe:
        c['type_b_matches']['match' if intersect_all else 'miss'] += 1

    pred_tier = entry['tier_recommendation']
    if actual_tier and pred_tier:
        if actual_tier in pred_tier.get('acceptable',[]):
            c['tier_match']['agree'] += 1
        else:
            c['tier_match']['disagree'] += 1
    else:
        c['tier_match']['no_tier_info'] += 1

for line in stream:
    total += 1
    cols = line.rstrip('\n').split(',')
    if len(cols) < 24:
        excluded['malformed'] += 1; continue
    if cols[COL_MATCH] != '매칭':
        excluded['unmatched'] += 1; continue
    matched += 1
    raw_code = cols[COL_PREKTAS_CODE].strip()[:6]
    if len(raw_code) < 6:
        excluded['no_code'] += 1; continue
    dx = cols[COL_DX].strip()
    if not dx:
        excluded['no_dx'] += 1; continue

    code5 = CW.get(raw_code)
    if not code5 and raw_code[0]=='A':
        sfx = raw_code[5]
        if sfx == '0': code5 = 'C' + raw_code[1:5]
        elif sfx == '9': code5 = 'D' + raw_code[1:5]
    if not code5 or code5 not in CODE_TO_V03:
        excluded['no_v03_mapping'] += 1; continue

    included += 1
    gt_y = fast_icd(dx)
    has_gt_severe = bool(gt_y)
    for y in gt_y:
        prev[y] += 1
    actual_tier = TIER_NAME_MAP.get(cols[COL_TIER], None)

    update_counters(v02c, CODE_TO_V02[code5], gt_y, has_gt_severe, actual_tier)
    update_counters(v03c, CODE_TO_V03[code5], gt_y, has_gt_severe, actual_tier)

    if total % 50000 == 0:
        print(f'  {total:,} rows, included {included:,}', file=sys.stderr)

print(f'[3/5] Done. total={total:,} matched={matched:,} included={included:,}', file=sys.stderr)

def wilson(p, n, z=1.96):
    if n == 0: return [0,0]
    p_hat = p/n
    denom = 1 + z*z/n
    center = p_hat + z*z/(2*n)
    spread = z*math.sqrt(p_hat*(1-p_hat)/n + z*z/(4*n*n))
    return [round((center-spread)/denom,4), round((center+spread)/denom,4)]

def metrics(cm):
    tp,fp,tn,fn = cm['tp'],cm['fp'],cm['tn'],cm['fn']
    n = tp+fp+tn+fn
    sens = tp/(tp+fn) if (tp+fn) else 0
    spec = tn/(tn+fp) if (tn+fp) else 0
    ppv = tp/(tp+fp) if (tp+fp) else 0
    npv = tn/(tn+fn) if (tn+fn) else 0
    f1 = 2*ppv*sens/(ppv+sens) if (ppv+sens) else 0
    return {
        'tp':tp,'fp':fp,'tn':tn,'fn':fn,'n':n,
        'sensitivity': round(sens,4), 'sensitivity_95CI': wilson(tp, tp+fn),
        'specificity': round(spec,4), 'specificity_95CI': wilson(tn, tn+fp),
        'ppv': round(ppv,4), 'npv': round(npv,4), 'f1': round(f1,4),
    }

print('[4/5] Computing metrics...', file=sys.stderr)
m02_c = metrics(v02c['binary_confident'])
m02_a = metrics(v02c['binary_with_candidate'])
m03_c = metrics(v03c['binary_confident'])
m03_a = metrics(v03c['binary_with_candidate'])

def b_rate(c):
    bt = c['type_b_matches']['match'] + c['type_b_matches']['miss']
    return round(c['type_b_matches']['match'] / bt, 4) if bt else 0

def tier_rate(c):
    t = c['tier_match']['agree'] + c['tier_match']['disagree']
    return round(c['tier_match']['agree'] / t, 4) if t else 0

import datetime
out = {
    'protocol_id': 'PREKTAS-VAL-2026-001',
    'algorithm_compared': ['v0.2', 'v0.3'],
    'reference_standard': 'research/y-code-icd10-clusters.json v1.0',
    'mappability_matrix': 'research/y-code-mappability-matrix.json v1.0 (frozen)',
    'analysis_at': datetime.datetime.utcnow().isoformat(timespec='seconds')+'Z',
    'data_caveat': '광주·전라 데이터는 검증 안 됨. 본 결과는 directional probe (informational only). 결정의 근거가 아니다.',
    'sample': {
        'total_rows': total, 'matched': matched, 'included': included,
        'excluded': dict(excluded),
    },
    'severe_prevalence': {
        'count': sum(prev.values()),
        'pct': round((m02_c['tp']+m02_c['fn'])/included*100,2) if included else 0,
        'per_y': dict(prev.most_common()),
    },
    'v02': {
        'mappability_distribution': dict(v02c['mappability_dist']),
        'binary_confident_only': m02_c,
        'binary_with_candidate': m02_a,
        'type_a_contradictions': len(v02c['type_a_misses']),
        'type_b_match_rate': b_rate(v02c),
        'tier_agreement_rate': tier_rate(v02c),
    },
    'v03': {
        'mappability_distribution': dict(v03c['mappability_dist']),
        'binary_confident_only': m03_c,
        'binary_with_candidate': m03_a,
        'type_a_contradictions': len(v03c['type_a_misses']),
        'type_b_match_rate': b_rate(v03c),
        'tier_agreement_rate': tier_rate(v03c),
        'type_a_sample': v03c['type_a_misses'][:30],
    },
    'directional_changes_v02_to_v03': {
        'sensitivity_confident_delta': round(m03_c['sensitivity'] - m02_c['sensitivity'], 4),
        'specificity_confident_delta': round(m03_c['specificity'] - m02_c['specificity'], 4),
        'sensitivity_with_candidate_delta': round(m03_a['sensitivity'] - m02_a['sensitivity'], 4),
        'specificity_with_candidate_delta': round(m03_a['specificity'] - m02_a['specificity'], 4),
        'tier_agreement_delta': round(tier_rate(v03c) - tier_rate(v02c), 4),
        'type_a_count_delta': len(v03c['type_a_misses']) - len(v02c['type_a_misses']),
        'note': 'sens 음(-) shift는 confident 좁힘의 의도된 결과. 임계값 평가 X — directional only.',
    },
    'vignette_validation_reference': {
        'review_id': 'VIGNETTE-REVIEW-mofq7k1h',
        'completed_at': '2026-04-26',
        'v02_appropriateness': '14/30 appropriate, 10/30 partial, 6/30 inappropriate',
        'v03_target': '24/30+ appropriate (vignette feedback 반영)',
        'note': 'vignette validation이 본 통계보다 우선 권위 (자문자 임상 추론).',
    },
}

print('[5/5] Writing output...', file=sys.stderr)
with open(os.path.join(REPO_ROOT, 'research/validation-results-v0.3.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"\n{'='*72}")
print(f"v0.2 vs v0.3 directional validation (광주·전라, 검증 안 됨, informational only)")
print(f"{'='*72}")
print(f"Sample: {included:,} included / {matched:,} matched / {total:,} total")
print(f"")
print(f"{'Metric':<35} {'v0.2':>15} {'v0.3':>15} {'Δ':>10}")
print(f"{'-'*72}")
print(f"{'mappability A':<35} {v02c['mappability_dist'].get('A',0):>15,} {v03c['mappability_dist'].get('A',0):>15,}")
print(f"{'mappability B':<35} {v02c['mappability_dist'].get('B',0):>15,} {v03c['mappability_dist'].get('B',0):>15,}")
print(f"{'mappability C':<35} {v02c['mappability_dist'].get('C',0):>15,} {v03c['mappability_dist'].get('C',0):>15,}")
print(f"{'mappability unmapped':<35} {v02c['mappability_dist'].get('unmapped',0):>15,} {v03c['mappability_dist'].get('unmapped',0):>15,}")
print(f"")
print(f"{'Sensitivity (confident only)':<35} {m02_c['sensitivity']:>15.4f} {m03_c['sensitivity']:>15.4f} {m03_c['sensitivity']-m02_c['sensitivity']:>+10.4f}")
print(f"{'Specificity (confident only)':<35} {m02_c['specificity']:>15.4f} {m03_c['specificity']:>15.4f} {m03_c['specificity']-m02_c['specificity']:>+10.4f}")
print(f"{'F1 (confident only)':<35} {m02_c['f1']:>15.4f} {m03_c['f1']:>15.4f} {m03_c['f1']-m02_c['f1']:>+10.4f}")
print(f"{'Sensitivity (w/ candidate)':<35} {m02_a['sensitivity']:>15.4f} {m03_a['sensitivity']:>15.4f} {m03_a['sensitivity']-m02_a['sensitivity']:>+10.4f}")
print(f"{'Specificity (w/ candidate)':<35} {m02_a['specificity']:>15.4f} {m03_a['specificity']:>15.4f} {m03_a['specificity']-m02_a['specificity']:>+10.4f}")
print(f"")
print(f"{'Type-A contradictions':<35} {len(v02c['type_a_misses']):>15,} {len(v03c['type_a_misses']):>15,}")
print(f"{'Type-B match rate':<35} {b_rate(v02c):>15.4f} {b_rate(v03c):>15.4f}")
print(f"{'Tier agreement rate':<35} {tier_rate(v02c):>15.4f} {tier_rate(v03c):>15.4f}")
print(f"{'='*72}")
