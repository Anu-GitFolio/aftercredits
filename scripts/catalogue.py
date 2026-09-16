import concurrent.futures, io, json, re, time
from pathlib import Path
from urllib.parse import quote
import requests
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HEADERS = {'User-Agent':'AftercreditsPortfolio/1.0 (film discovery research)'}
# Editorial fields: genre, emotional destination, energy, note and spoiler-free premise.
FILMS = [
('arrival','Arrival_(film)','movie','Science fiction','curious,moved','medium','A quiet puzzle with a very human centre.','A linguist is called in to find a shared language with mysterious visitors.'),
('grand-budapest','The_Grand_Budapest_Hotel','movie','Comedy','transported,comforted','medium','Precision, mischief and a world you can get lost in.','A hotel concierge and his young colleague become tangled in an inheritance dispute.'),
('interstellar','Interstellar_(film)','movie','Science fiction','transported,moved','high','Big cosmic questions, anchored by a family bond.','A former pilot joins a mission beyond Earth in search of a future for humanity.'),
('truman-show','The_Truman_Show','movie','Drama','curious,moved','medium','For the feeling that ordinary life deserves a second look.','A man begins to question the carefully ordered world around him.'),
('past-lives','Past_Lives_(film)','movie','Romance','moved','low','A small, beautifully observed story with room to breathe.','Childhood friends reconnect across continents and different versions of their lives.'),
('perfect-days','Perfect_Days','movie','Drama','comforted,moved','low','An invitation to notice the texture of an ordinary day.','A Tokyo cleaner finds a rhythm in work, music, books and small encounters.'),
('knives-out','Knives_Out','movie','Mystery','curious,exhilarated','medium','A satisfying puzzle with a sharp sense of humour.','A detective investigates a novelist’s death and a family full of competing stories.'),
('everything-everywhere','Everything_Everywhere_All_at_Once','movie','Science fiction','exhilarated,moved','high','A maximalist detour for a restless evening.','An overwhelmed laundromat owner is pulled into a bewildering multiverse.'),
('little-miss-sunshine','Little_Miss_Sunshine','movie','Comedy','comforted,moved','medium','Messy people, a shared journey, plenty of heart.','A fractured family sets off in a yellow van for a children’s beauty pageant.'),
('amelie','Amélie','movie','Romance','transported,comforted','low','Small acts of kindness in a richly imagined Paris.','A shy waitress decides to bring a little unexpected joy into the lives around her.'),
('the-lunchbox','The_Lunchbox','movie','Romance','comforted,moved','low','An unhurried connection built one handwritten note at a time.','A misdelivered lunch in Mumbai begins an unlikely exchange between two strangers.'),
('hunt-wilderpeople','Hunt_for_the_Wilderpeople','movie','Adventure','comforted,exhilarated','medium','Deadpan humour and a big-hearted wilderness escape.','A boy and his reluctant guardian become the subjects of a search through the New Zealand bush.'),
('portrait-lady','Portrait_of_a_Lady_on_Fire','movie','Romance','moved,transported','low','For an evening of close looking and quiet intensity.','An artist arrives on a remote island to paint a young woman’s wedding portrait.'),
('dune','Dune_(2021_film)','movie','Science fiction','transported,exhilarated','high','Immersive scale, strange worlds and a patient build.','A young nobleman travels with his family to a desert planet of immense strategic importance.'),
('moonrise','Moonrise_Kingdom','movie','Adventure','transported,comforted','medium','A handmade-feeling adventure for your inner runaway.','Two young pen pals disappear together on a New England island.'),
('spirited-away','Spirited_Away','animation','Fantasy','transported,curious','medium','A doorway out of the everyday, one strange encounter at a time.','A girl enters a spirit world and must learn its unfamiliar rules.'),
('totoro','My_Neighbor_Totoro','animation','Fantasy','comforted,transported','low','Gentle wonder for an evening that asks very little of you.','Two sisters move to the countryside and encounter extraordinary forest neighbours.'),
('kiki','Kiki%27s_Delivery_Service','animation','Fantasy','comforted','low','A warm companion to the feeling of starting over.','A young witch settles in a new city and starts a delivery business.'),
('howls-castle','Howl%27s_Moving_Castle_(film)','animation','Fantasy','transported,comforted','medium','A roaming home, unlikely companions and lavish invention.','A young woman under a spell finds refuge in a wizard’s wandering castle.'),
('spider-verse','Spider-Man:_Into_the_Spider-Verse','animation','Adventure','exhilarated,transported','high','Colour, rhythm and a joyful sense of possibility.','A Brooklyn teenager meets other versions of Spider-Man while learning to become his own.'),
('fantastic-fox','Fantastic_Mr._Fox_(film)','animation','Comedy','comforted,exhilarated','medium','Dry wit and tactile little details worth lingering over.','A restless fox’s raids on three farmers put his whole community in danger.'),
('wall-e','WALL-E','animation','Science fiction','moved,comforted','low','A near-wordless beginning that makes room for connection.','A lonely robot cleaning an abandoned Earth meets a visitor from beyond.'),
('your-name','Your_Name','animation','Fantasy','moved,transported','medium','An intimate connection told on an expansive canvas.','Two teenagers in different parts of Japan begin experiencing each other’s lives.'),
]
SHOWS = [
('severance','Severance','Mystery','curious','high','An immaculate office with questions in every corridor.','Office workers undergo a procedure that separates their work and personal memories.'),
('the-bear','The Bear','Drama','moved,exhilarated','high','Fast, intimate and full of people trying to get it right.','A chef returns home to run his family’s sandwich shop in Chicago.'),
('ted-lasso','Ted Lasso','Comedy','comforted','low','For company that leads with generosity.','An American football coach takes charge of an English football club.'),
('dark','Dark','Science fiction','curious','high','A layered mystery for an evening of paying close attention.','A disappearance unsettles a German town and reveals connections across generations.'),
('fleabag','Fleabag','Comedy','moved','high','Quick wit, uncomfortable honesty and a singular voice.','A young woman navigates family, desire and grief in London.'),
('slow-horses','Slow Horses','Thriller','curious,exhilarated','medium','A scruffy, sharp-tongued alternative to the polished spy story.','Sidelined intelligence officers find themselves drawn into dangerous cases.'),
('the-good-place','The Good Place','Comedy','curious,comforted','low','Big ethical questions wrapped in a playful sitcom.','A woman arrives in an ideal afterlife and suspects she may not belong there.'),
('over-garden-wall','Over the Garden Wall','Fantasy','transported,curious','medium','A compact, autumnal detour into storybook strangeness.','Two brothers wander through an unfamiliar forest looking for the way home.'),
('arcane','Arcane','Fantasy','transported,moved','high','Painterly worlds and relationships under real pressure.','Two sisters find themselves on different sides of a conflict between divided cities.'),
('blue-eye-samurai','Blue Eye Samurai','Adventure','exhilarated','high','A strikingly drawn revenge journey with adult intensity.','A swordswoman pursues a personal mission in Edo-period Japan.'),
]

