#!/usr/bin/env python3
"""
Phase 9d — v0.2 모순 검출 + directional 통계.

자문자 원칙: "광주·전라 데이터는 검증 안 됨. 통계는 directional probe (참고치)."
따라서 본 스크립트의 출력은 결정의 근거가 아닌 informational only.

핵심 평가:
  Type-A 모순: A 그룹(confident)인 Pre-KTAS code의 visit인데 ground truth Y와 매칭 안 됨
  Type-B 일치: B 그룹 후보 중 ground truth Y 포함 비율
  Type-C 적절성: C 그룹 visit의 ground truth Y 분포 + tier 권고 일치
  Type-D unmapped: A/B/C 외 unmapped된 visit의 ground truth Y 분포

비교 (informational):
  v0.1 vs v0.2 binary metrics (sens, spec)
"""
import json, math, os, subprocess, sys
from collections import defaultdict, Counter

REPO_ROOT = '/Users/sjlee/Projects/emris-119chat'
CSV_PATH = '/Users/sjlee/Projects/prektas-research/source-prektas.csv'

def load(p):
    with open(os.path.join(REPO_ROOT, p), 'r', encoding='utf-8') as f:
        return json.load(f)

print('[1/5] Loading v0.2 mapping + reference data...', file=sys.stderr)
codebook = load('data/prektas-codebook.json')
v02 = load('research/prektas-to-y-mapping-v0.2.json')
clusters = load('research/y-code-icd10-clusters.json')
crosswalk = load('research/prektas-code-crosswalk.json')

CODE_TO_ENTRY = {e['code']: e for e in codebook['entries']}
CODE_TO_V02 = {m['code']: m for m in v02['mappings']}
CW = crosswalk['mappings']

# Build ICD → Y lookup
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

# Counters
total = matched = included = 0
excluded = Counter()
binary_v02 = {'tp':0, 'fp':0, 'tn':0, 'fn':0}
binary_v02_with_candidate = {'tp':0, 'fp':0, 'tn':0, 'fn':0}  # confident + candidate
mappability_dist = Counter()
prev = Counter()
type_a_misses = []  # A 그룹인데 ground truth Y 매칭 안 됨
type_b_matches = Counter()  # B 후보 중 일치 비율
type_c_gt_dist = Counter()  # C 그룹 visit의 ground truth Y
type_d_unmapped_gt = Counter()
tier_match = {'agree':0, 'disagree':0, 'no_tier_info':0}

print('[2/5] Streaming CSV...', file=sys.stderr)
proc = subprocess.Popen(['iconv','-f','EUC-KR','-t','UTF-8',CSV_PATH],
                        stdout=subprocess.PIPE, text=True, encoding='utf-8', errors='replace')
stream = proc.stdout
header = next(stream)

COL_LOC = 0
COL_AGE = 3
COL_AVPU = 4
COL_MATCH = 9
COL_TIER = 12
COL_DX = 18
COL_OUTCOME = 17
COL_PREKTAS_CODE = 23

TIER_NAME_MAP = {
    '권역응급의료센터': 'regional',
    '지역응급의료센터': 'local_center',
    '지역응급의료기관': 'local_institution',
}

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

    # Crosswalk
    code5 = CW.get(raw_code)
    if not code5 and raw_code[0]=='A':
        sfx = raw_code[5]
        if sfx == '0': code5 = 'C' + raw_code[1:5]
        elif sfx == '9': code5 = 'D' + raw_code[1:5]
    if not code5 or code5 not in CODE_TO_V02:
        excluded['no_v02_mapping'] += 1; continue

    included += 1
    v02entry = CODE_TO_V02[code5]
    mappability = v02entry['mappability']
    mappability_dist[mappability] += 1

    confident_y = {c['code'] for c in v02entry['y_candidates'] if c['confidence']=='confident'}
    candidate_y = {c['code'] for c in v02entry['y_candidates'] if c['confidence']=='candidate'}
    c_tier_y = set(v02entry.get('c_tier_codes',[]))
    all_v02_y = confident_y | candidate_y

    gt_y = fast_icd(dx)
    has_gt_severe = bool(gt_y)
    for y in gt_y:
        prev[y] += 1

    # Binary v0.2 (confident only)
    intersect_confident = confident_y & gt_y
    has_pred_confident = bool(confident_y)
    if has_gt_severe and intersect_confident: binary_v02['tp'] += 1
    elif has_gt_severe: binary_v02['fn'] += 1
    elif has_pred_confident: binary_v02['fp'] += 1
    else: binary_v02['tn'] += 1

    # Binary v0.2 (confident + candidate)
    intersect_all = all_v02_y & gt_y
    has_pred_any = bool(all_v02_y)
    if has_gt_severe and intersect_all: binary_v02_with_candidate['tp'] += 1
    elif has_gt_severe: binary_v02_with_candidate['fn'] += 1
    elif has_pred_any: binary_v02_with_candidate['fp'] += 1
    else: binary_v02_with_candidate['tn'] += 1

    # Type-A 모순: mappability=A인데 confident Y와 ground truth 일치 안 됨 (gt가 severe인 경우)
    if mappability == 'A' and has_gt_severe and not intersect_confident:
        if len(type_a_misses) < 200:
            type_a_misses.append({
                'code': code5,
                'dx': dx,
                'confident_y': sorted(confident_y),
                'gt_y': sorted(gt_y),
                'level2': v02entry['level2'],
                'level3': v02entry['level3'],
            })

    # Type-B: B 후보 중 ground truth 매칭
    if mappability == 'B' and has_gt_severe:
        if intersect_all:
            type_b_matches['match'] += 1
        else:
            type_b_matches['miss'] += 1

    # Type-C: C 그룹 visit의 ground truth 분포
    if mappability == 'C':
        for y in gt_y:
            type_c_gt_dist[y] += 1

    # Type-D: unmapped visit의 ground truth Y
    if mappability == 'unmapped' and has_gt_severe:
        for y in gt_y:
            type_d_unmapped_gt[y] += 1

    # Tier 일치
    actual_tier = TIER_NAME_MAP.get(cols[COL_TIER], None)
    pred_tier = v02entry['tier_recommendation']
    if actual_tier and pred_tier:
        if actual_tier in pred_tier.get('acceptable',[]):
            tier_match['agree'] += 1
        else:
            tier_match['disagree'] += 1
    else:
        tier_match['no_tier_info'] += 1

    if total % 50000 == 0:
        print(f'  {total:,} rows, included {included:,}', file=sys.stderr)

