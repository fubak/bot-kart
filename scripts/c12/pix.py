import sys, os
from PIL import Image

def stats(path):
    im = Image.open(path).convert('RGB')
    w,h = im.size
    px = im.load()
    n = w*h
    near_black = blown = 0
    r=g=b=0
    # sky band = top 35% of frame
    sky_r=sky_g=sky_b=0; sky_n=0
    for y in range(h):
        for x in range(w):
            pr,pg,pb = px[x,y]
            r+=pr; g+=pg; b+=pb
            mx = max(pr,pg,pb)
            if mx < 16: near_black+=1
            if mx > 245 and min(pr,pg,pb)>240: blown+=1
            if y < h*0.35:
                sky_r+=pr; sky_g+=pg; sky_b+=pb; sky_n+=1
    return dict(file=os.path.basename(path), w=w,h=h,
        mean=(r//n,g//n,b//n),
        nearblack=round(100*near_black/n,1),
        blown=round(100*blown/n,1),
        sky_mean=(sky_r//sky_n, sky_g//sky_n, sky_b//sky_n))

for p in sys.argv[1:]:
    print(stats(p))
