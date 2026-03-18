# -*- coding: utf-8 -*-
import sys, json, re, subprocess, unicodedata, traceback

def install(pkg):
    subprocess.run([sys.executable, "-m", "pip", "install", pkg, "--break-system-packages", "-q"], capture_output=True)

try:
    import pdfplumber
except ImportError:
    install("pdfplumber")
    import pdfplumber


# ── 유틸 ──────────────────────────────────────────────────────────────────────

def N(s):
    """NFKC 정규화 + 연속공백 → 단일공백"""
    if not s: return ""
    return re.sub(r"[\s\u3000]+", " ", unicodedata.normalize("NFKC", str(s))).strip()

def strip_sp(s):
    """공백 완전 제거 (패턴매칭용)"""
    return re.sub(r"\s+", "", N(s))

def to_int(s):
    if not s: return None
    v = re.sub(r"[^\d]", "", str(s))
    return int(v) if v else None

def to_float(s):
    if not s: return None
    v = re.sub(r"[^\d.]", "", str(s))
    try: return float(v)
    except: return None

def parse_date(s):
    if not s: return None
    nums = [x for x in re.findall(r"\d+", str(s)) if len(x) >= 2]
    if len(nums) >= 3 and len(nums[0]) == 4:
        return f"{nums[0]}-{nums[1].zfill(2)}-{nums[2].zfill(2)}"
    return None


# ── PDF 원문/테이블 추출 ───────────────────────────────────────────────────────

