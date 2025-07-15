vec2 p=(FC.xy*2.-r)/min(r.x,r.y)*2.;
vec2 c=p;
vec2 z=vec2(0);
int i=0;
for(i=0;i<100;++i){
    if(dot(z,z)>4.)break;
    z=vec2(z.x*z.x-z.y*z.y,2.*z.x*z.y)+c;
}
float n=float(i)/100.;
o=vec4(vec3(n,n*.5,n*.2),1);