#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define PI 3.14159265359
#define TWO_PI 6.28318530718

//To make it work in shadertoy and glsl editor
#define iTime u_time
#define iResolution u_resolution
#define fragCoord gl_FragCoord
#define fragColor gl_FragColor
//////////////////////////////
// Rotation and translation //
//////////////////////////////

vec2 rotateCCW(vec2 p, float a)
{
    mat2 m = mat2(cos(a), sin(a), -sin(a), cos(a));
    return p * m;
}

vec2 rotateCW(vec2 p, float a)
{
    mat2 m = mat2(cos(a), -sin(a), sin(a), cos(a));
    return p * m;
}

vec2 translate(vec2 p, vec2 t)
{
    return p - t;
}

///////////////////////
// Masks for drawing //
///////////////////////

float fillMask(float dist)
{
    return clamp(-dist, 0.0, 1.0);
}

float innerBorderMask(float dist, float width)
{
    //dist += 1.0;
    float alpha1 = clamp(dist + width, 0.0, 1.0);
    float alpha2 = clamp(dist, 0.0, 1.0);
    return alpha1 - alpha2;
}

float outerBorderMask(float dist, float width)
{
    //dist += 1.0;
    float alpha1 = clamp(dist, 0.0, 1.0);
    float alpha2 = clamp(dist - width, 0.0, 1.0);
    return alpha1 - alpha2;
}

//////////////////////////////////////
// Combine distance field functions //
//////////////////////////////////////

