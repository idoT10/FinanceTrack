import json, random, datetime as dt
random.seed(20261011)
TZ=dt.timezone(dt.timedelta(hours=3))
START=dt.date(2026,4,1); TODAY=dt.date(2026,10,11)
def ms(d,h=12,m=0,s=0): return int(dt.datetime(d.year,d.month,d.day,h,m,s,tzinfo=TZ).timestamp()*1000)
def days():
    d=START
    while d<=TODAY: yield d; d+=dt.timedelta(days=1)

# ---------- categories: 8 defaults (same names as the app) + custom ----------
CATS=[('super','סופר','🛒','expense','#4E9A5F'),('eat','אוכל בחוץ','☕','expense','#D0663A'),('car','תחבורה ודלק','🚗','expense','#3F6FB5'),
      ('home','דיור וחשבונות','🏠','expense','#B3568A'),('fun','פנאי','🎬','expense','#7153A8'),('shop','קניות','🛍️','expense','#C83E52'),
      ('salary','משכורת','💼','income','#2A98A8'),('extra','הכנסה נוספת','✨','income','#C9A12E'),
      ('subs','מנויים','📱','expense','#2A98A8'),('health','בריאות','💊','expense','#4E9A5F'),('pet','חיות מחמד','🐶','expense','#C9A12E'),
      ('gift','מתנות','🎁','expense','#B3568A'),('refund','החזרים','🧾','income','#7C8580')]
categories=[{'id':'demo-cat-'+k,'name':n,'icon':i,'type':t,'color':c,'ord':idx+1} for idx,(k,n,i,t,c) in enumerate(CATS)]
cname={'demo-cat-'+k:n for k,n,*_ in CATS}

tx=[]; seq=[0]
def add(d,amount,cat,note='',typ=None,catName=None,hour=None):
    seq[0]+=1
    cid=None if cat is None else ('demo-cat-'+cat if not cat.startswith('demo-') else cat)
    t=typ or ('income' if cat in ('salary','extra','refund') else 'expense')
    h=hour if hour is not None else random.randint(8,22)
    tx.append({'id':'demo-tx-%04d'%seq[0],'type':t,'amount':round(amount,2),'categoryId':cid,
               'catName':catName if catName is not None else (cname.get(cid,'') if cid else ''),
               'date':d.isoformat(),'note':note,'createdAt':ms(d,h,random.randint(0,59),random.randint(0,59))})
R=lambda a,b,step=1: round(random.uniform(a,b)/step)*step

for d in days():
    dom,wd=d.day,d.weekday()   # Mon=0 … Sun=6
    # fixed monthly
    if dom==1: add(d,4800,'home','שכירות',hour=9)
    if dom==10: add(d,14500,'salary','משכורת '+['','','','','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר'][d.month],hour=8)
    if dom==2: add(d,99,'home','אינטרנט',hour=7)
    if dom==5: add(d,21.90,'subs','ספוטיפיי',hour=6); add(d,54.90,'subs','נטפליקס',hour=6)
    if dom==8: add(d,11.90,'subs','iCloud',hour=6)
    if dom==15: add(d,199,'subs','חדר כושר',hour=6)
    if dom==20 and d.month%2==0: add(d,R(380,520),'home','חשמל')
    if dom==20 and d.month%2==1: add(d,R(160,210),'home','מים')
    if dom==12 and d.month%2==0: add(d,648,'home','ארנונה')
    if dom==3: add(d,R(160,195),'pet','אוכל לכלב')
    # weekly-ish
    if wd in (1,4) or (wd==6 and random.random()<.5): add(d,R(140,680,0.1),'super',random.choice(['שופרסל','רמי לוי','יוחננוף','מכולת','']))
    if random.random()<.55: add(d,random.choice([12,14,14,16,18]),'eat','קפה')
    if random.random()<.22: add(d,R(45,190),'eat',random.choice(['ארוחת צהריים','סושי','פיצה','המבורגר','שווארמה','מסעדה']))
    if dom in (4,14,24) or random.random()<.03: add(d,R(240,360,0.01),'car','דלק')
    if wd in (6,0,1,2,3) and random.random()<.18: add(d,random.choice([5.5,8,11]),'car','רב-קו')
    if random.random()<.07: add(d,R(60,320),'fun',random.choice(['קולנוע','הופעה','בירה עם חברים','חדר בריחה','באולינג']))
    if random.random()<.06: add(d,R(80,650),'shop',random.choice(['בגדים','נעליים','אמזון','עליאקספרס','איקאה','']))
    if random.random()<.035: add(d,R(30,140,0.1),'health',random.choice(['בית מרקחת','רופא שיניים','משקפיים'])) 
    if random.random()<.02: add(d,R(150,420),'gift',random.choice(['מתנה ליום הולדת','חתונה','מתנה לאמא']))

# one-off events
add(dt.date(2026,4,18),620,'extra','מכירה ביד 2 – אופניים')
add(dt.date(2026,5,22),1840,'refund','החזר מס')
add(dt.date(2026,6,9),5400,'shop','מחשב נייד')
add(dt.date(2026,6,10),2500,'extra','בונוס')
add(dt.date(2026,7,3),3200,'fun','חופשה באילת')
add(dt.date(2026,7,14),180,'refund','החזר על מוצר פגום')
add(dt.date(2026,8,27),950,'extra','עבודה פרילנס')
add(dt.date(2026,9,16),1200,'gift','מתנה לחתונה')
add(dt.date(2026,9,30),37.90,'health','')
# edge cases: same coffee twice on the same day, no category, a deleted category
add(dt.date(2026,8,6),14,'eat','קפה',hour=8); add(dt.date(2026,8,6),14,'eat','קפה',hour=8)
add(dt.date(2026,5,11),75,None,'')
add(dt.date(2026,9,4),42,None,'חנייה')
add(dt.date(2026,6,21),119,'demo-cat-deleted','ספר',catName='ספרים')
tx.sort(key=lambda t:(t['date'],t['createdAt']))

