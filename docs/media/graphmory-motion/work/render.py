"""Render the Graphmory editorial motion film with Pillow frames piped to FFmpeg.

This is a deliberately small renderer for the project's own SVG artwork, not a
complete SVG implementation. No browser, JavaScript or HyperFrames is used.
"""
import argparse, functools, math, os, re, subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
W, H, FPS, DURATION = 1920, 1080, 30, 20
BG = (245, 245, 245)
ROOT = ET.parse(HERE / 'artwork.svg').getroot()
CLASSES = {
 'paper': {'fill':'#faf9f6','stroke':'#2d3142','stroke-width':'3'},
 'line': {'fill':'none','stroke':'#2d3142','stroke-width':'3'},
 'muteline': {'fill':'none','stroke':'#bdc1c9','stroke-width':'3'},
 'orange': {'fill':'none','stroke':'#eb6c36','stroke-width':'7'},
 'node': {'fill':'#f5f5f5','stroke':'#2d3142','stroke-width':'3'},
 'dot': {'fill':'#eb6c36'}, 'soft': {'fill':'#edeae5'},
 'rule': {'stroke':'#bdc1c9','stroke-width':'2'},
 'noteLine': {'fill':'none','stroke':'#b1b5be','stroke-width':'5'},
 'small': {'font-size':'25','fill':'#4f5d75'},
 'big': {'font-size':'64','font':'serif'},
 'label': {'font-size':'32'},
}
ENTER = {'agentA':(.05,-50,0),'agentB':(.38,-50,0),'brainGraph':(.12,0,16),
 'keyword':(4.25,0,24),'semantic':(4.45,0,24),'graph':(4.65,0,24),
 'candidates':(5.2,60,0),'source':(8.4,0,35),
 'originals':(10.05,-32,0),'curator':(10.3,0,24),'brief':(11.5,-45,0),
 'lead':(12.6,40,0),'patch':(15.05,-30,0),'checks':(15.3,0,24),
 'oldNote':(15.5,0,24),'newNote':(16.05,0,48),'historyLabel':(17.1,0,24),
 'receipt':(17.5,0,24),'later':(17.7,40,0),'outro':(18.9,0,8)}
DRAW = {'share1':(.65,1),'share2':(1.1,1),'sourceLink':(8.15,.7),
 'readEdge':(10.6,.7),'briefEdge':(11.4,.7),'citation':(12.1,1),
 'returnEdge':(13.1,.45),'supersedes':(16.9,.5),'laterEdge':(18.05,.7)}
PULSES = {
 'packet1':(.75,1.2,[(0,0),(160,0),(345,83),(645,83)]),
 'packet2':(1.2,1.2,[(0,0),(160,0),(345,-162),(645,-162)]),
 'keyPulse':(4.6,1.8,[(0,0),(105,0),(105,-195),(750,-195),(750,0),(880,0)]),
 'semPulse':(5.2,1.6,[(0,0),(360,0),(750,0),(880,0)]),
 'graphPulse':(5.8,1.8,[(0,0),(105,0),(105,195),(750,195),(750,0),(880,0)]),
 'briefPacket':(10.65,2.9,[(0,0),(340,0),(610,0),(995,0),(1090,0)]),
 'laterPacket':(18.2,.9,[(0,0),(180,0),(262,0),(262,-185)])}

def clamp(v): return max(0.,min(1.,v))
def ease(v): return 1-(1-clamp(v))**3

def color(s, opacity=1):
 if not s or s=='none' or s.startswith('url('):return None
 rgb=tuple(int(s[i:i+2],16) for i in (1,3,5))
 return tuple(round(BG[i]+(rgb[i]-BG[i])*opacity) for i in range(3))

