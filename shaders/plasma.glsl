vec2 p=(FC.xy*2.-r)/min(r.x,r.y);
float v=sin(p.x*10.+t)*sin(p.y*10.+t);
v+=sin(length(p)*20.+t*4.);
v+=sin((p.x+p.y)*8.+t*2.);
vec3 c=vec3(sin(v),sin(v+2.),sin(v+4.))*.5+.5;
o=vec4(c,1);