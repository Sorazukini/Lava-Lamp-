#version 330 compatibility

uniform float uKa, uKd, uKs;
uniform vec4  uColor;           // lava blob color 
uniform vec4  uSpecularColor;
uniform float uShininess;

uniform float uTime;            // 0..1 cycle from Animate()
uniform vec3  uLightPos;        // adjustable light position (uniform variable)
uniform vec2  uResolution;      // window width, height in pixels

//  SIGNED DISTANCE FIELD HELPERS

// Sphere SDF: distance from point p to sphere centred at c with radius r
float sdSphere(vec3 p, vec3 c, float r) {
    return length(p - c) - r;
}

// smooth min blends two SDFs so blobs merge organically
float smoothMin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0);
    return mix(b, a, h) - k*h*(1.0 - h);
}

//  SCENE SDF  
float sceneSDF(vec3 p) {
    float t = uTime * 6.2831853;   // full 2? cycle

    // Blob 1 – rises slowly on the left, medium size
    vec3 c1 = vec3(-0.22 + 0.10*sin(t*0.7),
                    0.55*sin(t*0.5 + 1.0),
                    0.0);
    float d1 = sdSphere(p, c1, 0.28);

    // Blob 2 – drifts diagonally, slightly larger
    vec3 c2 = vec3( 0.20*cos(t*0.6 + 2.0),
                   -0.45 + 0.50*cos(t*0.4),
                    0.05*sin(t));
    float d2 = sdSphere(p, c2, 0.32);

    // Blob 3 – fast-ish oscillator at top
    vec3 c3 = vec3( 0.15*sin(t*1.1),
                    0.60*sin(t*0.8 + 3.5),
                    0.10*cos(t*0.9));
    float d3 = sdSphere(p, c3, 0.24);

    // Blob 4 – slow sink/rise near bottom
    vec3 c4 = vec3(-0.10*cos(t*0.5 + 1.0),
                   -0.60 + 0.30*sin(t*0.35 + 0.7),
                    0.08*sin(t*1.2));
    float d4 = sdSphere(p, c4, 0.22);

    // Smooth-blend all blobs together (k = blend radius)
    float k  = 0.30;
    float d  = smoothMin(d1, d2, k);
          d  = smoothMin(d,  d3, k);
          d  = smoothMin(d,  d4, k);
    return d;
}

//  SURFACE NORMAL 
vec3 calcNormal(vec3 p) {
    const float EPS = 0.001;
    vec3 v1 = vec3(sceneSDF(p + vec3( EPS, 0.0, 0.0)),
                   sceneSDF(p + vec3(0.0,  EPS, 0.0)),
                   sceneSDF(p + vec3(0.0, 0.0,  EPS)));
    vec3 v2 = vec3(sceneSDF(p - vec3( EPS, 0.0, 0.0)),
                   sceneSDF(p - vec3(0.0,  EPS, 0.0)),
                   sceneSDF(p - vec3(0.0, 0.0,  EPS)));
    return normalize(v1 - v2);
}

//  GLASS CYLINDER SDF 
float glassSDF(vec3 p) {
    float outerR = 0.72;
    float innerR = 0.68;
    float halfH  = 0.95;

    float cylOuter = length(p.xz) - outerR;
    float cylInner = length(p.xz) - innerR;
    float capDist  = abs(p.y) - halfH;

    // Shell = outer cylinder intersected with height cap, minus interior
    float outerShell = max(cylOuter, capDist);
    float innerShell = max(cylInner, capDist);
    return max(outerShell, -innerShell);
}

//  RAYMARCHING  – returns hit distance, or -1 if miss
const int   MAX_STEPS = 128;
const float MAX_DIST  = 10.0;
const float HIT_EPS   = 0.001;

float raymarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    for(int i = 0; i < MAX_STEPS; i++) {
        vec3  pos  = ro + rd * t;
        float dist = sceneSDF(pos);
        if(dist < HIT_EPS) return t;
        if(t > MAX_DIST)   return -1.0;
        t += dist;
    }
    return -1.0;
}

