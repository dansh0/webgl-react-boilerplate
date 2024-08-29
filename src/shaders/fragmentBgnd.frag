precision mediump float;
uniform vec2 uResolution;
uniform float uTime;
uniform sampler2D uImage;
uniform sampler2D uRenderTarget;

void main()
{
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec4 textureColor = texture2D(uImage, vec2(uv.x, 1.-uv.y));
    vec4 renderTarget = texture2D(uRenderTarget, uv);
    vec3 outputColor = renderTarget.rgb * renderTarget.a + textureColor.rgb * (1.-renderTarget.a);
    gl_FragColor = vec4(outputColor, 1.);
    // gl_FragColor = vec4(uv.x, uv.y, 0.0, 1.0);
}