def extract(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[0]
        
        # 텍스트: 여러 tolerance 시도해서 가장 긴 것 선택
        best = ""
        for xt, yt in [(4,4),(2,2),(6,6),(3,5)]:
            t = page.extract_text(x_tolerance=xt, y_tolerance=yt) or ""
            if len(t) > len(best): best = t
        
        # 테이블: 선 기반 우선
        tables = []
        for cfg in [
            {"vertical_strategy":"lines","horizontal_strategy":"lines","snap_tolerance":4,"join_tolerance":4},
            {"vertical_strategy":"lines","horizontal_strategy":"lines","snap_tolerance":8,"join_tolerance":8},
            {},
        ]:
            try:
                t = page.extract_tables(cfg) or []
                if t: tables = t; break
            except: pass
    
    lines = [N(l) for l in best.split("\n") if N(l)]
    return lines, tables


# ── 필드별 파서 ───────────────────────────────────────────────────────────────

def get_name(lines):
    """
    사업명.
    PDF 텍스트 줄 예:
      "사 업 명 : 평택교육지원청청사이전사업직접구매자재(금속제패널)구매"
      "사 업 명 : [면목유수지문화체육복합센터건립-금속제패널]"
      "사 업 명 : *퇴계동국민체육센터건립공사(건축)관급자재(알루미늄내진패널)"
    → "사 업 명 :" 뒤 텍스트를 공백 제거 없이 그대로 반환
      (조달청 PDF는 이미 한 줄에 전체 사업명이 들어있음)
    """
    for line in lines:
        m = re.search(r"사\s*업\s*명\s*[:\uff1a]\s*(.+)", line)
        if m:
            v = m.group(1).strip()
            # 뒤에 붙은 순번헤더 잡음 제거
            for sw in ["순 번", "순번", "옵션대", "납 품 기 한"]:
                idx = v.find(sw)
                if idx > 5: v = v[:idx].strip()
            if len(v) > 4:
                return v
    return None

def get_client(lines):
    """
    수요기관.
    PDF 텍스트 줄 예:
      "수 요 기 관:경기도교육청경기도평택교육지원청 계 약 자 :덕인금속주식회사"
      "수 요 기 관:서울특별시중랑구 계 약 자 :덕인금속주식회사"
    → "수 요 기 관:" 와 "계 약 자" 사이만 추출
    """
    for line in lines:
        # "수 요 기 관:" 뒤 ~ "계 약 자" 앞
        m = re.search(r"수\s*요\s*기\s*관\s*[:\uff1a]([^:\n]+?)(?=계\s*약\s*자|$)", line)
        if m:
            v = strip_sp(m.group(1))
            # 전화번호 붙은 경우 제거 (031-xxx 패턴)
            v = re.sub(r"\d{2,3}-\d+.*$", "", v).strip()
            if 2 <= len(v) <= 50:
                return v
    return None

def get_req_no(lines):
    """납품요구번호: R25TB01244526-00 또는 2324463746-01"""
    for line in lines:
        m = re.search(r"납\s*품\s*요\s*구\s*번\s*호\s*[:\uff1a]\s*([A-Z0-9][A-Z0-9\-]{5,25})", line)
        if m: return m.group(1).strip()
    return None

def get_req_date(lines):
    """납품요구일자"""
    for line in lines:
        m = re.search(r"납\s*품\s*요\s*구\s*일\s*자\s*[:\uff1a]\s*(\d{4}[./]\d{1,2}[./]\d{1,2})", line)
        if m: return parse_date(m.group(1))
    return None

def get_contract_no(lines):
    """계약번호: 계약번호 제002370053-10호"""
    full = " ".join(lines)
    m = re.search(r"계\s*약\s*번\s*호\s*제?\s*([\d]{6,}(?:-[\d]+)*)\s*호", full)
    if m: return m.group(1).strip()
    return None

def get_warranty(lines):
    """하자담보기간"""
    full = " ".join(lines)
    m = re.search(r"하\s*자\s*담\s*보\s*(?:책임)?\s*기\s*간\s*[:\uff1a비고]?\s*(\d+)\s*년", full)
    return int(m.group(1)) if m else 2

def get_amounts(tables):
    """
    합계금액 테이블 (Table[1]).
    구조: 헤더행=[품대계, 수수료, 합계금액, 분할납품, 검사, 검수]
          데이터행=[719218040, 3557540, 722775580, 가능, 검사기관명, 검수기관명]
    """
    result = {}
    for table in tables:
        if not table or len(table) < 2: continue
        h = " ".join(str(c) for c in (table[0] or []) if c)
        if "품 대 계" not in h and "합 계 금 액" not in h: continue
        
        row = table[1]
        if not row: continue
        cells = [N(str(c)) if c else "" for c in row]
        
        # 품대계
        v = to_int(cells[0]) if len(cells) > 0 else None
        if v and v > 10000: result["contractAmount"] = v
        # 합계금액(수수료포함)
        v = to_int(cells[2]) if len(cells) > 2 else None
        if v and v > 10000: result["totalAmount"] = v
        # 검사기관
        if len(cells) > 4 and cells[4] and len(cells[4].replace("\n","").strip()) > 1:
            result["inspectionAgency"] = cells[4].replace("\n", "").strip()
        # 검수기관
        if len(cells) > 5 and cells[5] and len(cells[5].replace("\n","").strip()) > 1:
            result["acceptanceAgency"] = cells[5].replace("\n", "").strip()
        break
    return result

def get_items(tables):
    """
    품목 테이블 파싱 (Table[2]).
    
    19개 PDF 분석 결과 완전히 동일한 구조:
      행0: 헤더  [순번, 옵션대상품목번호, 물품분류번호, 물품식별번호, 품명, 단위, 단가, 수량, 납품기한, 검사면제여부, 중기간경쟁물품여부]
      행1: 서브  [∅, ∅, ∅, ∅, 규격, ∅, 금액, 납품장소, 인도조건, ∅, ∅]
      행2: 데이터A(메인행) [1, ∅, 30151802, 24384971, 외벽패널, ㎡, 220800, 1892, 2026/05/10, N, Y]
      행3: 데이터B(규격행) [∅, ∅, ∅, ∅, 금속제패널,덕인금속,MS-A03-01..., ∅, 417753600, 수요기관지정장소, 현장설치도, ∅, ∅]
      행4: 데이터A(2번째 품목, 있는 경우)
      행5: 데이터B(2번째 규격)
      ...
    
    메인행 판별: cells[0]이 숫자
    규격행 판별: cells[0]이 비어있고 cells[4]에 스펙 문자열
    """
    items = []
    
    for table in tables:
        if not table or len(table) < 3: continue
        h = " ".join(str(c) for c in (table[0] or []) if c)
        if "단 가" not in h or "수 량" not in h: continue
        
        current = None
        
        for row in table[2:]:  # 헤더(행0), 서브헤더(행1) 스킵
            if not row or not any(c for c in row): continue
            cells = [N(str(c)) if c else "" for c in row]
            
            seq = cells[0].strip()
            is_main = bool(seq and re.match(r"^\d+$", seq))
            
            if is_main:
                if current: items.append(current)
                
                current = {
                    "seq":              seq,
                    "productName":      cells[4].strip()   if len(cells) > 4 else "",
                    "spec":             "",   # 다음 규격행에서 채움
                    "unit":             cells[5].strip()   if len(cells) > 5 else "",
                    "unitPrice":        to_float(cells[6]) if len(cells) > 6 else None,
                    "contractQuantity": to_float(cells[7]) if len(cells) > 7 else None,
                    "amount":           None,
                    "deliveryDeadline": parse_date(cells[8]) if len(cells) > 8 else None,
                    "siteType":         None,
                }
                
                # 납품기한이 col8에 없으면 행 전체에서 날짜 찾기
                if not current["deliveryDeadline"]:
                    for c in cells:
                        d = parse_date(c)
                        if d: current["deliveryDeadline"] = d; break
            
            elif current is not None:
                # 규격행: col4=규격문자열, col6=금액, col8=인도조건
                spec_raw = cells[4].strip() if len(cells) > 4 else ""
                if spec_raw:
                    current["spec"] = spec_raw
                
                amt = to_int(cells[6]) if len(cells) > 6 else None
                if amt and amt > 1000:
                    current["amount"] = amt
                
                cond = cells[8].strip() if len(cells) > 8 else ""
                if "설치도" in cond:
                    current["siteType"] = "납품설치도"
                elif "하차도" in cond:
                    current["siteType"] = "납품하차도"
        
        if current: items.append(current)
        
        if items: break  # 품목 테이블 찾았으면 중단
    
    return items

def get_manager(lines):
    """
    실수요부서 담당자.
    패턴: "-실수요부서담당자,전화번호:인구정책과김지혜041-950-4344"
          "-실수요부서담당자,전화번호:경기도평택교육지원청교육시설과양지인주무관(031-650-1283)"
    """
    full = " ".join(lines)
    m = re.search(
        r"실수요부서\s*담당자[,，\s]*전화번호\s*[:\uff1a]?\s*([^0-9\n]+?)\s*(0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4})",
        full
    )
    if not m: return {}
    
    raw = m.group(1).strip()
    phone = re.sub(r"\s", "", m.group(2).strip())
    
    # 괄호 이후 제거 ("양지인 주무관(" → "양지인 주무관")
    raw = re.sub(r"[\(（].*$", "", raw).strip()
    
    result = {"clientManagerPhone": phone}
    
    # 부서명 + 담당자명 분리
    # 패턴: "인구정책과김지혜" → dept=인구정책과, mgr=김지혜
    # 패턴: "경기도평택교육지원청교육시설과양지인주무관" → dept=...시설과, mgr=양지인
    nm = re.search(
        r"^(.+?(?:과|팀|부|실|센터|원|처))\s*([가-힣]{2,5})\s*(?:주무관|담당관|담당|계장|팀장|과장|주임|사무관)?\s*$",
        raw
    )
    if nm:
        result["clientDept"]    = nm.group(1).strip()
        result["clientManager"] = nm.group(2).strip()
    else:
        result["clientManager"] = raw.strip()
    
    return result


# ── 메인 파서 ─────────────────────────────────────────────────────────────────

def parse(pdf_path):
    lines, tables = extract(pdf_path)
    full = " ".join(lines)
    
    result = {}
    
    # 기본 필드
    result["contractNo"]    = get_req_no(lines)
    result["contractDate"]  = get_req_date(lines)
    result["procurementNo"] = get_contract_no(lines)
    result["clientName"]    = get_client(lines)
    result["name"]          = get_name(lines)
    result["warrantyPeriod"]= get_warranty(lines)
    
    # 금액/검사기관 (테이블)
    amounts = get_amounts(tables)
    result.update(amounts)
    
    # 품목 (테이블)
    items = get_items(tables)
    
    if items:
        first = items[0]
        # 대표값: 첫 번째 품목 기준
        result["productName"]  = first.get("productName") or ""
        result["specification"]= first.get("spec") or ""
        result["unitPrice"]    = first.get("unitPrice")
        result["deliveryDeadline"] = first.get("deliveryDeadline")
        result["siteType"]     = first.get("siteType") or "납품설치도"
        
        if len(items) == 1:
            result["contractQuantity"] = first.get("contractQuantity")
        else:
            # 복수 품목: 수량 합산, 상세는 productItems에
            result["contractQuantity"] = sum(
                (it.get("contractQuantity") or 0) for it in items
            )
            result["productItems"] = [
                {
                    "seq":              it.get("seq"),
                    "productName":      it.get("productName", ""),
                    "spec":             it.get("spec", ""),
                    "unit":             it.get("unit", ""),
                    "unitPrice":        it.get("unitPrice"),
                    "contractQuantity": it.get("contractQuantity"),
                    "amount":           it.get("amount"),
                    "deliveryDeadline": it.get("deliveryDeadline"),
                }
                for it in items
            ]
    
    # 수량 보완 (테이블 파싱 실패 시 텍스트에서)
    if not result.get("contractQuantity"):
        m = re.search(r"수\s*량\s*합\s*계\s*[:\uff1a]?\s*([\d,]+)", full)
        if m:
            v = to_float(m.group(1))
            if v: result["contractQuantity"] = v
    
    # 납품기한 보완
    if not result.get("deliveryDeadline"):
        m = re.search(r"납\s*품\s*기\s*한\s*[:\uff1a]?\s*(\d{4}[./]\d{1,2}[./]\d{1,2})", full)
        if m:
            result["deliveryDeadline"] = parse_date(m.group(1))
    
    # 규격 보완
    if not result.get("specification"):
        m = re.search(
            r"((?:MS|AL|SUS|ACP)[-\s]?[A-Za-z0-9\-./×xTt\s,]+(?:mm|초내후성|분체|평판)[A-Za-z가-힣0-9\s,./×-]{0,60})",
            full
        )
        if m: result["specification"] = N(m.group(1))[:200]
    
    # 검사기관 유형 분류
    ag = result.get("inspectionAgency", "")
    if ag:
        if "조달청" in ag:
            result["inspectionAgencyType"] = "조달청"
        elif any(k in ag for k in ["한국","KCL","KTR","시험원","연구원"]):
            result["inspectionAgencyType"] = "전문검사기관"
            result["inspectionBody"] = ag
        else:
            result["inspectionAgencyType"] = "수요기관 자체"
    
    # 담당자
    mgr = get_manager(lines)
    result.update(mgr)
    
    # 사업명 최종 fallback
    if not result.get("name"):
        parts = []
        if result.get("clientName"): parts.append(result["clientName"])
        if result.get("productName"): parts.append(result["productName"])
        if parts: result["name"] = " ".join(parts) + " 납품"
    
    result.setdefault("siteType", "납품설치도")
    
    # None 값 제거
    return {k: v for k, v in result.items() if v is not None and v != "" and v != 0}


if __name__ == "__main__":
    try:
        print(json.dumps(parse(sys.argv[1]), ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
