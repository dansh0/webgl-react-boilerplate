precision mediump float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uVector;
uniform sampler2D uStencilImg;

void main()
{
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 uvCentered = uv - 0.5;
    vec2 uvScaled = uvCentered / uVector.z;
    vec2 uvTranslated = uvScaled + (uVector.xy - 0.5);
    vec2 uvFinal = uvTranslated + 0.5;
    float onTexture = texture2D(uStencilImg, uvFinal).r;
    if (onTexture > 0.5) {
        discard; // will not write to stencil
    }
    gl_FragColor = vec4(0., 0., 0., 1.);
}