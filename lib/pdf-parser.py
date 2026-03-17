import sys, json, re, subprocess, unicodedata, traceback

def install(pkg):
    subprocess.run([sys.executable, "-m", "pip", "install", pkg, "--break-system-packages", "-q"], capture_output=True)

try:
    import pdfplumber
except ImportError:
    install("pdfplumber")
    import pdfplumber

def N(s):
    if not s: return ""
    s = unicodedata.normalize("NFKC", str(s))
    return re.sub(r"[\s\u3000]+", " ", s).strip()

def num(s):
    if not s: return None
    v = re.sub(r"[^\d.]", "", N(str(s)))
    return v if v else None

def parse_date(s):
    if not s: return None
    ns = [x for x in re.findall(r"\d+", str(s)) if len(x) >= 2]
    if len(ns) >= 3 and len(ns[0]) == 4:
        return f"{ns[0]}-{ns[1].zfill(2)}-{ns[2].zfill(2)}"
    return None

def get_texts(pdf):
    results = []
    for page in pdf.pages:
        best = ""
        for xt, yt in [(2,2),(4,4),(6,6),(3,5),(8,8)]:
            t = page.extract_text(x_tolerance=xt, y_tolerance=yt) or ""
            if len(t) > len(best): best = t
        results.append(N(best))
    return results

def get_tables(pdf):
    tbls = []
    for page in pdf.pages:
        for cfg in [
            {"vertical_strategy":"lines","horizontal_strategy":"lines","snap_tolerance":4,"join_tolerance":4},
            {"vertical_strategy":"lines","horizontal_strategy":"lines","snap_tolerance":8,"join_tolerance":8},
            {},
        ]:
            try:
                t = page.extract_tables(cfg) or []
                if t: tbls.extend(t); break
            except: pass
    return tbls

def find_col(row, *keywords):
    for ci, cell in enumerate(row or []):
        cs = N(str(cell)) if cell else ""
        if any(k in cs for k in keywords): return ci
    return None

