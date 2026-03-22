# -*- coding: utf-8 -*-
"""
생산(발주) 물량 관리 PDF 파서
- 엑셀에서 PDF로 저장한 파일을 파싱
- pdfplumber 기반 (무료)
"""
import sys, json, re, unicodedata, subprocess

try:
    import pdfplumber
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "pdfplumber", "--break-system-packages", "-q"], capture_output=True)
    import pdfplumber


def N(s):
    if not s: return ""
    return re.sub(r"[\s\u3000]+", " ", unicodedata.normalize("NFKC", str(s))).strip()

def fix_number(s):
    """PDF에서 깨진 숫자 복원: '8 7.61' → 87.61, '1 ,427.26' → 1427.26, '7 .26' → 7.26"""
    if not s: return None
    s = N(s)
    if s == '-' or s == '': return None
    # 공백/콤마 제거 후 숫자만
    cleaned = re.sub(r'[,\s]', '', s)
    # 소수점 앞뒤 정리
    cleaned = re.sub(r'(\d)\.(\d)', r'\1.\2', cleaned)
    cleaned = re.sub(r'[^0-9.]', '', cleaned)
    if not cleaned: return None
    try:
        return float(cleaned)
    except:
        return None

def fix_date(s):
    """날짜 파싱: 2025-09-08 형태"""
    if not s: return None
    s = N(s)
    if s == '-' or s == '': return None
    # 이미 날짜 형태인 경우
    m = re.match(r'(\d{4})[-./ ](\d{1,2})[-./ ](\d{1,2})', s)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    return None

def parse_header(header_row):
    """헤더에서 컬럼 매핑 파악"""
    mapping = {}
    for i, cell in enumerate(header_row):
        c = N(cell).replace(' ', '')
        if '차수' in c: mapping['seq'] = i
        elif c == '물량업' or '물량업' in c: mapping['qty_extra'] = i
        elif '물량' in c and 'qty' not in mapping: mapping['qty'] = i
        elif '발주일' in c: mapping['orderDate'] = i
        elif '공급일' in c: mapping['supplyDate'] = i
        elif '경과일' in c: mapping['elapsed'] = i
        elif '비고' in c: mapping['notes'] = i
    return mapping

def parse_data_table(table, label=""):
    """메인 데이터 테이블 파싱"""
    if not table or len(table) < 2:
        return []
    
    header = table[0]
    mapping = parse_header(header)
    
    if 'seq' not in mapping or 'qty' not in mapping:
        return []
    
    orders = []
    for row in table[1:]:
        if not row: continue
        
        seq_idx = mapping['seq']
        qty_idx = mapping['qty']
        
        seq = N(row[seq_idx]) if seq_idx < len(row) else ''
        qty_raw = N(row[qty_idx]) if qty_idx < len(row) else ''
        
        # 합계/공제/빈행 스킵
        if not seq or seq in ('합계', '공제', '합 계', '공 제'):
            continue
        if seq == '-':
            continue
        
        qty = fix_number(qty_raw)
        if qty is None or qty <= 0:
            continue
        
        order_date = None
        supply_date = None
        notes = ''
        
        if 'orderDate' in mapping and mapping['orderDate'] < len(row):
            order_date = fix_date(row[mapping['orderDate']])
        
        if 'supplyDate' in mapping and mapping['supplyDate'] < len(row):
            supply_date = fix_date(row[mapping['supplyDate']])
        
        if 'notes' in mapping and mapping['notes'] < len(row):
            notes = N(row[mapping['notes']]) or ''
        
        # 경과일에 큰 숫자(Excel serial)가 있으면 공급일 없는 것
        if 'elapsed' in mapping and mapping['elapsed'] < len(row):
            elapsed_raw = N(row[mapping['elapsed']]) or ''
            # "- 45,914" 패턴 — 공급일 없음 확인
            if re.search(r'4[56],?\d{3}', elapsed_raw):
                supply_date = None
        
        order = {
            "sequence": seq,
            "quantity": round(qty, 2),
            "orderDate": order_date,
            "supplyDate": supply_date,
            "notes": notes,
        }
        
        if label:
            order["label"] = label
        
        orders.append(order)
    
    return orders