@functools.lru_cache(maxsize=None)
def path_points(d):
 """Flatten M/L/H/V/C commands used by this artwork. Unsupported input fails."""
 toks=re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)',d)
 out=[];sub=[];x=y=0.;i=0;cmd='';start=(0.,0.)
 while i<len(toks):
  if toks[i].isalpha():cmd=toks[i];i+=1
  relative=cmd.islower();c=cmd.upper()
  if c=='Z':
   sub.append(start);out.append(tuple(sub));sub=[];x,y=start;cmd='';continue
  n={'M':2,'L':2,'H':1,'V':1,'C':6}.get(c)
  if n is None:raise ValueError('Unsupported SVG command '+cmd)
  vals=list(map(float,toks[i:i+n]));i+=n
  if c in ('M','L'):
   nx,ny=vals
   if relative:nx+=x;ny+=y
   if c=='M':
    if sub:out.append(tuple(sub))
    sub=[];start=(nx,ny);cmd='l' if relative else 'L'
   x,y=nx,ny;sub.append((x,y))
  elif c=='H':x=vals[0]+(x if relative else 0);sub.append((x,y))
  elif c=='V':y=vals[0]+(y if relative else 0);sub.append((x,y))
  elif c=='C':
   a,b,cx,cy,nx,ny=vals
   if relative:a+=x;b+=y;cx+=x;cy+=y;nx+=x;ny+=y
   px,py=x,y
   for k in range(1,33):
    u=k/32;v=1-u
    sub.append((v**3*px+3*v*v*u*a+3*v*u*u*cx+u**3*nx,
                v**3*py+3*v*v*u*b+3*v*u*u*cy+u**3*ny))
   x,y=nx,ny
 if sub:out.append(tuple(sub))
 return tuple(out)

def partial(points,f):
 length=sum(math.dist(a,b) for a,b in zip(points,points[1:]));remaining=length*clamp(f)
 out=[points[0]]
 for a,b in zip(points,points[1:]):
  seg=math.dist(a,b)
  if remaining>=seg:out.append(b);remaining-=seg
  else:
   u=remaining/seg if seg else 0;out.append((a[0]+u*(b[0]-a[0]),a[1]+u*(b[1]-a[1])));break
 return out

def travel(points,u):
 # Equal distance speed along the authored route, independent of render timing.
 pts=partial(points,u)
 return pts[-1]

@functools.lru_cache(maxsize=None)
def font(kind,size):
 return ImageFont.truetype(ARGS.font_serif if kind=='serif' else ARGS.font_sans,size)

BASE=Image.new('RGB',(W,H),BG)
grid=ImageDraw.Draw(BASE)
for x in range(1,W,48):
 for y in range(1,H,48):grid.ellipse((x-1,y-1,x+1,y+1),fill='#d6d4cf')


def frame(t):
 image=BASE.copy();draw=ImageDraw.Draw(image)
 def paint(el,opacity=1,ox=0,oy=0):
  tag=el.tag.split('}')[-1];a=el.attrib;ident=a.get('id','')
  if tag in ('defs','pattern'):return
  if ident in ('s1','s2','s3','s4'):
   lo,hi={'s1':(0,4),'s2':(4,10),'s3':(10,15),'s4':(15,20)}[ident]
   if not lo<=t<hi:return
   opacity*=ease((t-lo)/.3) if lo else 1
   if hi<20:opacity*=clamp((hi-t)/.25)
  if ident in ENTER:
   start,dx,dy=ENTER[ident];u=ease((t-start)/.55)
   opacity*=u;ox+=dx*(1-u);oy+=dy*(1-u)
  if ident=='oldNote':opacity*=1-.45*ease((t-16.6)/.45)
  if el in list(next((e for e in ROOT.iter() if e.get('id')=='s4'),[])) and tag=='text':
   opacity*=1-ease((t-18.65)/.25)
  if opacity<.005:return
  if tag in ('svg','g'):
   for child in el:paint(child,opacity,ox,oy)
   return
  st={'fill':'#2d3142','font-size':'30'} if tag=='text' else {}
  for cls in a.get('class','').split():st.update(CLASSES.get(cls,{}))
  st.update(a)
  fill=color(st.get('fill'),opacity);stroke=color(st.get('stroke'),opacity)
  width=round(float(st.get('stroke-width',1)))
  if ident=='selectedBorder' and t>=7.7:stroke=color('#eb6c36',opacity);width=7
  if ident in PULSES:
   start,duration,points=PULSES[ident]
   if not start<=t<=start+duration+.12:return
   u=clamp((t-start)/duration);dx,dy=travel(points,u);ox+=dx;oy+=dy
   if t>start+duration:fill=color(st.get('fill'),opacity*(1-(t-start-duration)/.12))
  if tag=='rect':
   if st.get('fill','').startswith('url('):return
   x=float(a.get('x',0))+ox;y=float(a.get('y',0))+oy
   box=(x,y,x+float(a['width']),y+float(a['height']))
   draw.rounded_rectangle(box,radius=float(a.get('rx',0)),fill=fill,outline=stroke,width=width)
  elif tag=='circle':
   x=float(a['cx'])+ox;y=float(a['cy'])+oy;r=float(a['r'])
   draw.ellipse((x-r,y-r,x+r,y+r),fill=fill,outline=stroke,width=width)
  elif tag=='path':
   progress=1
   if ident in DRAW:
    start,duration=DRAW[ident];progress=ease((t-start)/duration)
   if progress<=0:return
   for pts in path_points(a['d']):
    pts=[(x+ox,y+oy) for x,y in pts]
    if stroke and len(pts)>1:draw.line(partial(pts,progress),fill=stroke,width=width,joint='curve')
  elif tag=='text':
   x=float(a.get('x',0))+ox;y=float(a.get('y',0))+oy
   draw.text((x,y),el.text or '',font=font(st.get('font','sans'),int(st['font-size'])),fill=fill,anchor='ls')
 paint(ROOT)
 return image


