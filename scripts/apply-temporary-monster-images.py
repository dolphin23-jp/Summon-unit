from pathlib import Path
import struct, zlib, binascii

ROOT = Path.cwd()
W = H = 128
MONSTERS = [
    ('species.slice.grassfang-rat', 'rat', (35,76,55), (10,23,31), (121,177,82), (230,242,207)),
    ('species.slice.windwing-midge', 'midge', (40,82,106), (9,23,36), (105,199,214), (232,255,255)),
    ('species.slice.moss-sprout', 'sprout', (50,87,58), (11,27,32), (116,168,81), (219,246,191)),
    ('species.slice.mudshell-beetle', 'beetle', (85,71,53), (23,24,19), (132,112,78), (227,197,141)),
    ('species.slice.ember-gecko', 'gecko', (91,41,39), (26,16,21), (219,97,60), (255,240,184)),
    ('species.slice.ancient-gear', 'gear', (62,77,84), (16,23,28), (181,154,98), (255,229,161)),
    ('species.slice.gale-wolf', 'wolf', (40,81,93), (11,23,32), (95,135,144), (217,255,248)),
    ('species.slice.rock-carapace', 'rock', (75,70,60), (21,25,22), (129,118,95), (234,220,185)),
    ('species.slice.spark-bird', 'bird', (75,56,87), (21,19,38), (224,161,79), (255,244,191)),
    ('species.slice.moss-healer', 'healer', (49,83,70), (13,28,33), (111,141,96), (229,246,216)),
    ('species.slice.ironhorn-beast', 'horn', (60,67,74), (17,24,32), (116,128,135), (238,247,250)),
    ('species.slice.venom-moth', 'moth', (70,49,82), (23,17,36), (131,80,153), (241,213,255)),
    ('species.slice.flame-automaton', 'robot', (79,45,45), (21,21,26), (98,102,106), (255,212,107)),
    ('species.slice.molten-carapace', 'molten', (85,45,36), (23,16,15), (75,64,56), (255,208,113)),
    ('species.slice.windtree-priest', 'priest', (47,82,96), (10,27,35), (102,133,94), (226,255,233)),
    ('species.slice.disaster-flame-wyvern', 'wyvern', (63,30,48), (16,13,24), (132,48,60), (255,226,140)),
]

def canvas(top, bottom):
    p = bytearray(W*H*4)
    for y in range(H):
        t = y/(H-1)
        c = tuple(round(top[i]*(1-t)+bottom[i]*t) for i in range(3))
        for x in range(W):
            k=(y*W+x)*4; p[k:k+4]=bytes((*c,255))
    return p

def px(p,x,y,c):
    x=int(round(x)); y=int(round(y))
    if 0<=x<W and 0<=y<H:
        k=(y*W+x)*4; p[k:k+4]=bytes((*c,255))

def ellipse(p,cx,cy,rx,ry,c):
    for y in range(max(0,int(cy-ry)),min(H,int(cy+ry+1))):
        for x in range(max(0,int(cx-rx)),min(W,int(cx+rx+1))):
            if ((x-cx)/rx)**2+((y-cy)/ry)**2<=1: px(p,x,y,c)

def line(p,a,b,c,w=2):
    x0,y0=a; x1,y1=b; n=max(abs(x1-x0),abs(y1-y0),1)
    for i in range(int(n)+1):
        t=i/n; x=x0+(x1-x0)*t; y=y0+(y1-y0)*t
        ellipse(p,x,y,w,w,c)

def poly(p,pts,c):
    xs=[q[0] for q in pts]; ys=[q[1] for q in pts]
    for y in range(max(0,int(min(ys))),min(H,int(max(ys))+1)):
        for x in range(max(0,int(min(xs))),min(W,int(max(xs))+1)):
            inside=False; j=len(pts)-1
            for i in range(len(pts)):
                xi,yi=pts[i]; xj,yj=pts[j]
                if (yi>y)!=(yj>y) and x < (xj-xi)*(y-yi)/(yj-yi)+xi: inside=not inside
                j=i
            if inside: px(p,x,y,c)

def eyes(p, positions, c):
    for x,y in positions:
        ellipse(p,x,y,4,4,c); ellipse(p,x,y,1.5,1.5,(18,28,34))