def parse_summary_table(table):
    """하단 요약 테이블 파싱 (계약/발주/오차)"""
    summary = {}
    if not table:
        return summary
    for row in table:
        if not row: continue
        key = N(row[0]).replace(' ', '')
        if key == '계약' and len(row) > 1:
            summary['contractQuantity'] = fix_number(row[1])
        elif key == '발주' and len(row) > 1:
            summary['orderQuantity'] = fix_number(row[1])
        elif key == '오차' and len(row) > 1:
            summary['variance'] = fix_number(row[1])
        elif key == '오차율' and len(row) > 1:
            v = N(row[1])
            if v: summary['orderRate'] = v
    return summary

def parse_site_name(text):
    """첫 줄에서 현장명과 납기일 추출"""
    site_name = None
    deadline = None
    
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if lines:
        first = lines[0]
        # "운정4초 납기: 2025-10-20" 패턴
        m = re.search(r'납기[:\s]*(\d{4}[-.]\d{2}[-.]\d{2})', first)
        if m:
            deadline = m.group(1).replace('.', '-')
            site_name = first[:first.index('납기')].strip()
        else:
            site_name = first.strip()
    
    return site_name, deadline

def detect_multi_table(text, tables):
    """2개 병렬 테이블 (AL 3T / GI 1.6T) 감지"""
    # 텍스트 첫 줄에 2개 현장명이 있는지
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    if not lines:
        return False, []
    
    first = lines[0]
    # "청노화 메타융합관 신축공사 (AL 3T) 납기: ... 청노화 메타융합관 신축공사 (GI 1.6T) 납기: ..."
    labels = re.findall(r'\(([^)]+)\)', first)
    if len(labels) >= 2:
        return True, labels
    
    return False, []

def parse_pdf(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
        tables = page.extract_tables() or []
    
    site_name, deadline = parse_site_name(text)
    
    # 멀티 테이블 감지
    is_multi, labels = detect_multi_table(text, tables)
    
    all_orders = []
    summaries = []
    
    if is_multi and len(tables) >= 2:
        # 데이터 테이블들
        data_tables = [t for t in tables if t and len(t) > 2 and any('차수' in N(c or '') for c in (t[0] or []))]
        summary_tables = [t for t in tables if t and any(N(r[0] or '') in ('계약', '발주') for r in t if r)]
        
        for i, dt in enumerate(data_tables):
            label = labels[i] if i < len(labels) else f"테이블{i+1}"
            orders = parse_data_table(dt, label=label)
            all_orders.extend(orders)
        
        for st in summary_tables:
            summaries.append(parse_summary_table(st))
    else:
        # 단일 테이블
        for t in tables:
            if not t or len(t) < 2:
                continue
            header = t[0] or []
            header_text = ' '.join(N(c or '') for c in header)
            
            if '차수' in header_text and '물량' in header_text:
                orders = parse_data_table(t)
                all_orders.extend(orders)
            elif any(N(r[0] or '') in ('계약', '발주') for r in t if r):
                summaries.append(parse_summary_table(t))
    
    # 요약 병합
    merged_summary = {}
    for s in summaries:
        merged_summary.update({k: v for k, v in s.items() if v is not None})
    
    result = {
        "siteName": site_name,
        "deliveryDeadline": deadline,
        "orders": all_orders,
        "summary": merged_summary if merged_summary else None,
        "totalCount": len(all_orders),
    }
    
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "PDF 파일 경로를 지정해주세요."}, ensure_ascii=False))
        sys.exit(1)
    
    try:
        result = parse_pdf(sys.argv[1])
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        import traceback
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}, ensure_ascii=False))
        sys.exit(1)
