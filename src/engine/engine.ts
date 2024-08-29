import bgndVertexShader from '../shaders/vertexBgnd.vert';
import bgndFragmentShader from '../shaders/fragmentBgnd.frag';
import stencilVertexShader from '../shaders/vertexStencil.vert';
import stencilFragmentShader from '../shaders/fragmentStencil.frag';
import paintVertexShader from '../shaders/vertexPaint.vert';
import paintFragmentShader from '../shaders/fragmentPaint.frag';
import { Dispatch, SetStateAction } from 'react';
import { setUpProgram, setUniform, setAttributes, getUniform, makeRenderTarget, updateRenderTarget } from './wglUtils';
import { Vec3, Uniform, Package, RenderTarget } from './types';



class Engine {
    canvas: HTMLCanvasElement;
    gl: WebGLRenderingContext | null;
    renderTarget: RenderTarget | null = null;
    packages: Package[];
    vector: Vec3;
    floatVar1: number;
    floatVar2: number;
    startTime: number;
    frameCount: number;
    lastFrameCount: number;
    lastFrameTime: DOMHighResTimeStamp;
    setFPS: Dispatch<SetStateAction<number>>;
    renderCount: number;
    img: HTMLImageElement;
    bgndImg: HTMLImageElement;
    imgLoadCount: number = 0;

    constructor(canvas: HTMLCanvasElement, setFPS: Dispatch<SetStateAction<number>>) {
        this.packages = [];
        this.startTime = Date.now();
        this.canvas = canvas;
        this.gl = this.canvas!.getContext('webgl2', {stencil: true});
        this.vector = {x: 0, y: 0, z: 0};
        this.floatVar1 = 0;
        this.floatVar2 = 0;
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.lastFrameCount = 0;
        this.setFPS = setFPS;
        this.renderCount = 0;
        this.img = new Image();
        this.img.src = './LogoBackwardsWhite.png';
        this.img.onload = () => {
            this.imagesLoaded();
        }
        this.bgndImg = new Image();
        this.bgndImg.src = './darkTexture.jpg';
        this.bgndImg.onload = () => {
            this.imagesLoaded();
        }
    }

    imagesLoaded(): void {
        this.imgLoadCount++;
        if (this.imgLoadCount == 2) {
            // start
            this.init();
        } 
        // else wait for other images
    }

