vec2 p=vec2(FC.x/r.x, FC.y/r.y)*.7+.25;
vec2 stars[100];
float w[100];
for (int i = 0; i < 100; i++) {
  stars[i].x = mod(abs(sin((t/1005.+float(i)*4.)*3.)) + t/(40.),1.);
  stars[i].y = mod(pow(cos((t/800.2+fract(sin(float(i)))*9.)*3.),2.) + t/30.9,1.);
  
  w[i] = mod((sin(stars[i].x)),1.);
}
float d = distance(p,stars[0]);
float mw = w[0];
for (int i = 1; i < 100; i++) {
  float nd = distance(p,stars[i]);
  if (nd < d) d = nd;
  if (w[i] < mw) mw = w[i];
}
float l=.01;
float c = 1.-smoothstep(l, l+.002, d);
float q=.07+pow(sin(t*.32)*7.,2.);
float b=.21;
vec4 m=(vec4(tanh(q*3.)*2.+b,tanh(q)*1.3+b,tanh(q)*.3+b,1)/6.).yzxw;
float n=d/tanh(.04/.5)*.3;
float g=tanh(n*.019);
vec4 s=vec4(g,tanh(n*.9),g,.2);
float k=1.-smoothstep(n,.07,.0688)+.027;
o=m/(s*31.)*k*(.9+mw*11.)*(vec4(.8*snoise2D(p*9.),.4,.3,fsnoise(p)));