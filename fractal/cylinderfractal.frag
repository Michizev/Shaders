// Author:
// Title:

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;


#define PI 3.14159265359
#define rot(a) mat2(cos(a+PI*vec4(0,1.5,0.5,0)))
#define SCALE 4.0
#define FOV 1.0

// See also
// https://www.shadertoy.com/view/Wd2Gzz


struct TraceResult
{
    float dist;
    vec4 frag;
};

struct ColoredDf
{
    float dist;
    vec3 color;
};

///
/// Camera Logic
///
//f (x)=sin(a*x)*b
//f'(x)=a*b*cos(a*x)
#define PATHA vec2(0.1147, 0.1093)
#define PATHB vec2(13.0, 3.0)

vec3 camPath( float z ) {
    return vec3(sin(z*PATHA)*PATHB, z);
}
vec3 camPathDeriv( float z ) {
    return vec3(PATHA*PATHB*cos(PATHA*z), 1.0);
}

struct Camera
{
    vec3 from;
    vec3 dir;
};

Camera calculateCamera(vec2 uv, float speed)
{
    vec3 from = camPath(speed);
    vec3 forward = normalize(camPathDeriv(speed));
    vec3 right = normalize(cross(forward, vec3(0, 1, 0)));
    vec3 up = cross(right, forward);
    vec3 dir = normalize(forward/tan(FOV*0.5)+right*uv.x+up*uv.y);
    
    Camera cam;
    cam.from = from;
    cam.dir = dir;
    
    return cam;
}

///
/// Distance fields
///

float sdCylinder( vec3 p, vec3 c, float r, out vec3 color)
{
  color = normalize(smoothstep(vec3(c), vec3(0.0), p));
  return length( p.xz - c.xy ) - c.z -r;
} 

ColoredDf distanceField( in vec3 p, in float r) {
    
    // wrap world around camera path
    vec3 wrap = camPath(p.z);
    vec3 wrapDeriv = normalize(camPathDeriv(p.z));
    p.xy -= wrap.xy;
    p -= wrapDeriv*dot(vec3(p.xy, 0), wrapDeriv)*0.5*vec3(1,1,-1);

    
    // accumulate scale and distance
    float s = 1.0;
    
    // accumulate color
    vec3 albedo = vec3(0);
    float colorAcc = 0.0;
    
    ColoredDf cdf;
    cdf.dist = 9e9;
        
    // change the fractal rotation along an axis
    float q=p.z*0.074;
    
    for (float i = 0.5 ; i < 4.0 ; i += 1.14124) {
        p.xy *= rot(-i*1.3*q);
        //Changes the fractals based on time
        //p.xy *= rot(-i*1.5*-abs(sin(u_time*0.03))*0.02*q);
        p.xyz = p.zxy;
        p.xy = abs(fract(p.xy)*SCALE-SCALE*0.5);
        p.z *= SCALE;
        
        s /= SCALE;
        
        vec3 cube = vec3(0);
        float dist = sdCylinder(p+vec3(4.2, 12.0,4.2), vec3(1.07, 0.54+i*0.5, 4.47+i*0.1),r , cube)*s;
        
        float co = cube.x*0.2+cube.y*0.4+cube.z*0.8;
        vec3 col = clamp(vec3(co*i*0.1), vec3(0), vec3(0.6));
        
        col = .5 + .5*cos( 6.2831*(col.x+col.y) + vec3(0,1,2) );

        float alpha = max(0.001, smoothstep(r, -r, dist));
        albedo += col*alpha;
        colorAcc += alpha;

        float limit = 2.2;

        float dmax = min(cdf.dist, dist);
        float dmin = max(cdf.dist,-dist);

        float vstep = step(limit, i);

        cdf.dist = mix(dmax, dmin, vstep);

        //Cool effect
        //d = mix(dmin, dmax, vstep);
    }
    
    cdf.color = albedo/colorAcc;
    return cdf;
}

TraceResult coneTrace(Camera cam)
{
    float epsilonalpha = 0.01;
    // get the sine of the angular extent of a pixel
    float sinPix = sin(FOV / u_resolution.y);
    // accumulate color front to back
    vec4 acc = vec4(0, 0, 0, 1);

    float totdist = 0.0;
    for (int i = 0 ; i < 100 ; i++) {
		vec3 p = cam.from + totdist * cam.dir;
        float r = totdist*sinPix;
        ColoredDf cdf = distanceField(p, r);

        
        //Add ambient occlusion to color
        float ao = 1.0 - float(i)/100.0;
        cdf.color *= ao*ao;
        
        //Cone trace
        float prox = cdf.dist / r;
        float alpha = clamp(prox * -0.5 + 0.5, 0.0, 1.0);

        //Add color together
        acc.rgb += acc.a * (alpha*cdf.color.rgb);
        acc.a *= (1.0 - alpha);
        
        //Break early if the accumulated alpha is 1
        if (acc.a < epsilonalpha) {
            break;
        }
        
        // Move forward
        totdist += abs(cdf.dist*0.9);
	} 
    TraceResult res;
    res.dist = totdist;
    res.frag = acc;
    return res;
}


void main() {
    vec4 fragColor = vec4(0.0);

    vec2 uv = (gl_FragCoord.xy - u_resolution.xy*0.5)/u_resolution.y;
    float time_pos = u_time*1.0;
	
    //Calculate Camera vectors based on the current time
    Camera cam = calculateCamera(uv, time_pos);

    TraceResult res = coneTrace(cam);
    // add fog
    fragColor.rgb = clamp(res.frag.rgb, vec3(0), vec3(1));
    float fog = clamp(res.dist/20.0, 0.0, 1.0);
    fragColor.rgb = mix(fragColor.rgb, vec3(0.4, 0.5, 0.7), fog);
    
    // gamma correction
    fragColor.rgb = pow(fragColor.rgb, vec3(1.0/2.2));
    
    //set alpha to 1.0 to make the shader visible in glslEditor
	fragColor.a = 1.0;
    gl_FragColor = fragColor;
}