float raymarchGlass(vec3 ro, vec3 rd) {
    float t = 0.0;
    for(int i = 0; i < MAX_STEPS; i++) {
        vec3  pos  = ro + rd * t;
        float dist = glassSDF(pos);
        if(dist < HIT_EPS) return t;
        if(t > MAX_DIST)   return -1.0;
        t += dist * 0.5;   // smaller step – thin shell
    }
    return -1.0;
}

//  PHONG LIGHTING  (ambient + diffuse + specular)
vec3 phong(vec3 pos, vec3 normal, vec3 eyeDir, vec3 baseColor) {
    vec3 lightDir = normalize(uLightPos - pos);

    vec3 ambient  = uKa * baseColor;

    float dd      = max(dot(normal, lightDir), 0.0);
    vec3  diffuse = uKd * dd * baseColor;

    vec3  ref     = normalize(reflect(-lightDir, normal));
    float ss      = (dot(normal, lightDir) > 0.0)
                    ? pow(max(dot(eyeDir, ref), 0.0), uShininess)
                    : 0.0;
    vec3 specular = uKs * ss * uSpecularColor.rgb;

    return ambient + diffuse + specular;
}

//  MAIN
void main() {

    // Generate ray from camera
    //   Map fragment coordinate to NDC [-1,1]
    vec2 uv  = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
    uv.x    *= uResolution.x / uResolution.y;   // correct for aspect ratio

    vec3 ro  = vec3(0.0, 0.0, 3.0);             // camera (ray origin)
    vec3 rd  = normalize(vec3(uv, -1.8));        // ray direction (into scene)

    //March rays 
    float tBlob = raymarch(ro, rd);

    // March rays – glass cylinder 
    float tGlass = raymarchGlass(ro, rd);

    // Background color 
    vec3 bgColor = vec3(0.04, 0.04, 0.08);
    vec3 color   = bgColor;

    // Shade lava blobs if hit 
    if(tBlob > 0.0) {
        vec3 hitPos  = ro + rd * tBlob;
        vec3 normal  = calcNormal(hitPos);
        vec3 eyeDir  = normalize(ro - hitPos);

        vec3 lavaColor = uColor.rgb;
        // subtle color variation based on blob height (looks like heat)
        lavaColor     += vec3(0.15, -0.05, -0.10) * clamp(hitPos.y, -1.0, 1.0);

        color = phong(hitPos, normal, eyeDir, lavaColor);
    }

    // Glass container overlay 
    if(tGlass > 0.0) {
        vec3  gPos    = ro + rd * tGlass;
        vec3  gNorm   = vec3(0.0);
        {
            // Glass normal via finite differences on glassSDF
            const float E = 0.001;
            gNorm = normalize(vec3(
                glassSDF(gPos + vec3(E,0,0)) - glassSDF(gPos - vec3(E,0,0)),
                glassSDF(gPos + vec3(0,E,0)) - glassSDF(gPos - vec3(0,E,0)),
                glassSDF(gPos + vec3(0,0,E)) - glassSDF(gPos - vec3(0,0,E))
            ));
        }

        vec3 eyeDir   = normalize(ro - gPos);
        vec3 lightDir = normalize(uLightPos - gPos);
        vec3 ref      = normalize(reflect(-lightDir, gNorm));

        // Strong specular highlight on glass, minimal diffuse
        float ss       = pow(max(dot(eyeDir, ref), 0.0), 80.0);
        vec3  glassSpec = ss * vec3(0.9, 0.95, 1.0);

        // Fresnel-like rim glow for glass edge transparency
        float fresnel  = pow(1.0 - abs(dot(eyeDir, gNorm)), 3.0);
        vec3  glassRim = fresnel * vec3(0.4, 0.6, 0.8) * 0.5;

        // Blend: glass is mostly transparent, just add highlights
        float alpha    = 0.18 + fresnel * 0.30;
        color          = mix(color, color + glassSpec + glassRim, alpha);
    }

    gl_FragColor = vec4(color, 1.0);
}