def parse(pdf_path):
    result = {}
    with pdfplumber.open(pdf_path) as pdf:
        texts = get_texts(pdf)
        tables = get_tables(pdf)

    full = " ".join(texts)
    page1 = texts[0] if texts else ""

    def SA(pat, src=None, flags=re.IGNORECASE):
        return re.search(pat, src if src is not None else full, flags)

    # 납품요구번호
    for pat in [
        r"납\s*품\s*요\s*구\s*번\s*호\s*[:\uff1a]?\s*([A-Z0-9][A-Z0-9\-]{6,28})",
        r"(R\d{2}[A-Z]{2}\d{7,14}(?:-\d{1,3})?)",
    ]:
        m = SA(pat)
        if m: result["contractNo"] = m.group(1).strip(); break

    # 납품요구일자
    for pat in [
        r"납\s*품\s*요\s*구\s*일\s*자\s*[:\uff1a]?\s*(\d{4}[./년-]\s*\d{1,2}[./월-]\s*\d{1,2})",
        r"요\s*구\s*일\s*자\s*[:\uff1a]?\s*(\d{4}[./-]\d{1,2}[./-]\d{1,2})",
    ]:
        m = SA(pat)
        if m: result["contractDate"] = parse_date(m.group(1)); break

    # 계약번호
    m = SA(r"계\s*약\s*번\s*호\s*제?\s*([0-9]{6,}(?:-[0-9]+)*)\s*호")
    if m: result["procurementNo"] = m.group(1).strip()

    # 수요기관
    m = SA(r"수\s*요\s*기\s*관\s*[:\uff1a]\s*([가-힣]{2,30}(?:교육청|시청|군청|구청|청|원|처|부|서|공단|공사|재단)?)")
    if m:
        v = re.sub(r"\s+", "", m.group(1))
        if 2 <= len(v) <= 30: result["clientName"] = v

    # 사업명 - 테이블 우선
    name_found = False
    for table in tables[:5]:
        if not table: continue
        for row in table:
            if not row: continue
            for ci, cell in enumerate(row):
                cs = N(str(cell)) if cell else ""
                if re.search(r"^사\s*업\s*명$", cs.strip()):
                    for nc in row[ci+1:]:
                        nv = N(str(nc)) if nc else ""
                        if nv and len(nv) > 5:
                            result["name"] = nv[:150]
                            name_found = True
                            break
                if name_found: break
            if name_found: break
        if name_found: break

    # 사업명 - 텍스트 패턴 (구매/공사 등 핵심 키워드로 끝나는 부분까지만)
    if not name_found:
        m = SA(r"사\s*업\s*명\s*[:\uff1a]\s*([\(（]?[가-힣A-Za-z0-9()\s\-_/·,]+?(?:구매|공사|납품|시설|설치|사업|시설물))(?=\s)")
        if m:
            v = N(m.group(1)).strip()
            if 5 < len(v) < 150:
                result["name"] = v[:150]
                name_found = True

    # 사업명 - 공사/구매 포함 긴 문장 fallback
    if not name_found:
        candidates = []
        for pat in [
            r"([\(（][가-힣]+[\)）][가-힣A-Za-z0-9()\s\-]{5,100}(?:공사|구매|납품|설치|구축|사업|시설))",
            r"([가-힣A-Za-z0-9()\s]{5,80}(?:신축공사|리모델링|직접구매|자재구매|구매자재)[가-힣A-Za-z0-9()\s]{0,50})",
        ]:
            for m2 in re.finditer(pat, page1, re.IGNORECASE):
                v = N(m2.group(1)).strip()
                if any(x in v for x in ["납품요구번호","계약번호","수요기관","단가","수량","조달청"]): continue
                if 8 < len(v) < 150: candidates.append(v)
        if candidates:
            result["name"] = sorted(candidates, key=len, reverse=True)[0][:150]

    # 사업명 후처리 - 테이블 헤더 잡음 제거
    if result.get("name"):
        n = result["name"]
        for stop_word in ["순 번", "순번", "옵션대", "납 품 기 한", "단 가 수 량", "물품 분류", " 순 "]:
            idx2 = n.find(stop_word)
            if idx2 > 5: n = n[:idx2].strip()
        result["name"] = n.strip()

    # 품명
    for pat in [
        r"(?:외벽패널|내벽패널|지붕패널|금속제\s*패널|알루미늄\s*복합\s*패널|칼라\s*강판|샌드위치\s*패널)",
    ]:
        m = SA(pat)
        if m: result["productName"] = N(m.group(0))[:80]; break

    # 하자담보기간
    m = SA(r"하\s*자\s*담\s*보\s*(?:책임)?\s*기\s*간\s*[:\uff1a비고]?\s*(\d+)\s*년")
    result["warrantyPeriod"] = int(m.group(1)) if m else 2

    # 계약금액 - 여러 패턴 순서대로 시도
    amount_patterns = [
        r"품\s*대\s*계?\s*(\d{1,3}(?:,\d{3})+)",
        r"합\s*계\s*금\s*액\s*(\d{1,3}(?:,\d{3})+)",
        r"납\s*품\s*금\s*액\s*(\d{1,3}(?:,\d{3})+)",
        r"계\s*약\s*금\s*액\s*(\d{1,3}(?:,\d{3})+)",
        r"총\s*금\s*액\s*(\d{1,3}(?:,\d{3})+)",
        r"공\s*급\s*가\s*액\s*(\d{1,3}(?:,\d{3})+)",
        r"물\s*품\s*대\s*금\s*(\d{1,3}(?:,\d{3})+)",
    ]
    for pat in amount_patterns:
        m = SA(pat)
        if m:
            v = int(m.group(1).replace(",",""))
            if v >= 100000:
                result["contractAmount"] = v
                break

    # 테이블 합계행에서 금액 추출 (텍스트 패턴 모두 실패 시)
    if not result.get("contractAmount"):
        for table in tables:
            if not table or len(table) < 2: continue
            for row in table:
                if not row: continue
                row_text = " ".join(N(str(c)) for c in row if c)
                if any(k in row_text for k in ["합 계","합계","품대계","총 계","총계","소 계","소계"]):
                    for cell in reversed(row):
                        cs = N(str(cell)) if cell else ""
                        digits = re.sub(r"[^\d]","",cs)
                        if len(digits) >= 6:
                            try:
                                v = int(digits)
                                if v >= 100000:
                                    result["contractAmount"] = v
                                    break
                            except: pass
                    if result.get("contractAmount"): break
            if result.get("contractAmount"): break

    # 검사/검수기관 - 테이블 열 위치
    insp_found = False
    for table in tables:
        if not table or len(table) < 2: continue
        insp_ci = None; accept_ci = None
        for row in table[:8]:
            if not row: continue
            for ci, cell in enumerate(row):
                cs = N(str(cell)) if cell else ""
                if re.search(r"^검\s*사$", cs.strip()) and insp_ci is None: insp_ci = ci
                if re.search(r"^검\s*수$", cs.strip()) and accept_ci is None: accept_ci = ci
            if insp_ci is not None or accept_ci is not None: break
        if insp_ci is not None or accept_ci is not None:
            for row in table[1:]:
                if not row: continue
                if insp_ci is not None and insp_ci < len(row) and row[insp_ci]:
                    v = N(str(row[insp_ci])).strip()
                    if v and len(v) > 2 and v not in ("검사","N","Y"):
                        result["inspectionAgency"] = v[:50]; insp_found = True
                if accept_ci is not None and accept_ci < len(row) and row[accept_ci]:
                    v = N(str(row[accept_ci])).strip()
                    if v and len(v) > 2 and v not in ("검수","N","Y"):
                        result["acceptanceAgency"] = v[:50]
                if insp_found: break

    # 검사기관 - 텍스트 패턴 ("가능 A A B B" → 검사=A+B, 검수=A+B)
    if not insp_found:
        m = re.search(r"가\s*능\s+(.*?)(?=\s*사\s*업\s*명|\s*순\s*번|$)", full)
        if m:
            tokens = m.group(1).strip().split()
            n = len(tokens)
            if n == 4 and tokens[0] == tokens[1] and tokens[2] == tokens[3]:
                # "A A B B" 패턴: A+B가 한 기관 (검사=검수)
                result["inspectionAgency"] = f"{tokens[0]} {tokens[2]}"[:50]
                result["acceptanceAgency"] = f"{tokens[1]} {tokens[3]}"[:50]
            elif n >= 2:
                half = n // 2
                result["inspectionAgency"] = " ".join(tokens[:half])[:50]
                result["acceptanceAgency"] = " ".join(tokens[half:])[:50]

    if result.get("inspectionAgency"):
        ag = result["inspectionAgency"]
        if "조달청" in ag: result["inspectionAgencyType"] = "조달청"
        elif any(k in ag for k in ["한국","KCL","KTR","시험원","연구원","전문"]):
            result["inspectionAgencyType"] = "전문검사기관"
            result["inspectionBody"] = ag
        else: result["inspectionAgencyType"] = "수요기관 자체"

    # 테이블: 단가/수량/납기
    COL_MAP = {
        "seq": ["순번","순 번"],
        "unit_price": ["단 가","단가","금 액","금액"],
        "quantity": ["수 량","수량","QTY","물량"],
        "deadline": ["납품기한","납기","납품일","기한"],
        "spec": ["규격","규 격","사양"],
        "product": ["품명","물품명","품 명"],
        "unit": ["단위"],
    }
    items = []
    for table in tables:
        if not table or len(table) < 2: continue
        hdri = -1; cmap = {}
        for ri, row in enumerate(table[:8]):
            if not row: continue
            rs = " ".join(N(str(c)) for c in row if c)
            if any(k in rs for k in ["단가","수량","단 가","수 량","납품기한","품명"]):
                hdri = ri
                for key, variants in COL_MAP.items():
                    ci2 = find_col(row, *variants)
                    if ci2 is not None: cmap[key] = ci2
                break
        if hdri < 0: continue
        current_item = {}
        for row in table[hdri+1:]:
            if not row or not any(row): continue
            c2 = [N(str(x)) if x else "" for x in row]
            seq_val = c2[cmap["seq"]] if "seq" in cmap and cmap["seq"] < len(c2) else c2[0] if c2 else ""
            is_item = bool(seq_val and re.match(r"^\d+$", seq_val.strip()))
            if is_item:
                if current_item: items.append(current_item)
                current_item = {"seq": seq_val.strip()}
                if "product" in cmap and cmap["product"] < len(c2) and c2[cmap["product"]]:
                    current_item["productName"] = c2[cmap["product"]][:80]
                for ci3 in ([cmap["unit_price"]] if "unit_price" in cmap else [6,5,7,8]):
                    if ci3 < len(c2) and c2[ci3]:
                        n = num(c2[ci3])
                        if n:
                            try: current_item["unitPrice"] = int(float(n)); break
                            except: pass
                for ci3 in ([cmap["quantity"]] if "quantity" in cmap else [7,6,8,5]):
                    if ci3 < len(c2) and c2[ci3]:
                        n = num(c2[ci3])
                        if n:
                            try: current_item["contractQuantity"] = float(n); break
                            except: pass
                dl = ""
                if "deadline" in cmap and cmap["deadline"] < len(c2): dl = c2[cmap["deadline"]]
                if not dl:
                    for cv in c2:
                        if re.search(r"\d{4}[./-]\d{1,2}[./-]\d{1,2}", cv): dl = cv; break
                if dl:
                    d = parse_date(dl)
                    if d: current_item["deliveryDeadline"] = d
                row_text = " ".join(c2)
                if "설치도" in row_text: current_item["siteType"] = "납품설치도"
                elif "하차도" in row_text: current_item["siteType"] = "납품하차도"
            elif current_item:
                for v2 in c2:
                    if v2 and len(v2) > 5 and not current_item.get("specification"):
                        if any(ch in v2 for ch in ["T","mm","AL","SUS","KS","초내후","분체","평판","덕인","MS-"]):
                            current_item["specification"] = v2[:200]; break
        if current_item: items.append(current_item)

    if items:
        first = items[0]
        for k in ("unitPrice","contractQuantity","deliveryDeadline","siteType","productName","specification"):
            if first.get(k) and not result.get(k): result[k] = first[k]
        if len(items) > 1: result["productItems"] = items

    result.setdefault("siteType", "납품설치도")

    # 납품기한 보완
    if not result.get("deliveryDeadline"):
        m = SA(r"납\s*품\s*기\s*한\s*[:\uff1a]?\s*(\d{4}[./-]\d{1,2}[./-]\d{1,2})")
        if m:
            d = parse_date(m.group(1))
            if d: result["deliveryDeadline"] = d

    # 수량 보완
    if not result.get("contractQuantity"):
        m = SA(r"수\s*량\s*합\s*계\s*[:\uff1a]?\s*([\d,]+)")
        if m:
            n = num(m.group(1))
            if n:
                try: result["contractQuantity"] = float(n)
                except: pass

    # 규격 보완
    if not result.get("specification"):
        m = SA(r"((?:MS|AL|SUS|ACP)[-\s]?[A-Za-z0-9\-./×xTt\s,]+(?:mm|t|T|초내후성|분체|평판)[A-Za-z가-힣0-9\s,./×-]{0,80})")
        if m: result["specification"] = N(m.group(1))[:200]

    # 실수요부서 담당자
    m2 = re.search(
        r"실수요부서\s*담당자[,，\s]*전화번호\s*[:\uff1a]?\s*([^\d]+?)\s*(0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4})",
        full
    )
    if m2:
        raw = m2.group(1).strip()
        result["clientManagerPhone"] = re.sub(r"\s","",m2.group(2).strip())
        nm = re.search(r"^(.+?(?:과|팀|부|실|센터|원|처))\s*([가-힣]{2,5})$", raw)
        if nm: result["clientDept"] = nm.group(1).strip(); result["clientManager"] = nm.group(2).strip()
        else: result["clientManager"] = raw.strip()

    if not result.get("name"):
        parts = []
        if result.get("clientName"): parts.append(result["clientName"])
        if result.get("productName"): parts.append(result["productName"])
        if parts: result["name"] = " ".join(parts) + " 납품"

    return result

if __name__ == "__main__":
    try:
        r = parse(sys.argv[1])
        print(json.dumps(r, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
