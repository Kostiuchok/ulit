import colorsys, json, sys
def hex2rgb(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
def rgb2hex(c): return '#'+''.join(f'{round(max(0,min(1,v))*255):02X}' for v in c)
def lum(c):
    f=lambda v: v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
    r,g,b=[f(v) for v in c]; return 0.2126*r+0.7152*g+0.0722*b
def cr(a,b):
    la,lb=lum(a),lum(b); return (max(la,lb)+0.05)/(min(la,lb)+0.05)
def hsl(h,s,l): r,g,b=colorsys.hls_to_rgb((h%360)/360,max(0,min(1,l)),max(0,min(1,s))); return (r,g,b)
def tohsl(c): h,l,s=colorsys.rgb_to_hls(*c); return h*360,s,l
def mix(a,b,t): return tuple(a[i]*(1-t)+b[i]*t for i in range(3))

def derive(base_hex):
    base=hex2rgb(base_hex); h,s,l=tohsl(base)
    lightText = hsl(h, min(s,0.25), 0.97)   # tinted near-white
    darkText  = hsl(h, min(s,0.45), 0.11)   # tinted near-black
    # 1) text-primary = whichever of near-white / near-black has higher contrast with base
    tp = darkText if cr(darkText,base) >= cr(lightText,base) else lightText
    light = tp is darkText                    # "light base" == dark text
    d = -1 if light else 1                    # shift direction: darken light bases, lighten dark ones
    # 2) bg = base; if contrast < 4.5 (mid-tones) nudge lightness AWAY from text in 1% steps
    bg = base; L = l; k = 0
    while cr(tp,bg) < 4.5 and k < 40:
        L += (0.01 if light else -0.01); bg = hsl(h,s,L); k += 1
    h,s,l = tohsl(bg) if k else (h,s,l)
    # 3) bg-alt: lightness +/-16..12% (direction d); keep text-primary >= 4.5:1; else try other direction; else smaller offset
    alt=None
    for dd,rng in ((d,(0.16,0.15,0.14,0.13,0.12)),(-d,(0.12,0.13,0.14,0.15,0.16)),(d,(0.10,0.08,0.06))):
        for dl in rng:
            c = hsl(h, s*0.95, l + dd*dl)
            if cr(tp,c) >= 4.5: alt=c; break
        if alt: break
    if alt is None: alt = hsl(h, s*0.95, l - d*0.06)
    # 4) pattern: tone-on-tone (+/-7%, same direction as bg-alt); decorative, text never sits on it without a solid plate
    pat = hsl(h, s, l + d*0.07)
    # 5) accent: cool hues (180-300deg) -> complementary (h+180); warm/green hues -> analogous (h+35)
    ah = (h+180)%360 if 180 <= h < 300 else (h+35)%360
    as_ = max(0.45, min(0.75, s+0.1))
    al = 0.68 if not light else 0.30
    acc = hsl(ah, as_, al); k=0
    def onA(a): return darkText if cr(darkText,a) >= cr(lightText,a) else lightText
    #    push accent lightness away from bg until accent/bg >= 3:1 (graphic) AND text-on-accent >= 4.5:1
    while (cr(acc,bg) < 3.0 or cr(onA(acc),acc) < 4.5) and k < 25:
        al += 0.02*(1 if not light else -1); acc=hsl(ah,as_,al); k+=1
    onAcc = onA(acc)
    # 6) text-secondary: blend text-primary toward bg as far as possible keeping >= 4.5:1 on bg AND bg-alt
    ts = tp
    for t in [x/100 for x in range(0,60,2)]:
        c = mix(tp, bg, t)
        if cr(c,bg) >= 4.5 and cr(c,alt) >= 4.5: ts = c
        else: break
    # 7) line/ornament: 45% blend text-primary -> bg (decorative)
    line = mix(tp, bg, 0.45)
    # 8) surface (paper plate) + text-on-surface
    surf = hsl(h, min(s,0.30), 0.96) if not light else hsl(h, min(s,0.35), 0.985)
    onSurf = hsl(h, min(s,0.45), 0.12)
    tok = dict(base=base, bg=bg, **{'bg-alt':alt}, surface=surf, accent=acc, **{'text-primary':tp,'text-secondary':ts,'text-on-accent':onAcc,'text-on-surface':onSurf}, line=line, pattern=pat)
    out = {k: rgb2hex(v) for k,v in tok.items()}
    checks = {
      'text-primary/bg': cr(tp,bg), 'text-primary/bg-alt': cr(tp,alt), 'text-primary/pattern': cr(tp,pat),
      'text-secondary/bg': cr(ts,bg), 'text-secondary/bg-alt': cr(ts,alt),
      'text-on-accent/accent': cr(onAcc,acc), 'text-on-surface/surface': cr(onSurf,surf),
      'accent/bg (graphic)': cr(acc,bg), 'line/bg (graphic)': cr(line,bg)}
    return out, {k: round(v,2) for k,v in checks.items()}, light

if __name__=='__main__':
    modes = {'Синій #1F3A5F':'#1F3A5F','Бордо #7A1F2B':'#7A1F2B','Ліс #2F5D46':'#2F5D46','Пісок #E8D9B5':'#E8D9B5'}
    extra = ['#FF8A00','#F2C14E','#808080','#000000','#FFFFFF','#5B2A86','#00A6A6','#D94F70']
    res={}
    for name,hx in list(modes.items())+[(x,x) for x in extra]:
        t,c,light=derive(hx); res[name]={'tokens':t,'contrast':c,'lightBase':light}
        print(name, 'light' if light else 'dark', t); print('   ', c)
    json.dump(res, open('/workspace/ulit-cover-styles/tokens.json','w'), ensure_ascii=False, indent=1)