print(f'[3/5] Done. total={total:,} matched={matched:,} included={included:,}', file=sys.stderr)

# Metrics
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

m_confident = metrics(binary_v02)
m_with_candidate = metrics(binary_v02_with_candidate)

# Type-B matching rate
b_total = type_b_matches['match'] + type_b_matches['miss']
b_match_rate = type_b_matches['match'] / b_total if b_total else 0

# Tier match rate
tier_total = tier_match['agree'] + tier_match['disagree']
tier_match_rate = tier_match['agree'] / tier_total if tier_total else 0

import datetime
out = {
    'protocol_id': 'PREKTAS-VAL-2026-001',
    'algorithm_version': 'v0.2',
    'reference_standard': 'research/y-code-icd10-clusters.json v1.0',
    'mappability_matrix': 'research/y-code-mappability-matrix.json v1.0 (frozen)',
    'analysis_at': datetime.datetime.utcnow().isoformat(timespec='seconds')+'Z',
    'data_caveat': '광주·전라 데이터는 검증 안 됨. 본 결과는 directional probe (informational only). 결정의 근거가 아니다.',
    'sample': {
        'total_rows': total, 'matched': matched, 'included': included,
        'excluded': dict(excluded),
    },
    'mappability_distribution': dict(mappability_dist),
    'binary_metrics_confident_only': m_confident,
    'binary_metrics_confident_plus_candidate': m_with_candidate,
    'comparison_with_v01': {
        'v01_sensitivity': 0.3935,
        'v01_specificity': 0.8077,
        'v02_sensitivity_confident': m_confident['sensitivity'],
        'v02_specificity_confident': m_confident['specificity'],
        'v02_sensitivity_with_candidate': m_with_candidate['sensitivity'],
        'v02_specificity_with_candidate': m_with_candidate['specificity'],
        'note': '자문자 원칙에 따라 sens 0.70 같은 임계값 평가는 폐기. 본 비교는 directional only.',
    },
    'type_a_contradictions': {
        'count': len(type_a_misses),
        'note': 'A 그룹(confident)인데 ground truth Y와 매칭 안 됨. v0.2 룰 결함 또는 ICD-10 cluster 정의 한계 가능.',
        'sample': type_a_misses[:50],
    },
    'type_b_matching': {
        'matched': type_b_matches['match'],
        'missed': type_b_matches['miss'],
        'match_rate': round(b_match_rate, 4),
        'note': 'B 그룹 후보가 ground truth와 일치하는 비율. 후보군 정의의 적절성 평가.',
    },
    'type_c_ground_truth_distribution': dict(type_c_gt_dist.most_common(20)),
    'type_d_unmapped_gt_distribution': dict(type_d_unmapped_gt.most_common(20)),
    'tier_recommendation_agreement': {
        'agree': tier_match['agree'],
        'disagree': tier_match['disagree'],
        'no_tier_info': tier_match['no_tier_info'],
        'agree_rate_when_known': round(tier_match_rate, 4),
        'note': 'tier_recommendation.acceptable에 실제 이송 종별이 포함되는 비율. (사전 등록 H4와 다른 directional 정의)',
    },
    'severe_prevalence': {
        'count': sum(prev.values()),
        'pct': round((m_confident['tp']+m_confident['fn'])/included*100,2) if included else 0,
        'per_y': dict(prev.most_common()),
    },
}

print('[5/5] Writing output...', file=sys.stderr)
with open(os.path.join(REPO_ROOT, 'research/validation-results-v0.2.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"\n{'='*70}")
print(f"v0.2 directional validation (광주·전라, 검증 안 됨, informational only)")
print(f"{'='*70}")
print(f"Sample: {included:,} included / {matched:,} matched / {total:,} total")
print(f"Mappability dist: {dict(mappability_dist)}")
print(f"")
print(f"Binary (confident only):")
print(f"  Sensitivity: {m_confident['sensitivity']:.4f}  Specificity: {m_confident['specificity']:.4f}  F1: {m_confident['f1']:.4f}")
print(f"Binary (confident + candidate):")
print(f"  Sensitivity: {m_with_candidate['sensitivity']:.4f}  Specificity: {m_with_candidate['specificity']:.4f}  F1: {m_with_candidate['f1']:.4f}")
print(f"")
print(f"v0.1 (참고): sens=0.3935, spec=0.8077")
print(f"")
print(f"Type-A contradictions (A 그룹 misses): {len(type_a_misses)}")
print(f"Type-B match rate (B 후보 일치): {b_match_rate*100:.1f}%")
print(f"Tier agreement (when known): {tier_match_rate*100:.1f}%")
print(f"{'='*70}")
print(f"\nOutput: research/validation-results-v0.2.json")
