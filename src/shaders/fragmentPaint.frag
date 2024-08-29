precision mediump float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uFloatVar1;
uniform float uFloatVar2;

void main()
{
    vec2 uv = gl_FragCoord.xy / uResolution;
    gl_FragColor = vec4(uv.x, 0.5*uv.y + 0.005*uFloatVar1, uFloatVar2/100., 1.0);
}