def main():
 global ARGS
 parser=argparse.ArgumentParser()
 parser.add_argument('--font-sans',default=os.getenv('GRAPHMORY_SANS_FONT','/System/Library/Fonts/Helvetica.ttc'))
 parser.add_argument('--font-serif',default=os.getenv('GRAPHMORY_SERIF_FONT','/System/Library/Fonts/Times.ttc'))
 parser.add_argument('--proof',action='store_true')
 parser.add_argument('--output',default=str(HERE.parent/'brag.mp4'))
 ARGS=parser.parse_args()
 for f in (ARGS.font_sans,ARGS.font_serif):
  if not Path(f).is_file():parser.error('Provide an installed local font file: '+f)
 proof=HERE/'proof';proof.mkdir(exist_ok=True)
 times=[0,2.8,3.85,4.15,5.5,8.8,9.85,10.15,13.8,14.85,15.15,18.7,19.8]
 thumbs=[]
 for t in times:
  im=frame(t);im.save(proof/f'frame-{t:05.2f}.png');thumb=im.copy();thumb.thumbnail((480,270));thumbs.append((t,thumb))
 sheet=Image.new('RGB',(1440,310*math.ceil(len(thumbs)/3)),BG);sd=ImageDraw.Draw(sheet)
 for i,(t,im) in enumerate(thumbs):
  x=(i%3)*480;y=(i//3)*310;sheet.paste(im,(x,y+36));sd.text((x+12,y+6),f'{t:.2f}s',fill='#2d3142',font=font('sans',22))
 sheet.save(proof/'contact-sheet.jpg',quality=92)
 if ARGS.proof:print('Proof frames saved');return
 output=Path(ARGS.output);output.parent.mkdir(parents=True,exist_ok=True)
 cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','pipe:0','-i',str(HERE/'audio/select.ogg'),'-i',str(HERE/'audio/receipt.ogg'),'-filter_complex','[1:a]volume=0.22,adelay=7700|7700[a];[2:a]volume=0.28,adelay=17500|17500[b];[a][b]amix=inputs=2:normalize=0,apad,atrim=duration=20[sound]','-map','0:v','-map','[sound]','-c:a','aac','-b:a','128k','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(output)]
 with (HERE/'ffmpeg.log').open('w') as log:
  proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=log)
  try:
   for i in range(FPS*DURATION):
    # Brag poster rule: replace frame 0, never extend duration or shift audio.
    im=frame(13.8 if i==0 else i/FPS);proc.stdin.write(im.tobytes())
    if i%150==0:print(f'{i}/{FPS*DURATION} frames',flush=True)
   proc.stdin.close()
  except Exception:
   proc.kill();proc.wait();raise
  if proc.wait():raise RuntimeError('FFmpeg failed; see work/ffmpeg.log')
 frame(13.8).save(HERE.parent/'brag.jpg',quality=96)
 print('Rendered',output,flush=True)

if __name__=='__main__':main()
