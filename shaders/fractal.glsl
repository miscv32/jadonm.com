vec2 p=(FC.xy*2.-r)/min(r.x,r.y);
vec3 c=vec3(0);
for(int i=0;i<8;++i){
    p.xy=abs(p)/dot(p,p)-vec2(.9+cos(t*.2)*.4);
    c+=(1.-smoothstep(0.,.1,abs(p.x)-.1))*vec3(1,.7,.3);
}
o=vec4(c,1);