def draw(kind, body, eye):
    p=canvas((body[0]//2,body[1]//2,body[2]//2),(8,16,22)); ellipse(p,64,112,42,8,(6,13,18))
    if kind in ('rat','wolf'):
        ellipse(p,71,79,34,27,body); ellipse(p,49,61,24,21,tuple(min(255,v+20) for v in body))
        poly(p,[(34,56),(29,29),(49,53)],body); poly(p,[(58,51),(76,30),(68,61)],body)
        if kind=='rat':
            line(p,(38,84),(18,103),body,4); poly(p,[(84,70),(105,77),(84,83)],(238,213,166))
        else:
            for off in (0,12,24): line(p,(14+off,39),(53+off,24),(110,210,195),2)
        eyes(p,[(43,62),(57,61)],eye)
    elif kind in ('midge','moth'):
        wing=(180,232,238) if kind=='midge' else (125,76,145)
        poly(p,[(59,66),(13,32),(27,96),(59,87)],wing); poly(p,[(69,66),(115,32),(101,96),(69,87)],wing)
        ellipse(p,64,73,10,39,body); ellipse(p,64,37,11,11,tuple(min(255,v+25) for v in body)); line(p,(60,28),(50,16),eye,1); line(p,(68,28),(78,16),eye,1); eyes(p,[(60,38),(68,38)],eye)
    elif kind in ('sprout','healer','priest'):
        if kind=='sprout':
            ellipse(p,64,80,32,34,body)
            for x,y,r in [(44,56,13),(58,44,15),(76,46,15),(89,58,12),(65,62,18)]: ellipse(p,x,y,r,r,tuple(min(255,v+18) for v in body))
            line(p,(64,43),(64,19),body,3); ellipse(p,54,18,11,7,body); ellipse(p,74,17,11,7,body); eyes(p,[(58,82),(70,82)],eye)
        else:
            poly(p,[(45,51),(82,51),(101,112),(27,112)],body); ellipse(p,64,44,22,21,tuple(min(255,v+20) for v in body)); eyes(p,[(57,46),(71,46)],eye)
            line(p,(101,37),(95,113),(132,105,67),3); ellipse(p,102,35,11,11,eye)
            if kind=='priest': poly(p,[(43,45),(64,18),(85,45)],tuple(min(255,v+30) for v in body))
    elif kind in ('beetle','rock','molten'):
        ellipse(p,64,73,39,40,body)
        for dx,dy,r in [(-20,-17,18),(15,-20,20),(-17,16,20),(19,17,22)]: ellipse(p,64+dx,73+dy,r,r,tuple(max(0,v-(10 if kind!='molten' else 20)) for v in body))
        if kind=='molten':
            for a,b in [((44,45),(58,70)),((83,42),(69,73)),((43,87),(61,78)),((88,91),(70,79))]: line(p,a,b,(255,112,42),3)
        eyes(p,[(57,94),(71,94)],eye)
    elif kind in ('gecko','bird','wyvern'):
        if kind=='bird':
            poly(p,[(57,67),(15,42),(31,93),(59,85)],body); poly(p,[(71,67),(113,40),(97,93),(69,85)],tuple(min(255,v+15) for v in body)); ellipse(p,64,75,20,34,body); ellipse(p,60,51,19,18,tuple(min(255,v+35) for v in body)); poly(p,[(77,54),(104,61),(77,67)],eye); eyes(p,[(56,52),(66,51)],eye)
        elif kind=='gecko':
            line(p,(48,84),(27,103),body,5); ellipse(p,72,77,34,28,body); ellipse(p,49,59,23,19,tuple(min(255,v+20) for v in body)); poly(p,[(48,46),(56,19),(60,49)],(255,178,61)); eyes(p,[(43,59),(56,58)],eye)
        else:
            poly(p,[(60,62),(8,33),(30,91),(59,83)],body); poly(p,[(68,62),(120,33),(98,91),(69,83)],body); ellipse(p,66,76,24,35,body); ellipse(p,57,49,24,20,tuple(min(255,v+18) for v in body)); poly(p,[(49,39),(41,16),(60,37)],body); poly(p,[(62,36),(79,14),(72,48)],body); eyes(p,[(52,50),(64,49)],eye)
    elif kind in ('gear','robot','horn'):
        if kind=='gear':
            ellipse(p,64,68,44,44,body); ellipse(p,64,68,29,29,(70,78,80)); ellipse(p,64,68,12,12,(26,39,45));
            for a in range(0,360,45):
                import math; r=37; x=64+math.cos(math.radians(a))*r; y=68+math.sin(math.radians(a))*r; ellipse(p,x,y,8,8,body)
            eyes(p,[(57,53),(71,53)],eye)
        elif kind=='robot':
            poly(p,[(42,48),(86,48),(97,103),(31,103)],body); ellipse(p,64,39,22,18,tuple(min(255,v+20) for v in body)); ellipse(p,64,71,13,13,(240,105,54)); eyes(p,[(57,39),(71,39)],eye)
        else:
            ellipse(p,70,80,38,28,body); ellipse(p,51,59,28,23,tuple(min(255,v+15) for v in body)); poly(p,[(38,52),(19,16),(52,46)],eye); poly(p,[(59,45),(93,13),(73,57)],eye); eyes(p,[(45,60),(59,59)],eye)
    return p

def png(p):
    raw=b''.join(b'\0'+bytes(p[y*W*4:(y+1)*W*4]) for y in range(H))
    def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',binascii.crc32(t+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',W,H,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')

out=ROOT/'public/monsters'; out.mkdir(parents=True,exist_ok=True)
for sid,kind,top,bottom,body,eye in MONSTERS:
    (out/f'{sid}.png').write_bytes(png(draw(kind,body,eye)))

presentation = '''function shortId(id: string): string {\n  return id.split('.').at(-1) ?? id\n}\n\nfunction displayName(id: string): string {\n  return shortId(id)\n    .split('-')\n    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)\n    .join(' ')\n}\n\nexport interface MonsterImagePresentation {\n  readonly imageSrc: string\n  readonly showImage: boolean\n  readonly placeholder: string\n  readonly ariaLabel: string\n}\n\nexport function getMonsterImagePresentation(\n  speciesId: string,\n  concealed: boolean,\n  failedImageSrc: string | null,\n): MonsterImagePresentation {\n  const imageSrc = `/monsters/${speciesId}.png`\n  return Object.freeze({\n    imageSrc,\n    showImage: !concealed && failedImageSrc !== imageSrc,\n    placeholder: concealed ? '?' : shortId(speciesId).slice(0, 2).toUpperCase(),\n    ariaLabel: concealed ? '未開示のモンスター画像領域' : `${displayName(speciesId)}の画像領域`,\n  })\n}\n'''
component = '''import { useState } from 'react'\nimport type { MonsterSpecies } from '../content/monster-species'\nimport { getMonsterImagePresentation } from './monster-image-presentation'\n\nexport function MonsterIcon({ species, concealed = false }: { readonly species: MonsterSpecies; readonly concealed?: boolean }) {\n  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null)\n  const presentation = getMonsterImagePresentation(species.id, concealed, failedImageSrc)\n  return (\n    <div className={`collection-icon${concealed ? ' collection-icon--concealed' : ''}`} role="img" aria-label={presentation.ariaLabel}>\n      {presentation.showImage ? (\n        <img className="collection-icon__image" src={presentation.imageSrc} alt="" aria-hidden="true" loading="lazy" decoding="async" onError={() => setFailedImageSrc(presentation.imageSrc)} />\n      ) : (<>\n        <span>{presentation.placeholder}</span><small>IMAGE SLOT</small>\n      </>)}\n    </div>\n  )\n}\n'''
test = '''import { describe, expect, it } from 'vitest'\nimport { getMonsterImagePresentation } from './monster-image-presentation'\n\ndescribe('monster image fallback', () => {\n  it('falls back to the existing initials for a species without an image asset', () => {\n    const initial = getMonsterImagePresentation('species.demo-alpha', false, null)\n    expect(initial).toMatchObject({ imageSrc: '/monsters/species.demo-alpha.png', showImage: true })\n    expect(getMonsterImagePresentation('species.demo-alpha', false, initial.imageSrc)).toEqual({\n      imageSrc: '/monsters/species.demo-alpha.png', showImage: false, placeholder: 'DE', ariaLabel: 'Demo Alphaの画像領域',\n    })\n  })\n})\n'''
ui=ROOT/'src/ui'; (ui/'monster-image-presentation.ts').write_text(presentation); (ui/'MonsterIcon.tsx').write_text(component); (ui/'MonsterIcon.test.ts').write_text(test)

screen=ui/'CollectionScreen.tsx'; source=screen.read_text()
anchor="import type { SkillDefinition } from '../content/skill-definition'\n"
source=source.replace(anchor,anchor+"import { MonsterIcon } from './MonsterIcon'\n")
old='''function MonsterIcon({ species, concealed = false }: { species: MonsterSpecies; concealed?: boolean }) {\n  return (\n    <div\n      className={`collection-icon${concealed ? ' collection-icon--concealed' : ''}`}\n      role="img"\n      aria-label={concealed ? '未開示のモンスター画像領域' : `${displayName(species.id)}の画像領域`}\n    >\n      <span>{concealed ? '?' : shortId(species.id).slice(0, 2).toUpperCase()}</span>\n      <small>IMAGE SLOT</small>\n    </div>\n  )\n}\n\n'''
if old not in source: raise RuntimeError('MonsterIcon placeholder not found')
screen.write_text(source.replace(old,''))

css=ROOT/'src/t033.css'; source=css.read_text().replace('.collection-icon {\n  aspect-ratio: 1;', '.collection-icon {\n  position: relative;\n  aspect-ratio: 1;\n  overflow: hidden;')
anchor='.collection-icon small { color: #7696a4; font-size: 0.42rem; letter-spacing: 0.06em; }'
style='.collection-icon__image {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  display: block;\n  object-fit: cover;\n}\n\n'+anchor
css.write_text(source.replace(anchor,style))