    init(): void {

        const gl = this.gl;
        const canvas = this.canvas;
        
        // Check Null
        if (canvas === null) { throw Error('Cannot get canvas'); }
        if (gl===null) { throw Error("Cannot get webgl context from canvas"); }
        
        // Clear Canvas
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        // Enable Depth Test
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        
        // Cull back faces
        gl.enable(gl.CULL_FACE);
        
        // Setup Stencil
        gl.enable(gl.STENCIL_TEST);
        
        // Set Canvas Size
        canvas.width = canvas.clientWidth; // resize to client canvas
        canvas.height = canvas.clientHeight; // resize to client canvas
        gl.viewport(0, 0, canvas.width, canvas.height);
        console.log('CANVAS DIMENSIONS:')
        console.log(canvas.width, canvas.height);      

        // Init two render targets: one static that only re-renders when needed, another dynamic that renders every frame
        this.renderTarget = makeRenderTarget(gl, canvas.width, canvas.height)

        // BACKGROUND PROGRAM
        let mapQuadPositions = [
            -1, -1,
            1, -1,
            1, 1,
            -1, -1,
            1, 1,
            -1, 1, 
        ];
        let mapQuadNormals = [
            0, 0,
            0, 0,
            0, 0,
            0, 0,
            0, 0,
            0, 0,
        ];
        
        // Set up Position Attribute
        let bgndBuffers = setAttributes(gl, mapQuadPositions, mapQuadNormals);

        // Define Uniforms
        let bgndUniforms: Uniform[] = [
            {
                name: 'uTime',
                val: this.getTime(),
                type: 'float',
                location: null
            },
            {
                name: 'uResolution',
                val: [canvas.width, canvas.height],
                type: 'vec2',
                location: null
            }
        ];

        // Create Program
        let bgndProgram = setUpProgram(gl, bgndVertexShader, bgndFragmentShader, bgndBuffers, bgndUniforms);

        // Add background texture
        const bgndImage = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, bgndImage);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.bgndImg);
        gl.generateMipmap(gl.TEXTURE_2D);
        const uImage = gl.getUniformLocation(bgndProgram, 'uImage');
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, bgndImage);
        gl.uniform1i(uImage, 0);

        // Package Program with Attributes and Uniforms
        let bgndPackage: Package = {
            name: 'background',
            active: true,
            attribs: bgndBuffers,
            uniforms: bgndUniforms,
            program: bgndProgram,
            hasNormals: false,
            stencil: 'none',
            image: bgndImage
        }
        this.packages.push(bgndPackage);

        // STENCIL PROGRAM

        let stencilPositions = [
            -1, -1,
            1, -1,
            1, 1,
            -1, -1,
            1, 1,
            -1, 1, 
        ];
        let stencilNormals = [
            0, 0,
            0, 0,
            0, 0,
            0, 0,
            0, 0,
            0, 0,
        ];

        // Set up Position Attribute
        let stencilBuffers = setAttributes(gl, stencilPositions, stencilNormals);

        // Define Uniforms
        let stencilUniforms: Uniform[] = [
            {
                name: 'uVector',
                val: [this.vector.x, this.vector.y, this.vector.z],
                type: 'vec3',
                location: null
            },
            {
                name: 'uTime',
                val: this.getTime(),
                type: 'float',
                location: null
            },
            {
                name: 'uResolution',
                val: [canvas.width, canvas.height],
                type: 'vec2',
                location: null
            }
        ];

        
        // Create Program
        let stencilProgram = setUpProgram(gl, stencilVertexShader, stencilFragmentShader, stencilBuffers, stencilUniforms);
        
        // Add background texture
        const stencilImage = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, stencilImage);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img);
        gl.generateMipmap(gl.TEXTURE_2D);
        const uStencilImg = gl.getUniformLocation(stencilProgram, 'uStencilImg');
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, stencilImage);
        gl.uniform1i(uStencilImg, 0);

        // Package Program with Attributes and Uniforms
        let stencilPackage: Package = {
            name: 'stencil',
            active: true,
            attribs: stencilBuffers,
            uniforms: stencilUniforms,
            program: stencilProgram,
            hasNormals: false,
            stencil: 'write',
            image: stencilImage
        }
        this.packages.push(stencilPackage);
        

        // PAINT PROGRAM
        let paintPositions = [
            -1, -1,
            1, -1,
            1, 1,
            -1, -1,
            1, 1,
            -1, 1, 
        ];
        let paintNormals = [
            0, 0,
            0, 0,
            0, 0,
            0, 0,
            0, 0,
            0, 0,
        ];

        // Set up Position Attribute
        let paintBuffers = setAttributes(gl, paintPositions, paintNormals);

        // Define Uniforms
        let paintUniforms: Uniform[] = [
            {
                name: 'uFloatVar1',
                val: 0,
                type: 'float',
                location: null
            },
            {
                name: 'uFloatVar2',
                val: 0,
                type: 'float',
                location: null
            },
            {
                name: 'uTime',
                val: this.getTime(),
                type: 'float',
                location: null
            },
            {
                name: 'uResolution',
                val: [canvas.width, canvas.height],
                type: 'vec2',
                location: null
            }
        ];

        // Create Program
        let paintProgram = setUpProgram(gl, paintVertexShader, paintFragmentShader, paintBuffers, paintUniforms);

        // Package Program with Attributes and Uniforms
        let paintPackage: Package = {
            name: 'paint',
            active: true,
            attribs: paintBuffers,
            uniforms: paintUniforms,
            program: paintProgram,
            hasNormals: false,
            stencil: 'read',
            image: null
        }
        this.packages.push(paintPackage);

        console.log('PACKAGES:')
        console.log(this.packages)

        // function to resize window properly
        const resizeWindow = () => {
            if (!this.gl) { throw Error('Lost WebGL Render Context'); }
            let width = window.innerWidth;
            let height = window.innerHeight;
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
            canvas.width = width; // resize to client canvas
            canvas.height = height; // resize to client canvas
            gl.viewport(0, 0, canvas.width, canvas.height);
            if (this.renderTarget) {
                updateRenderTarget(gl, this.renderTarget, canvas.width, canvas.height)
            }
            let uResolution = getUniform(this.packages, 'background', 'uResolution');
            uResolution.val = [canvas.width, canvas.height];
            setUniform(this.gl, uResolution);
            // uResolution = getUniform(this.packages, 'stencil', 'uResolution');
            // uResolution.val = [canvas.width, canvas.height];
            // setUniform(this.gl, uResolution);
            // uResolution = getUniform(this.packages, 'paint', 'uResolution');
            // uResolution.val = [canvas.width, canvas.height];
            // setUniform(this.gl, uResolution);
            
        }

        // Run resize immediately after init and anytime a resize event triggers
        setTimeout(resizeWindow, 0);
        window.addEventListener("resize", resizeWindow);

        // Start animation loop
        this.animate();
    }

    // Animate!
    animate(): void {
        // update stats
        this.frameCount++;
        this.updateFPS();
        this.renderCount = 0; // reset number of renders per animate frame

        if (!this.gl) { throw Error('Lost WebGL Render Context') }
        const gl: WebGLRenderingContext = this.gl;

        if (!this.renderTarget?.framebuffer) { return; }

        // update time
        let time = this.getTime()/1000; // update uTime
        let uTime = getUniform(this.packages, 'background', 'uTime');
        uTime.val = time;
        uTime = getUniform(this.packages, 'stencil', 'uTime');
        uTime.val = time;
        uTime = getUniform(this.packages, 'paint', 'uTime');
        uTime.val = time;
            
        let stencilIndex = this.packages.map(pck => pck.name).indexOf('stencil');
        let paintIndex = this.packages.map(pck => pck.name).indexOf('paint');
        
        // Uniform References
        let uVector = getUniform(this.packages, 'stencil', 'uVector');
        uVector.val = [this.vector.x, this.vector.y, this.vector.z];
        let uFloatVar1 = getUniform(this.packages, 'paint', 'uFloatVar1');
        uFloatVar1.val = this.floatVar1;
        let uFloatVar2 = getUniform(this.packages, 'paint', 'uFloatVar2');
        uFloatVar2.val = this.floatVar2;
        
        // Draw to frame buffer instead of canvas
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.renderTarget.framebuffer);
        gl.clearColor(0, 0, 0, 0); 
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        // draw stencil and light
        this.drawPackage(gl, this.packages[stencilIndex]);
        this.drawPackage(gl, this.packages[paintIndex]);
       
        // Draw frame buffer to canvas
        let bgndIndex = this.packages.map(pck => pck.name).indexOf('background');
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 1); 
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.blendFunc(gl.ONE, gl.ZERO);
        this.drawPackage(gl, this.packages[bgndIndex]);
        
        requestAnimationFrame(this.animate.bind(this));
    }

    drawPackage(gl: WebGLRenderingContext, pck: Package): void {
        if (!pck.active) { return }

        this.renderCount++;

        // Set Program
        gl.useProgram(pck.program);

        // Stencil Settings
        switch (pck.stencil) {
            case 'none':
                // For programs not related to the stencil
                gl.stencilFunc(gl.ALWAYS, 1, 0xFF); // Always pass
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP); // Do not change stencil buffer
                gl.colorMask(true, true, true, true); // Enable color writing
                break;
            case 'write':
                // For programs that write to the stencil buffer (e.g. shadow mask)
                gl.clear(gl.STENCIL_BUFFER_BIT); // Clear stencil buffer
                gl.stencilFunc(gl.ALWAYS, 1, 0xFF); // Always pass
                gl.stencilOp(gl.KEEP, gl.REPLACE, gl.REPLACE); // Write to stencil buffer
                gl.colorMask(false, false, false, false); // Disable color writing
                break;
            case 'read':
                // For programs that want to be masked by the stencil buffer (e.g. light)
                gl.stencilFunc(gl.NOTEQUAL, 1, 0xFF); // Render where the stencil value is not 1
                gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP); // Do not change stencil buffer
                gl.colorMask(true, true, true, true); // Enable color writing
                break;
        }

        // Position Attributes
        let location = pck.attribs.aPosition.location;
        if (typeof location != 'number') { throw Error('Faulty attribute location')}
        gl.enableVertexAttribArray(location);
        gl.bindBuffer(gl.ARRAY_BUFFER, pck.attribs.aPosition.attribBuffer);
        gl.vertexAttribPointer( location, pck.attribs.aPosition.numComponents, pck.attribs.aPosition.type, false, 0, 0);

        // Normal Attributes
        if (pck.hasNormals) {
            // only add normals if they are used
            location = pck.attribs.aNormal.location;
            if (typeof location != 'number') { throw Error('Faulty attribute location')}
            gl.enableVertexAttribArray(location);
            gl.bindBuffer(gl.ARRAY_BUFFER, pck.attribs.aNormal.attribBuffer);
            gl.vertexAttribPointer( location, pck.attribs.aNormal.numComponents, pck.attribs.aNormal.type, false, 0, 0);
        }

        // Update Uniforms
        if (pck.name == 'background') {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.renderTarget!.texture);
            gl.uniform1i(gl.getUniformLocation(pck.program, "uRenderTarget"), 1);
            const uImage = gl.getUniformLocation(pck.program, 'uImage');
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, pck.image);
            gl.uniform1i(uImage, 0);
            setUniform(gl, getUniform(this.packages, 'background', 'uResolution')); 
            setUniform(gl, getUniform(this.packages, 'background', 'uTime')); 
        } else if (pck.name == 'stencil') {
            const uImage = gl.getUniformLocation(pck.program, 'uBgndImage');
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, pck.image);
            gl.uniform1i(uImage, 0);
            setUniform(gl, getUniform(this.packages, 'stencil', 'uVector')); 
        } else if (pck.name == 'paint') {
            setUniform(gl, getUniform(this.packages, 'paint', 'uFloatVar1'));
            setUniform(gl, getUniform(this.packages, 'paint', 'uFloatVar2'));
        }

        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, pck.attribs.aPosition.count); //primitive, offset, count
    }

    getTime(): number {
        return Date.now() - this.startTime;
    }

    updatePosition(floatVar1: number, floatVar2: number, vector: Vec3): void {
       this.vector = vector;
       this.floatVar1 = floatVar1;
       this.floatVar2 = floatVar2;
    }

    updateFPS(): void {
        let currentTime = performance.now();
        let deltaTime = currentTime - this.lastFrameTime;
        let testTime = 1000;
        // only update after a second (or testTime if changed)
        if (deltaTime >= testTime) {
            // figure out how many frames passed and divide by time passed
            let deltaFrames = this.frameCount - this.lastFrameCount;
            let fps = (deltaFrames / deltaTime) * 1000;
            this.setFPS(fps);

            // reset
            this.lastFrameTime = currentTime;
            this.lastFrameCount = this.frameCount;
        }
    }
}

export default Engine
