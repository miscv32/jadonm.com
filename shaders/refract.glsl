precision highp float;
uniform vec2 resolution;
uniform vec2 mouse;
uniform float time;
uniform sampler2D backbuffer;

mat3 rotate3D(float angle, vec3 axis){
    vec3 a = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float r = 1.0 - c;
    return mat3(
        a.x * a.x * r + c,
        a.y * a.x * r + a.z * s,
        a.z * a.x * r - a.y * s,
        a.x * a.y * r - a.z * s,
        a.y * a.y * r + c,
        a.z * a.y * r + a.x * s,
        a.x * a.z * r + a.y * s,
        a.y * a.z * r - a.x * s,
        a.z * a.z * r + c
    );
}


float diffractor_sdf(vec3 p) {
  vec3 a = vec3(cos(time),1,sin(time));
  p = rotate3D(sin(time/4.), a) * p;
  p = abs(p);
  return (p.x+p.y+p.z-2.)*0.57735027 ;
}

float absorber_sdf(vec3 p) {
      const float k = .1; // or some other amount
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    mat2  m = mat2(c,-s,s,c);
    p= vec3(m*p.xz,p.y);
  return length(p-vec3(0,sin(time),0)) - .7;
  
}

vec3 normal_absorber(vec3 p) {
  vec3 h = vec3(.0001, 0., 0.);
  float dx = absorber_sdf(p + h.xyy) - absorber_sdf(p - h.xyy);
  float dy = absorber_sdf(p + h.yxy) - absorber_sdf(p - h.yxy);
  float dz = absorber_sdf(p + h.yyx) - absorber_sdf(p - h.yyx);
  return normalize(vec3(dx,dy,dz));
}

vec3 normal_diffractor(vec3 p) {
  vec3 h = vec3(.0001, 0., 0.);
  float dx = diffractor_sdf(p + h.xyy) - diffractor_sdf(p - h.xyy);
  float dy = diffractor_sdf(p + h.yxy) - diffractor_sdf(p - h.yxy);
  float dz = diffractor_sdf(p + h.yyx) - diffractor_sdf(p - h.yyx);
  return normalize(vec3(dx,dy,dz));
}

void main() {
  vec2 r=resolution;
  vec2 p=(gl_FragCoord.xy*2.-r)/min(r.x,r.y);
  
  bool refracted = false;
  
  vec3 ray_origin, ray_direction, current_position, current_position_unrefracted, unrefracted_ray_direction;
  ray_origin = vec3(0,0,-3.9);
  ray_direction = vec3(p.xy,1);
  unrefracted_ray_direction = ray_direction;
  
  float distance_to_diffractor, distance_to_absorber, minimum_distance, distance_travelled, distance_travelled_diffractor;
  minimum_distance = .01;

  for(int i = 0; i < 20; ++i) {
    current_position = ray_origin + distance_travelled * ray_direction;
    current_position_unrefracted = ray_origin + distance_travelled_diffractor * unrefracted_ray_direction;
    distance_to_diffractor = diffractor_sdf(current_position_unrefracted);
    distance_to_absorber = absorber_sdf(current_position);
    if ((distance_to_absorber < minimum_distance) && refracted) {
      gl_FragColor += vec4(cos(normal_absorber(current_position).x),sin(normal_absorber(current_position).y),cos(normal_absorber(current_position).z-4.*time), 1);
      break;
    }
    if (distance_to_diffractor < minimum_distance) {
      float glow = .3/(distance_travelled*.99-distance_travelled_diffractor); // create glow and diminish it with distance
      glow = clamp(glow, 0.01, .2); 
      gl_FragColor += vec4(glow,glow*.8,glow*1.3,1);
      ray_direction = refract(ray_direction, normal_diffractor(current_position), .97);
      refracted = true;
    }
    
    distance_travelled += distance_to_absorber;
    distance_travelled_diffractor += distance_to_diffractor;
  }
}