def get(url):
    for attempt in range(3):
        r=requests.get(url,headers=HEADERS,timeout=30)
        if r.status_code==429: time.sleep(2+attempt*2);continue
        r.raise_for_status();return r
    r.raise_for_status()

def save_image(url,id):
    p=ROOT/'public/assets'/f'{id}.webp'
    if p.exists():return '/assets/'+p.name
    im=Image.open(io.BytesIO(get(url).content)).convert('RGB');im.thumbnail((480,720))
    im.save(p,'WEBP',quality=84,method=6)
    return '/assets/'+p.name

def film(row):
    id,page,kind,genre,moods,energy,note,description=row
    url='https://en.wikipedia.org/wiki/'+page
    raw=get(url).text
    (ROOT/'research/raw'/f'{id}.html').write_text(raw,encoding='utf-8')
    soup=BeautifulSoup(raw,'html.parser');box=soup.select_one('.infobox')
    facts={}
    director=''
    for tr in box.select('tr'):
        th=tr.find('th');td=tr.find('td')
        if th and td:
            for el in td.select('sup'):el.decompose()
            facts[th.get_text(' ',strip=True)]=td.get_text(' ',strip=True)
            if th.get_text(' ',strip=True)=='Directed by':director=td.get_text(', ',strip=True)
    runtime=int(re.search(r'\d+',facts.get('Running time','0')).group())
    release=facts.get('Release dates',facts.get('Release date',''))
    year=int(re.search(r'(?:19|20)\d{2}',release).group())
    languages=re.findall(r'English|Korean|Japanese|French|Hindi|German|Mandarin|Cantonese',facts.get('Language',facts.get('Languages','English')))
    language=languages[0]
    img=box.select_one('img');image_url='https:'+img['src'] if img['src'].startswith('//') else img['src']
    poster=save_image(image_url,id)
    return dict(id=id,title=soup.select_one('#firstHeading').get_text(' ',strip=True).replace(' (film)','').replace(' (2014 film)','').replace(' (2021 film)',''),kind=kind,format='film',year=year,runtime=runtime,language=language,languages=languages,creator=director,genre=genre,moods=moods.split(','),energy=energy,note=note,description=description,poster=poster,source=url,imageSource=image_url,sourceName='Wikipedia',verified='2026-09-16',seasons=None,status=None)