float smoothMerge(float d1, float d2, float k)
{
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

float merge(float d1, float d2)
{
    return min(d1, d2);
}

float mergeExclude(float d1, float d2)
{
    return min(max(-d1, d2), max(-d2, d1));
}

float substract(float d1, float d2)
{
    return max(-d1, d2);
}

float intersect(float d1, float d2)
{
    return max(d1, d2);
}

////////////
// Shapes //
////////////
float pie(vec2 p, float angle)
{
    angle = radians(angle) / 2.0;
    vec2 n = vec2(cos(angle), sin(angle));
    return abs(p).x * n.x + p.y * n.y;
}

float sdCircle(vec2 p, float radius)
{
    return length(p) - radius;
}

float sdTriangle(vec2 p, float width, float height)
{
    vec2 n = normalize(vec2(height, width / 2.0));
    return max(abs(p).x * n.x + p.y * n.y - (height * n.y), -p.y);
}

float sdLine(in vec2 p, in vec2 a, in vec2 b)
{
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

float sdBox(in vec2 p, in vec2 b)
{
    vec2 d = abs(p) - b;
    return length(max(d, vec2(0))) + min(max(d.x, d.y), 0.0);
}

float sdSemiCircle(vec2 p, float radius, float angle, float width)
{
    width /= 2.0;
    radius -= width;
    return substract(pie(p, angle),
                     abs(sdCircle(p, radius)) - width);
}

float sdLine2(vec2 p, vec2 start, vec2 end, float width)
{
    vec2 dir = start - end;
    float lngth = length(dir);
    dir /= lngth;
    vec2 proj = max(0.0, min(lngth, dot((start - p), dir))) * dir;
    return length((start - p) - proj) - (width / 2.0);
}
//
//Complex shapes
//
float sun(vec2 uv, float time, float yOffset)
{
    float speed = 20.568;
    float scale = 90.024;

    float startY = 1.064;
    float startYScale = 15.0;
    float falloff = 10.384;

    //Circle sun
    float sun = smoothstep(0.3, 0.290, length(uv));

    float cuts = 3.024 * sin((uv.y * scale + time * speed));
    cuts += clamp(uv.y * startYScale + startY, -falloff, falloff);
    cuts = clamp(cuts, 0.0, 1.0);
    //Cuts stripes in sun
    float stripedSun = sun * cuts;

    //Add bloom
    float bloom = smoothstep(0.7, 0.0, length(uv));
    bloom *= bloom;
    return clamp(stripedSun, 0.0, 1.0) + bloom * 0.6;
}

float grid(vec2 uv, float time, float speed)
{
    vec2 offset = vec2(0.000, 0.2);
    uv = vec2(uv.x, 3.0 / (abs(uv.y + offset.y) + 0.05));
    uv.x = uv.x * uv.y * 1.0;

    float lineThickness = 5.328;
    //Thinner close, thicker far
    vec2 thicknessDistance = vec2(uv.y, uv.y * uv.y * 0.091);
    thicknessDistance *= 0.01;

    //Movement
    uv += vec2(offset.x, time * 4.0 * (speed + 0.05));
    //Make it fractal
    uv = abs(fract(uv) - 0.5);
    vec2 lines = smoothstep(thicknessDistance, vec2(0.0), uv);
    //Adding glow
    lines += smoothstep(thicknessDistance * lineThickness, vec2(0.0), uv) * 0.4;
    return clamp(lines.x + lines.y, 0.0, 3.0);
}

void main()
{
    float zoom = 0.4;
    float speed = 1.0;
    float saturation = 1.0;
    
    vec2 uv = (2.0 * fragCoord.xy - iResolution.xy) / iResolution.y;
    //animate
    uv *= zoom;
    float aspect = iResolution.x / iResolution.y;

    vec3 col = vec3(0.0, 0.1, 0.2);

    vec2 uvo = uv;
    float col2 = sdLine(uvo, vec2(1.0, 0.0), vec2(-1.0, 0.0));
    col += mix(col, vec3(1.0, 1.5, 1.0), col2);

    //Grid Calculations
    vec2 gridUV = uv;
    float gridVal = grid(gridUV, iTime,speed);
    vec3 colGrid = mix(col, vec3(1.0, 0.5, 1.0), gridVal);

    // Sun calculations
    vec2 sunUV = uv;
    sunUV *= 0.812;
    sunUV = vec2(sunUV.x, sunUV.y - (1.1) + 0.510);

    sunUV += vec2(0.0, 0.7);
    vec3 colSun = vec3(1.0, 0.2, 1.0);
    float sunVal = sun(sunUV, iTime, speed);

    colSun = mix(colSun, vec3(1.0, 0.4, 0.1), sunUV.y * 2.0 + 0.2);
    colSun = mix(vec3(0.0, 0.0, 0.0), colSun, sunVal);
	
    //Split screen for sun and grod
    float limit = -0.2;
    float vstep = step(limit, uv.y);

    col = mix(colGrid, colSun, vstep);
    vec2 reso = iResolution.xy;

    float aspectI = 1.0 / aspect;
    vec2 p = uv;

    //Make the triangles
    float towerX = 0.410 - 0.5;
    float towerY = 0.410 - 0.5;
    float t1 = sdTriangle(translate(p, vec2(0.000, -0.20)) * reso.xy, 0.7 * reso.x, 0.212 * reso.y);
    float t2 = sdTriangle(translate(p, vec2(towerX, towerY)) * reso.xy, 0.05 * 0.5 * reso.x, 0.1 * reso.y);
    float t3 = sdTriangle(translate(p, vec2(-towerX, towerY)) * reso.xy, 0.05 * 0.5 * reso.x, 0.1 * reso.y);
    towerX = 0.436 - 0.5;
    towerY = 0.422 - 0.5;
    float t4 = sdTriangle(translate(p, vec2(towerX, towerY)) * reso.xy, 0.05 * reso.x, 0.1 * reso.y);
    float t5 = sdTriangle(translate(p, vec2(-towerX, towerY)) * reso.xy, 0.05 * reso.x, 0.1 * reso.y);

    towerX = 0.372 - 0.5;
    towerY = 0.390 - 0.5;
    float t6 = sdTriangle(translate(p, vec2(towerX, towerY)) * iResolution.xy, 0.05 * iResolution.x, 0.1 * iResolution.y);
    float t7 = sdTriangle(translate(p, vec2(-towerX, towerY)) * iResolution.xy, 0.05 * iResolution.x, 0.1 * iResolution.y);

    t1 = merge(t1, t2);
    t1 = merge(t1, t3);

    t1 = merge(t1, t4);
    t1 = merge(t1, t5);

    t1 = merge(t1, t6);
    t1 = merge(t1, t7);

    float lt = sdLine2(p * iResolution.xy, vec2(-0.380, -0.200) * iResolution.xy, vec2(-0.200, -0.090) * iResolution.xy, 5.0);
    towerX = 0.300 - 0.5;
    towerY = 0.334 - 0.5;
    float t8 = sdTriangle(translate(p, vec2(towerX, towerY)) * iResolution.xy, 0.05 * iResolution.x, 0.1 * iResolution.y);
    t1 = merge(t1, lt);
    t1 = merge(t1, t8);
    t8 = sdTriangle(translate(p, vec2(-towerX, towerY)) * iResolution.xy, 0.05 * iResolution.x, 0.1 * iResolution.y);
    lt = sdLine2(p * iResolution.xy, vec2(0.380, -0.200) * iResolution.xy, vec2(0.200, -0.090) * iResolution.xy, 5.0);
    t1 = merge(t1, lt);
    t1 = merge(t1, t8);

    vec2 p2 = p;
    p2.x *= aspectI;
    float c = sdSemiCircle(translate(p2, vec2(0.500 - 0.5, 0.440 - 0.5)) * iResolution.xy, 15.0, 130.0, 2.0);

    col = mix(vec3(col.r, col.r, col.r) * 0.5, col, saturation * 0.7);

    float mask = fillMask(t1);
    vec3 colT = mix(col, vec3(1.0, 0.4 * fract(t1), 0.1), mask);
    vec2 pCol = fragCoord.xy / iResolution.xy;
    colT = mix(colT, vec3(0.344, 0.427, 1.000), abs(sin((pCol.y + 0.001)) * mask * 1.188));

    float coolAnimationVariable = 0.075;
    //Add fog to hide ugly
    float ft = sdTriangle(-translate(p, vec2(0.000, -0.160)) * iResolution.xy, coolAnimationVariable * iResolution.x, 0.058 * iResolution.y);
    mask = fillMask(ft);


    float l = sdLine2(p * iResolution.xy, vec2(-0.210, -0.190) * iResolution.xy, vec2(0.490 - 0.5, 0.430 - 0.5) * iResolution.xy, 2.0);

    c = merge(c, l);
    l = sdLine2(p * iResolution.xy, vec2(0.210, -0.190) * iResolution.xy, vec2(1.0 - 0.490 - 0.5, 0.430 - 0.5) * iResolution.xy, 2.0);
    c = merge(c, l);

    l = sdLine2(p * iResolution.xy, vec2(-0.1900, -0.190) * iResolution.xy, vec2(0.480 - 0.5, 0.410 - 0.5) * iResolution.xy, 2.0);
    c = merge(c, l);
    l = sdLine2(p * iResolution.xy, vec2(0.1900, -0.190) * iResolution.xy, vec2(1.0 - 0.480 - 0.5, 0.410 - 0.5) * iResolution.xy, 2.0);
    c = merge(c, l);

    float dt = sdTriangle(translate(p, vec2(0.500 - 0.5, 0.390 - 0.5)) * iResolution.xy, 0.03 * iResolution.x, 0.030 * iResolution.y);
    mask = fillMask(c);
    mask = fillMask(c) + innerBorderMask(c, abs(sin(iTime * 5.0)) + 0.5);
    float mask2 = outerBorderMask(dt, 1.0) + innerBorderMask(dt, abs(sin(iTime * 5.0)) + 0.5);
    
	
    colT = mix(colT, vec3(1.000, 0.92, 98), mask);
    colT = mix(colT, vec3(1.000, 0.92, 98), mask2);
    
    //Saturate the pyramid differently
    colT = mix(vec3(colT.r, colT.r, colT.r) * 0.5, colT, saturation);
    
	//Adding fog to final color
    float triangleFog = smoothstep(0.276, -0.592, ft * 0.041);
    float fog = smoothstep(0.1, -0.02, abs(uv.y - limit));
    colT += fog * fog * fog * fog * 1.144;
    colT += triangleFog;
    
    fragColor = vec4(colT, 1.0);
}