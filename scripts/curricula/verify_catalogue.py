#!/usr/bin/env python3
"""Conservative Aalto catalogue verifier: no source text => no automatic confirmation."""
import argparse
import csv
import hashlib
import html
import json
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_INPUT = REPO_ROOT / "data" / "curricula" / "catalogue-reviewed.csv"

FIELDNAMES = ['record_id','kind','name','official_code','basic_studies_code','curriculum_period',
              'source_url','previous_review_status','notes','url_class','http_status','final_url',
              'page_title','name_evidence','code_evidence','period_evidence','candidate_codes',
              'duplicate_code_group','machine_status','review_decision','verified_code',
              'verified_source_url','verified_period','review_notes','reviewed_on']
PERIOD = re.compile(r'2026\s*[–−—-]\s*2028', re.I)
CODE = re.compile(r'(?<![\w-])(?:ARTS|BIZ|CHEM|ELEC|ENG|SCI|CS|MS|JOIN)[- .]?[A-Z0-9]{2,}(?:\.[A-Z0-9]+)?(?![\w-])', re.I)
INDEX_PATHS = {'/en/minors','/fi/sivuaineet','/en/study-at-aalto/masters-programmes'}

def clean(s): return ' '.join(html.unescape(s or '').split())
def norm(s):
    import unicodedata
    return ' '.join(re.findall(r'\w+',unicodedata.normalize('NFKD',s or '').casefold()))
def key(row):
    text = '\0'.join(row[k] for k in ('kind','name','curriculum_period'))
    return hashlib.sha256(text.encode()).hexdigest()[:12]
def url_class(url):
    try:
        p=urlparse(url)
        if p.scheme!='https' or p.hostname not in ('www.aalto.fi','aalto.fi'): return 'non-official-url'
        if p.path.rstrip('/') in INDEX_PATHS: return 'catalogue-index'
        return 'individual-or-programme-page'
    except Exception: return 'invalid-url'

def inspect_html(document,row):
    from bs4 import BeautifulSoup
    soup=BeautifulSoup(document,'html.parser')
    for el in soup(['script','style','nav','footer','header']): el.decompose()
    title=clean(soup.title.get_text(' ',strip=True) if soup.title else '')[:180]
    main=soup.find('main') or soup
    body=clean(main.get_text(' ',strip=True))
    # The official name can be a subheading within a multi-major programme page.
    n=norm(row['name']); normalized=norm(body)
    name_evidence='found' if n and n in normalized else 'not-found'
    code=row['official_code'].strip()
    code_evidence='not-supplied' if not code else ('found' if re.search(r'(?<![A-Za-z0-9])'+re.escape(code)+r'(?![A-Za-z0-9])',body,re.I) else 'not-found')
    period_evidence='found' if PERIOD.search(body) else 'not-found'
    candidates=list(dict.fromkeys(x.upper() for x in CODE.findall(body)))[:35]
    return dict(page_title=title,name_evidence=name_evidence,code_evidence=code_evidence,
                period_evidence=period_evidence,candidate_codes='; '.join(candidates))