# ---------- net worth: events → items + history (a point only when totals change, like the app) ----------
AS={}; LI={}; hist=[]
def tot(): a=round(sum(x['value'] for x in AS.values()),2); l=round(sum(x['value'] for x in LI.values()),2); return a,l
def point(t,note):
    a,l=tot()
    if hist and hist[-1]['a']==a and hist[-1]['l']==l: return
    hist.append({'t':t,'a':a,'l':l,'n':round(a-l,2),'note':note})
def put(kind,key,name,cat,value,t,note=None):
    D=AS if kind=='a' else LI
    new=key not in D
    D[key]={'id':'demo-'+kind+'-'+key,'name':name,'category':cat,'value':round(value,2),'updatedAt':t}
    point(t,note or (('הוספה: ' if new else 'עדכון: ')+name))
def delete(kind,key,t):
    D=AS if kind=='a' else LI; x=D.pop(key); point(t,'מחיקה: '+x['name'])
def full(t,vals):
    for (kind,key),v in vals.items():
        D=AS if kind=='a' else LI; D[key]['value']=round(v,2); D[key]['updatedAt']=t
    for D in (AS,LI):
        for x in D.values(): x['updatedAt']=t
    point(t,'עדכון מלא')

d0=dt.date(2026,4,2); m=0
for kind,key,name,cat,v in [('a','checking','עו"ש','cash',11800),('a','oldsave','חיסכון ישן בבנק','cash',8000),
    ('a','gemel','גמל להשקעה','gemel',38200),('a','hishtalmut','קרן השתלמות','hishtalmut',51700),('a','pension','פנסיה','pension',96400),
    ('a','ibkr','IBKR','trading',21300),('a','car','רכב','other',46000),('l','carloan','הלוואת רכב','loan',28000),('l','visa','כרטיס אשראי','credit',4300)]:
    m+=3; put(kind,key,name,cat,v,ms(d0,20,m))
put('a','emergency','קרן חירום','cash',15000,ms(dt.date(2026,5,3),21,10))
g,h_,p,ib,car,loan=38200,51700,96400,21300,46000,28000
for i,(mo,dd) in enumerate([(5,1),(6,1),(7,2),(8,1),(8,31)]):
    g=g*random.uniform(1.004,1.022)+1000; h_=h_*random.uniform(1.002,1.016)+1650; p=p*random.uniform(1.003,1.014)+2100
    ib=ib*random.uniform(0.96,1.06)+800; car-=420; loan-=1150
    full(ms(dt.date(2026,mo,dd),21,30),{('a','checking'):R(9000,16000,10),('a','gemel'):g,('a','hishtalmut'):h_,('a','pension'):p,
        ('a','ibkr'):ib,('a','car'):car,('l','carloan'):loan,('l','visa'):R(3200,6200,10),**({('a','emergency'):15000+1500*i} if 'emergency' in AS else {}),
        **({('a','oldsave'):AS['oldsave']['value']} if 'oldsave' in AS else {})})
    if mo==6: put('a','ibkr','IBKR','trading',ib*1.03,ms(dt.date(2026,6,17),22,5))
    if mo==7: delete('a','oldsave',ms(dt.date(2026,7,15),19,40)); put('a','emergency','קרן חירום','cash',AS['emergency']['value']+8000,ms(dt.date(2026,7,15),19,45))
# after the last full update (Aug 31): only some items get updated → others become "not updated for over a month"
put('a','ibkr','IBKR','trading',AS['ibkr']['value']*0.97,ms(dt.date(2026,9,14),21,0))
put('a','checking','עו"ש','cash',13420,ms(dt.date(2026,10,2),9,15))
put('l','visa','כרטיס אשראי','credit',5180,ms(dt.date(2026,10,2),9,17))
put('a','ibkr','IBKR','trading',AS['ibkr']['value']*1.025,ms(dt.date(2026,10,9),22,40))

a,l=tot(); assert hist[-1]['a']==a and hist[-1]['l']==l
assert len({p['t'] for p in hist})==len(hist)
data={'app':'personal-finance-dashboard','version':2,'exportedAt':dt.datetime(2026,10,11,22,50,tzinfo=TZ).isoformat(),
      'tx':{'categories':categories,'transactions':tx},
      'nw':{'assets':list(AS.values()),'liabilities':list(LI.values()),'history':hist}}
import os,sys
out=os.path.join(os.path.dirname(os.path.abspath(__file__)),'finance-backup-demo.json')
json.dump(data,open(out,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
from collections import Counter
print('transactions:',len(tx),'| income:',sum(1 for t in tx if t['type']=='income'),'| months:',dict(sorted(Counter(t['date'][:7] for t in tx).items())))
print('categories:',len(categories),'| assets:',len(AS),'| liabilities:',len(LI),'| history points:',len(hist))
print('net worth now:',round(a-l),'| first point:',round(hist[0]['n']),'| notes:',dict(Counter(p['note'].split(':')[0] for p in hist)))
stale=[x['name'] for x in list(AS.values())+list(LI.values()) if (ms(TODAY,23)-x['updatedAt'])/864e5>35]
print('stale (>35 days):',stale)
