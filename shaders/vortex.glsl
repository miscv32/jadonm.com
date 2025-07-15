vec2 uv = ((FC.xy* 2.-r.xy)/r.y);
vec3 ray_origin = vec3(0,0,-3);
vec3 ray_direction = vec3(uv,.01);
vec3 c = vec3(0);
float dist_travelled = 0.;
for(int i; i<150;i++) {
  vec3 p = ray_origin + ray_direction * dist_travelled;
  vec3 a = vec3(sin(t/3.1),10.*cos(t/10.),1.).brb;
  float dist_to_surf = length(p)/(5000.*cos(t)) + cos(.1*length(a*dot(a,p)-cross(a,p))) - 1.;
  dist_travelled += dist_to_surf;
  o += vec4(1.*sin(length(p)),0,1.*sin(dist_travelled),1).bgra;
  o += vec4(1.*sin(dist_travelled),1.*sin(dist_travelled),0,0.8).rbga;
  o += vec4(0,0,.1*sin(length(a)),0).ggba*2.7;
  o += vec4(0,1.*sin(length(a)),0,1).brga*.2;
}
o=tanh(o/100.);