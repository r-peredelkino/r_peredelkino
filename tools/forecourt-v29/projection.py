"""Deterministic source-pixel to existing scene registration for the June29 tour.

Coordinates are traced from an analytic reprojection of published cube pixels.
The panorama's GPS, north and altitude provide the camera, not a guessed image fit.
Any calibration is explicit below and is applied to reference geometry only.
"""
import json, math
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parent
SCALE=.9009316597933738
A=np.array([[.9009260240311945,-.003186666186893002],[-.003186666186893,-.9009260240311948]])
TRANSLATION=np.array([12.819728978036249,-187.10164316156158])
ORIGIN=np.array([37.35316185,55.63841785])
METERS=np.array([62830.237112730676,111319.49079327358])
CAMERA_GPS=np.array([37.351367,55.637298])
HEADING=math.radians(123.58)
ALTITUDE=60.
WIDTH,HEIGHT=1700,1200
FOV=54.
YAW=math.radians(-45)
TILT=math.radians(-34)
CORRECTION=np.eye(2)
CORRECTION_TRANSLATION=np.zeros(2)

def camera_xz():return A@((CAMERA_GPS-ORIGIN)*METERS)+TRANSLATION

def pixel_ray(pixel,source='perspective'):
    px,py=pixel
    if source=='perspective':
        k=math.tan(math.radians(FOV/2))
        x=(2*(px+.5)/WIDTH-1)*k
        y=-(2*(py+.5)/HEIGHT-1)*k*HEIGHT/WIDTH
        yy=y*math.cos(TILT)+math.sin(TILT)
        zz=-y*math.sin(TILT)+math.cos(TILT)
        xx=x*math.cos(YAW)+zz*math.sin(YAW)
        zz=-x*math.sin(YAW)+zz*math.cos(YAW)
        return np.array([xx,yy,zz])
    face=int(source[-1]);u=2*(px+.5)/3500-1;v=2*(py+.5)/3500-1
    return np.array([(u,-v,1),(1,-v,-u),(-u,-v,-1),(-1,-v,u),(u,1,v),(u,-1,-v)][face])

def pixel_to_world(pixel,height=0,source='perspective',correct=True):
    x,y,z=pixel_ray(pixel,source)
    if y>=0:raise ValueError('Pixel ray does not meet the ground in front of camera')
    distance=(ALTITUDE-height)/(-y)
    east=(x*math.cos(HEADING)+z*math.sin(HEADING))*distance
    north=(-x*math.sin(HEADING)+z*math.cos(HEADING))*distance
    world=camera_xz()+A@np.array([east,north])
    if correct:world=CORRECTION@world+CORRECTION_TRANSLATION
    return [round(float(world[0]),5),round(float(world[1]),5)]

def world_to_pixel(world,height=0,correct=True):
    world=np.array(world)
    if correct:world=np.linalg.solve(CORRECTION,world-CORRECTION_TRANSLATION)
    east,north=np.linalg.solve(A,world-camera_xz())
    x=east*math.cos(HEADING)-north*math.sin(HEADING)
    z=east*math.sin(HEADING)+north*math.cos(HEADING)
    y=height-ALTITUDE
    xx=x*math.cos(YAW)-z*math.sin(YAW)
    zz=x*math.sin(YAW)+z*math.cos(YAW)
    yy=y*math.cos(TILT)-zz*math.sin(TILT)
    zz=y*math.sin(TILT)+zz*math.cos(TILT)
    if zz<=0:return None
    focal=WIDTH/2/math.tan(math.radians(FOV/2))
    return [float(WIDTH/2-.5+focal*xx/zz),float(HEIGHT/2-.5-focal*yy/zz)]

def smooth(points,closed=False,steps=8):
    """Centripetal Catmull-Rom interpolation of manually identified curve anchors."""
    ps=np.array(points,dtype=float)
    if len(ps)<3:return ps.tolist()
    p=np.vstack([ps[-1],ps,ps[0],ps[1]]) if closed else np.vstack([ps[0]+(ps[0]-ps[1]),ps,ps[-1]+(ps[-1]-ps[-2])])
    out=[]
    for i in range(1,len(p)-2):
        p0,p1,p2,p3=p[i-1:i+3]
        dt=lambda a,b:max(np.linalg.norm(b-a)**.5,1e-6)
        t0=0;t1=dt(p0,p1);t2=t1+dt(p1,p2);t3=t2+dt(p2,p3)
        for t in np.linspace(t1,t2,steps,endpoint=False):
            a1=(t1-t)/(t1-t0)*p0+(t-t0)/(t1-t0)*p1
            a2=(t2-t)/(t2-t1)*p1+(t-t1)/(t2-t1)*p2
            a3=(t3-t)/(t3-t2)*p2+(t-t2)/(t3-t2)*p3
            b1=(t2-t)/(t2-t0)*a1+(t-t0)/(t2-t0)*a2
            b2=(t3-t)/(t3-t1)*a2+(t-t1)/(t3-t1)*a3
            out.append(((t2-t)/(t2-t1)*b1+(t-t1)/(t2-t1)*b2).tolist())
    if not closed:out.append(ps[-1].tolist())
    return out

def write_camera():
    p=camera_xz();direction=pixel_ray([WIDTH/2-.5,HEIGHT/2-.5])
    ground=pixel_to_world([WIDTH/2-.5,HEIGHT/2-.5],correct=False)
    result={'position':[float(p[0]),ALTITUDE*SCALE,float(p[1])],
      'target':[ground[0],0,ground[1]],'fov':math.degrees(2*math.atan(math.tan(math.radians(FOV/2))*HEIGHT/WIDTH)),
      'horizontalFov':FOV,'imageSize':[WIDTH,HEIGHT],
      'source':'https://pano.life-fly.ru/rodina/peredelkino/2026-06-29/',
      'node':'node1','altitudeMeters':ALTITUDE,'pannorth':123.58,
      'assumption':'Tour altitude is used as AGL; camera controls and road fit documented separately.'}
    (ROOT/'reference-camera.json').write_text(json.dumps(result,indent=2))
    return result

if __name__=='__main__':print(json.dumps(write_camera(),indent=2))