def get_document(session,url,cache,timeout,delay):
    path=cache/(hashlib.sha256(url.encode()).hexdigest()+'.html')
    if path.exists(): return (path.read_text('utf-8'),200,url,'cached')
    try:
        time.sleep(delay)
        response=session.get(url,timeout=timeout,headers={'User-Agent':'Sisukas curriculum metadata verifier (manual review; educational project)'})
        response.raise_for_status()
        if 'html' not in response.headers.get('content-type','').lower():return ('',response.status_code,response.url,'not-html')
        path.write_text(response.text,'utf-8')
        return (response.text,response.status_code,response.url,'fetched')
    except Exception as exc: return ('',0,url,type(exc).__name__+': '+str(exc)[:200])

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--input',type=Path,default=DEFAULT_INPUT, help='Reviewed catalogue CSV (read-only)')
    ap.add_argument('--output',type=Path,default=Path(__file__).resolve().parent / '.cache', help='Directory for disposable machine-generated reports')
    ap.add_argument('--fetch',action='store_true',help='Fetch and cache official HTML pages; default is offline structural audit')
    ap.add_argument('--delay',type=float,default=1.0,help='Seconds between requests for uncached pages')
    ap.add_argument('--timeout',type=float,default=20.0)
    ap.add_argument('--limit',type=int,default=0,help='Maximum distinct URLs to fetch this run; 0 means all')
    args=ap.parse_args()
    if args.delay<0 or args.limit<0: ap.error('delay and limit must not be negative')
    if not args.input.is_file(): ap.error(f'Input file not found: {args.input}')
    if args.output.resolve() == args.input.resolve() or args.input.resolve().is_relative_to(args.output.resolve()):
        ap.error('Output directory must not contain the reviewed input catalogue')
    with args.input.open(newline='',encoding='utf-8-sig') as f:
        reader=csv.DictReader(f)
        rows=list(reader)
        columns=set(reader.fieldnames or [])
    needed={'kind','name','official_code','basic_studies_code','curriculum_period','source_url','notes'}
    if not rows or not needed.issubset(columns): ap.error('Unexpected input CSV schema')
    args.output.mkdir(parents=True,exist_ok=True)
    cache=args.output/'html-cache';cache.mkdir(exist_ok=True)
    codes=defaultdict(list)
    for row in rows:
        if row['official_code'].strip():codes[(row['official_code'].strip().upper(),row['curriculum_period'])].append(row['name'])
    pages={}
    session=None
    if args.fetch:
        try:import requests
        except ImportError: ap.error('Install requests and beautifulsoup4: pip install -r requirements.txt')
        session=requests.Session()
        targets=list(dict.fromkeys(r['source_url'].strip() for r in rows if url_class(r['source_url'].strip())=='individual-or-programme-page'))
        if args.limit:targets=targets[:args.limit]
        print(f'Fetching up to {len(targets)} distinct official URLs (cached on reruns)',file=sys.stderr)
        for i,url in enumerate(targets,1):
            pages[url]=get_document(session,url,cache,args.timeout,args.delay)
            if i%10==0 or i==len(targets):print(f'  {i}/{len(targets)} URLs processed',file=sys.stderr)
    results=[]
    for row in rows:
        u=row['source_url'].strip();cls=url_class(u)
        rec={k:row.get(k,'') for k in ['kind','name','official_code','basic_studies_code','curriculum_period','source_url','notes']}
        # Preserve existing human annotations; this tool must never reset them.
        rec.update(record_id=row.get('record_id','').strip() or key(row),previous_review_status=row.get('previous_review_status',row.get('review_status','')),url_class=cls,http_status='',final_url='',page_title='',name_evidence='not-checked',code_evidence='not-checked',period_evidence='not-checked',candidate_codes='',duplicate_code_group='',review_decision=row.get('review_decision',''),verified_code=row.get('verified_code',''),verified_source_url=row.get('verified_source_url',''),verified_period=row.get('verified_period',''),review_notes=row.get('review_notes',''),reviewed_on=row.get('reviewed_on',''))
        if row['official_code'].strip() and len(codes[(row['official_code'].strip().upper(),row['curriculum_period'])])>1:
            rec['duplicate_code_group']='; '.join(codes[(row['official_code'].strip().upper(),row['curriculum_period'])])
        if cls!='individual-or-programme-page':status='needs-direct-source'
        elif not row['official_code'].strip():status='needs-code'
        else:status='needs-page-check'
        if u in pages:
            doc,status_code,final_url,fetch_note=pages[u]
            rec['http_status']=str(status_code);rec['final_url']=final_url
            if not doc:status='fetch-failed';rec['review_notes']=fetch_note
            else:
                rec.update(inspect_html(doc,row))
                if rec['name_evidence']=='found' and rec['code_evidence']=='found' and rec['period_evidence']=='found':status='evidence-found-review-required'
                else:status='evidence-incomplete-review-required'
        if rec['duplicate_code_group']:status+='; possible-duplicate'
        rec['machine_status']=status
        results.append(rec)
    csvpath=args.output/'verification.csv'
    if csvpath.resolve() == args.input.resolve(): ap.error('Output CSV would overwrite reviewed input')
    with csvpath.open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=FIELDNAMES);w.writeheader();w.writerows(results)
    by_decision=Counter(r['review_decision'].strip() or 'unreviewed' for r in results)
    by_kind=Counter(r['kind'] for r in results)
    by_status=Counter(r['machine_status'] for r in results)
    report=['# Curriculum catalogue verification report','',f'Generated: {date.today().isoformat()}',f'Input: `{args.input}`','',f'Total candidates: **{len(results)}**','','## Candidates by category','']
    report.extend(f'- {k}: {v}' for k,v in sorted(by_kind.items()))
    report+=['','## Existing human review decisions','']
    report.extend(f'- {k}: {v}' for k,v in sorted(by_decision.items()))
    report+=['','## Machine review statuses','']
    report.extend(f'- {k}: {v}' for k,v in sorted(by_status.items()))
    report+=['','## Interpretation','',
             '- **No entry is approved automatically.** Even when names, codes, and year text all appear, the relevant code must be checked in the correct programme or module section.',
             '- A catalogue-index URL is not an individual curriculum source.',
             '- A missing code is not a claim that the curriculum has no code.',
             '- Multi-major programme pages can contain codes for unrelated modules. `evidence-found` is only a review queue, not proof of association.',
             '- For minor pages, verify level and years; pages can contain old and new periods.',
             '- Record decisions as `include`, `exclude`, `merge`, or `defer` in the curated input CSV, not the generated report.',
             '- Human review fields are copied to this report for convenience, but the curated input CSV is never changed. Do not use generated output as the source of truth.',
             '',f'CSV: `{csvpath.name}`','']
    (args.output/'REPORT.md').write_text('\n'.join(report),encoding='utf-8')
    print('\n'.join(report[:12]));print(f'\nWritten: {csvpath} and {args.output / "REPORT.md"}')
if __name__=='__main__':main()
