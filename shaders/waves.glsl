vec2 p=(FC.xy*2.-r)/min(r.x,r.y);
float d=length(p);
vec3 c=vec3(0);
for(int i=0;i<5;++i){
    float f=float(i);
    c+=sin(d*6.+t*2.+f)*vec3(1,.5,.3)/(f+1.);
}
c*=smoothstep(.8,.0,d);
o=vec4(c*.5+.5,1);