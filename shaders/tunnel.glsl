vec2 p=(FC.xy*2.-r)/min(r.x,r.y);
float a=atan(p.y,p.x);
float d=length(p);
vec2 uv=vec2(a/6.28,1./d+t);
vec3 c=vec3(sin(uv.x*20.),cos(uv.y*30.),sin(uv.x*15.+uv.y*10.));
c*=smoothstep(.1,.0,abs(sin(uv.x*4.)-.5));
o=vec4(c*.5+.5,1);