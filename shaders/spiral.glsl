vec2 p=(FC.xy*2.-r)/min(r.x,r.y);
float a=atan(p.y,p.x);
float d=length(p);
vec3 c=vec3(sin(a*8.+t*2.),cos(a*12.+t*3.),sin(d*10.-t*5.));
c*=smoothstep(.2,.0,abs(sin(a*6.+t)-.5));
o=vec4(c,1);