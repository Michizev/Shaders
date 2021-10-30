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


// Sample Settings
//Lower sample count increases contrast
const int sampleCount = 32;
const int sampleLightCount = 5;
const float eps = 0.01;
    
// Step settings
const float zMax = 100.0;
const float zMaxl = 40.0;

//Sun settings
vec3 sun_direction = normalize(vec3(0.052,-5.000,10.885));
vec3 bg = vec3(0.8, 0.9, 1.0) * 0.5;
vec4 lightColor = vec4(2.0, 0.80, 0.30, 1.0);

//Camera Settings
float FOV = 90.0;



//f (x)=sin(a*x)*b
//f'(x)=a*b*cos(a*x)
#define PATHA vec2(0.1147, 0.2093)
#define PATHB vec2(13.0, 3.0)
vec3 camPath( float z ) {
    return vec3(sin(z*PATHA)*PATHB, z);
}
vec3 camPathDeriv( float z ) {
    return vec3(PATHA*PATHB*cos(PATHA*z), 1.0);
}



float hash(float n)
{
    return fract(sin(n) * 43758.5453);
}

///
/// Noise function
///
float noise(in vec3 x)
{
    vec3 p = floor(x);
    vec3 f = fract(x);
    
    f = f * f * (3.0 - 2.0 * f);
    
    float n = p.x + p.y * 57.0 + 113.0 * p.z;
    
    float res = mix(mix(mix(hash(n +   0.0), hash(n +   1.0), f.x),
                        mix(hash(n +  57.0), hash(n +  58.0), f.x), f.y),
                    mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                        mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
    return res;
}

///
/// Fractal Brownian motion https://thebookofshaders.com/13/
mat3 m = mat3( 0.00,  0.80,  0.60,
              -0.80,  0.36, -0.48,
              -0.60, -0.48,  0.64);

float fbm(vec3 p)
{
    float f;
    /*
    f  = 0.5000 * noise(p); p = m * p * 2.02;
    f += 0.2500 * noise(p); p = m * p * 2.03;
    f += 0.1250 * noise(p);
    f += 0.1200 * noise(p);
    f += 0.0200 * noise(p) * sin(p.x) * cos(p.z) * 5.0;
    */
    f  = 0.5000 * noise(p); p *= m * 2.02;
    f  += 0.2500 * noise(p); p *= m * 2.05;
    f  += 0.1250 * noise(p); p *= m * 2.01;
    f  += 0.0550 * noise(p);
    return f;
}


float fbm2(in vec3 x)
{
    float rz = 0.;
    float a = .35;
    for (int i = 0; i<2; i++)
    {
        rz += noise(x)*a;
        a*=.35;
        x*= 4.;
    }
    return rz;
}

float path(in float x){ return sin(x*0.01-3.1415)*28.+6.5; }
float scene2(vec3 p){
    return p.y*0.07 + (fbm2(p*0.3)-0.1) + sin(p.x*0.24 + sin(p.z*.01)*7.)*0.22+0.15 + sin(p.z*0.08)*0.05+fbm2(0.000001*p)*sin(p.x);
}

float scene22(vec3 p){
    return p.y*0.07 + (fbm(p*0.3)-0.1) + sin(p.x*0.24 + sin(p.z*.01)*7.)*0.22+0.15 + sin(p.z*0.08)*0.05+fbm2(0.000001*p)*sin(p.x);
}

float scene3(vec3 p){
    float extra = fbm((p+vec3(3.0,0.0,0.1))*0.001);
    //p.y += +7.0 + sin(iTime*0.2)*1.3;
    p.y += 12.072 + abs(sin(iTime*0.1));
    return p.y*0.07 + (fbm2(p*0.3)-0.1)+(fbm2(p*0.01)-0.1)+0.15 + sin(p.z*0.08)*0.05+fbm2(0.000001*p)*sin(p.x) * extra;
}

float scene(vec3 p)  
{
 	return scene3(p);   
}


//////////////////////////////////////////////////



// Get normal of the cloud field.
vec3 getNormal(in vec3 p)
{
    const float e = 0.01;
    return normalize(vec3(scene(vec3(p.x + e, p.y, p.z)) - scene(vec3(p.x - e, p.y, p.z)),
                          scene(vec3(p.x, p.y + e, p.z)) - scene(vec3(p.x, p.y - e, p.z)),
                          scene(vec3(p.x, p.y, p.z + e)) - scene(vec3(p.x, p.y, p.z - e))));
}


// Create a camera pose control matrix.
mat3 camera(vec3 ro, vec3 ta)
{
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(0.0, 1.0, 0.0);
    vec3 cu = cross(cw, cp);
    vec3 cv = cross(cu, cw);
    return mat3(cu, cv, cw);
}

vec4 raymarch(vec3 p, vec3 dir, vec3 sundir)
{
    // Transmittance
    float T = 1.0;
    float absorption = 100.0;
    
    float zstep = zMax / float(sampleCount);
    float zstepl = zMaxl / float(sampleLightCount);
    vec4 color = vec4(0.0);
    
    for (int i = 0; i < sampleCount; i++)
    {
        float density = scene3(p+vec3(0.0, 0.0, 0.0));
        if (density > 0.0)
        {
            float tmp = density / float(sampleCount);
            
            T *= 1.0 - (tmp * absorption);
            if (T <= 0.01)
            {
                break;
            }
            
            float Tl = 1.0;         
            vec3 lp = p;
            
            // Iteration of sampling light.
            for (int j = 0; j < sampleLightCount; j++)
            {
                float densityLight = scene3(lp);
                
                // If densityLight is over 0.0, the ray is stil in the cloud.
                if (densityLight > 0.0)
                {
                    float tmpl = densityLight / float(sampleCount);
                    Tl *= 1.0 - (tmpl * absorption);
                }
                
                if (Tl <= 0.01)
                {
                    break;
                }
                
                // Step to next position. Based on sun
                lp += sundir * zstepl;
            }

            
            // Add ambient + light scattering color
            float opaity = 50.0;
            float k = opaity * tmp * T;
            vec4 cloudColor = vec4(1.0);
            vec4 col1 = cloudColor * k;
            
            float opacityl = 30.0;
            float kl = opacityl * tmp * T * Tl;
            
            vec4 col2 = lightColor * kl * 0.45;

            
            color += col1 + col2;
            //color = col2;
        }
        
        p += dir * zstep;
    }
    return color;
}

///
/// Main function.
///
void main()
{

    lightColor.rgb = lightColor.rgb - bg;
    vec2 uv = (fragCoord.xy * 2.0 - iResolution.xy) / min(iResolution.x, iResolution.y);
    
    float camDist = 25.0;
    
    // target
    vec3 ta = vec3(0.0, 1.0, 0.0);
    

    
    
    float targetDepth = 1.3;
    
    
    float z = iTime*+0.5 - 170.0*0.5;
    //z = 50.0;
    vec3 from = camPath(z);
    vec3 forward = normalize(camPathDeriv(z));
    vec3 right = normalize(cross(forward, vec3(0, -1,0)));
    vec3 up = cross(right, forward);
    vec3 dir = normalize(forward/tan(FOV*0.5)+right*uv.x+up*uv.y);
    
    float sun = clamp( dot(sun_direction,dir), 0.0, 1.0 );
    // background sky
    vec3 bg = vec3(0.76,0.75,0.86);
    bg -= 0.7*vec3(0.90,0.75,0.95)*(dir.y*0.2);
	bg += 0.3*vec3(1.00,0.60,0.10)*pow( sun, 50.0 );

    
    vec3 p = from;
    p += vec3(-0.1, -20.0, 0.0);
    
	vec4 res = raymarch(p,dir, sun_direction);
    vec3 color = bg*0.99;
    //color = color*(1.0-abs(res.w));
    //color = abs(res.www)*1.0;
    color = color*(1.0-res.w) + res.xyz;
    
    // sun glare    
	color += 0.1*vec3(1.0,0.4,0.2)*pow( sun, 3.0 );
    
    // tonemap
    //color = smoothstep(0.15,1.1,color);
    
	fragColor = vec4(color,1.0);
}