def show(row):
    id,title,genre,moods,energy,note,description=row
    d=get('https://api.tvmaze.com/singlesearch/shows?q='+quote(title)).json()
    (ROOT/'research/raw'/f'{id}.json').write_text(json.dumps(d,ensure_ascii=False),encoding='utf-8')
    seasons=get(f'https://api.tvmaze.com/shows/{d["id"]}/seasons').json()
    return dict(id=id,title=d['name'],kind='animation' if d['type']=='Animation' else 'series',format='series',year=int(d['premiered'][:4]),runtime=d['averageRuntime'] or d['runtime'],language=d['language'],languages=[d['language']],creator='',genre=genre,moods=moods.split(','),energy=energy,note=note,description=description,poster=save_image(d['image']['original'],id),source=d['url'],imageSource=d['image']['original'],sourceName='TVmaze',verified='2026-09-16',seasons=len(seasons),status=d['status'])

if __name__=='__main__':
    results=[];failures=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        jobs={pool.submit(film,r):r[0] for r in FILMS}
        jobs.update({pool.submit(show,r):r[0] for r in SHOWS})
        for job in concurrent.futures.as_completed(jobs):
            try:
                d=job.result();results.append(d);print(d['id'],d['year'],d['runtime'],flush=True)
            except Exception as e: failures.append(jobs[job]);print('FAILED',jobs[job],str(e),flush=True)
    if failures:raise SystemExit('Catalogue unchanged because source fetches failed: '+', '.join(failures))
    results.sort(key=lambda d:([r[0] for r in FILMS+SHOWS]).index(d['id']))
    (ROOT/'data/catalogue.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    def sql(s):return "'"+str(s).replace("'","''")+"'"
    lines=[]
    for d in results:
        vals=[d['id'],d['title'],d['kind'],d['format'],d['year'],d['runtime'],d['genre'],d['language'],d['energy'],json.dumps(d,ensure_ascii=False)]
        lines.append('INSERT INTO titles (id,title,kind,format,year,runtime,genre,language,energy,data) VALUES ('+','.join(sql(v) for v in vals)+') ON CONFLICT(id) DO UPDATE SET '+','.join(k+'=excluded.'+k for k in ['title','kind','format','year','runtime','genre','language','energy','data'])+';')
    (ROOT/'data/catalogue.sql').write_text('\n'.join(lines),encoding='utf-8')
    print('Total',len(results))
