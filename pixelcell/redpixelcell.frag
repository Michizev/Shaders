#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

//Change to choose different color mods
//Also can be replaced by an uniform to allow an external system to change the colors
int colorMode = 0;
//uniform int colorMode;

vec3 baseColor = vec3(2.800,0.014,0.282);


//Hash reduced input from v3 -> v2
//from shadertoy
//https://www.shadertoy.com/view/4djSRW
vec3 hash( vec2 p )
{
	vec3 pp = vec3( dot(p,vec2(127.1,311.7)),
			  dot(p,vec2(269.5,183.3)),
			  dot(p,vec2(113.5,271.9)));

	return fract(sin(pp)*43758.5453123);
}

//From
//https://iquilezles.org/www/articles/voronoise/voronoise.htm
//Inigo Quilez 
float voronoise( in vec2 x, float u) {
    vec2 p = floor(x);
    vec2 f = fract(x);

    float k = 1.0+63.0*pow(1.0,4.0);

    float va = 0.0;
    float wt = 0.0;
    
    for (int j=-2; j<=2; j++) {
        for (int i=-2; i<=2; i++) {
            vec2 g = vec2(float(i),float(j));
            vec3 o = hash(p + g)*vec3(u,u,1.0);
            vec2 r = g-f+o.xy*o.xy;
            float d = dot(r,r);
            float ww = pow( 1.0-smoothstep(0.0,1.414,sqrt(d)), k );
            va += o.z*ww;
            wt += ww;
        }
    }
    
    return va/wt;
}
//Different extra color modes
vec4 makeColor(float p, int mode, vec3 baseColor)
{
    vec3 col = baseColor*p;
    
    vec4 color = vec4(baseColor,1.0)*p;
    //Yellow
    if( mode == 1)
    {
    	color = mix(vec4(col,1.0),vec4(1.000,0.750,0.109,1.000),p);
    }
    //Purple
    else if(mode == 2)
    {
        color = mix(vec4(col,1.0),vec4(0.264,0.092,1.000,1.000),p);
    }
    //Scary 1
    else if(mode == 3)
    {
        color = mix(vec4(col,1.0),vec4(1.000,0.750,0.109,0.000),p);
    }
    //Scary 2
    else if(mode == 4)
    {
        color = mix(vec4(baseColor,1.0)*p,vec4(0.0,0.0,0.0,1.0),p);
    }
    //Weird mode
    else if(mode == 5)
    {
        vec4 color1 = mix(vec4(col,1.0),vec4(0.045,0.277,1.000,1.000),p);
        vec4 color2 = mix(vec4(col,1.0),vec4(1.000,0.582,0.035,1.000),p);
        
        color = mix(color1,color2,p);
    }
    return color;
}
void main() {
    //Setup coordinate system
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y;
    
    //Scale of the pattern up
	st *= 10.000;
	
	//vorono noise effect
    float shape = sin(u_time/5.0);
    float noise = voronoise(st, shape);
    float p = 1.0 - mod(noise + u_time * 0.25, 1.0);
    
    //Limits the amount of on cells
    p = min(max(p * 3.0 - 1.8, 0.1), 2.0);
 
    //Pixel effect
    //First scale the pixels
    float pixelScale = 8.0;
    vec2 r = mod(st * pixelScale, 1.0);
    r = vec2(pow(r.x - 0.5, 2.0), pow(r.y - 0.5, 2.0));
    
    //Apply the pixels to the voroni
    p *= 1.0 - pow(min(1.0, 12.0 * dot(r, r)), 2.0);
    
	//Pick one of many colors based on colorMode
    vec4 color = makeColor(p, colorMode, baseColor);

    gl_FragColor = color;
}

