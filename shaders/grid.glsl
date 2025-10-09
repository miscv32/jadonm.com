// credit to https://www.shadertoy.com/view/7stGWj for glow tutorial
precision highp float;
uniform vec2 resolution;
uniform vec2 mouse;
uniform float time;
uniform sampler2D backbuffer;
out vec4 outColor;
const int MAX_STEPS = 70;
const float MIN_DIST = 0.0;
const float MAX_DIST = 100.0;
const float EPSILON = 1e-9;


float get_glow(float dist, float radius, float intensity) {
  return pow(radius / max(dist, 1e-6), intensity);
}

vec3 ray_direction(float field_of_view, vec2 FC) {
  vec2 xy = FC - resolution.xy / 2.;
  float z = (.5 * resolution.y) / tan(radians(field_of_view));
  return normalize(vec3(xy, -z));
}

mat3 look_at(vec3 cam, vec3 target, vec3 up) {
  vec3 z = normalize(target);
  vec3 x = normalize(cross(z, up));
  vec3 y = cross(x, z);
  return mat3(x,y,-z);
}

vec3 rotate(vec3 p, vec4 q) {
  return 2. * cross(q.xyz, p * q.w + cross(q.xyz, p)) + p;
}

float box_frame_sdf(vec3 p, vec3 b, float e) {
  
  p = abs(2.*sin(p/5.))-b;
  vec3 a = vec3(.01*sin(time),.9*cos(time),1.*sin(time));
  p = a * dot(a, p) - cross(a, p);
  vec3 q = abs(p+e)-e;
  return min(min(
      length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
      length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
      length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}

float get_sdf(vec3 pos) {
  float angle = time;
  vec3 axis = normalize(vec3(1.));
  pos = rotate(pos, vec4(axis * sin(-angle*.5), cos(2.+angle *.5)));
  return box_frame_sdf(pos, vec3(1.2), .05);
}

float distance_to_scene(vec3 cam, vec3 ray, float start, float end, inout float glow) {
  float depth = start;
  float dist;
  for (int i = 0; i < MAX_STEPS; i++) {
    dist = get_sdf(cam + depth * ray);
    glow += get_glow(dist, 1e-3, .9);
    if (dist < EPSILON) {
      return depth;
    }
    depth += dist;
    if (depth >= end) {
      return end;
    }
  }
  return end;
}

vec3 tonemap(vec3 x) {
  return tanh(x*.5);
}

void main() {
  vec3 ray_direction = ray_direction(60., gl_FragCoord.xy);
  vec3 cam = vec3(2.);
  vec3 target = -normalize(cam);
  vec3 up = vec3(0.,1.,0.);
  mat3 view_mat = look_at(cam, target, up);
  ray_direction = view_mat * ray_direction;
  float glow = 0.;
  float dist = distance_to_scene(cam, ray_direction, MIN_DIST, MAX_DIST, glow);
  vec3 glow_colour = vec3(.3, .2, 1.);
  vec3 col = glow * glow_colour;
  col = tonemap(col);
  col = pow(col, vec3(.59));
  outColor = vec4(col,1.);
}