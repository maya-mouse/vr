'use strict';

let gl;                         
let surface;                    
let shProgram;                  
let spaceball;                  

let videoElement;
let webcamTexture;
let webcamQuadBuffer;
let webcamTexCoordBuffer;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

function StereoCamera(convergence, eyeSeparation, aspectRatio, fovDeg, nearClippingDistance, farClippingDistance) {
    this.mConvergence          = convergence;
    this.mEyeSeparation        = eyeSeparation;
    this.mAspectRatio          = aspectRatio;
    this.mFOV                  = deg2rad(fovDeg);
    this.mNearClippingDistance = nearClippingDistance;
    this.mFarClippingDistance  = farClippingDistance;

    this.makeFrustum = function(left, right, bottom, top, near, far) {
        let m = new Float32Array(16);
        m[0] = (2 * near) / (right - left);
        m[5] = (2 * near) / (top - bottom);
        m[8] = (right + left) / (right - left);
        m[9] = (top + bottom) / (top - bottom);
        m[10] = -(far + near) / (far - near);
        m[11] = -1;
        m[14] = -(2 * far * near) / (far - near);
        m[15] = 0;
        return m;
    };

    this.getLeftProjection = function() {
        let top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
        let bottom = -top;
        let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
        let b = a - this.mEyeSeparation / 2;
        let c = a + this.mEyeSeparation / 2;
        let left = -b * this.mNearClippingDistance / this.mConvergence;
        let right = c * this.mNearClippingDistance / this.mConvergence;

        return this.makeFrustum(left, right, bottom, top, this.mNearClippingDistance, this.mFarClippingDistance);
    };

    this.getRightProjection = function() {
        let top = this.mNearClippingDistance * Math.tan(this.mFOV / 2);
        let bottom = -top;
        let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
        let b = a - this.mEyeSeparation / 2;
        let c = a + this.mEyeSeparation / 2;
        let left = -c * this.mNearClippingDistance / this.mConvergence;
        let right = b * this.mNearClippingDistance / this.mConvergence;

        return this.makeFrustum(left, right, bottom, top, this.mNearClippingDistance, this.mFarClippingDistance);
    };
}

function rebuildSurfaceFromUI() {
    let uCount = parseInt(document.getElementById('uCount')?.value) || 60;
    let vCount = parseInt(document.getElementById('vCount')?.value) || 48;

    if (uCount < 3) uCount = 3;
    if (vCount < 2) vCount = 2;

    surface.createBuffersFromSurface(
        function(u, v){ return dingDong_param(u, v, 1.0); },
        uCount, vCount
    );
    
    surface.setColors([1.0, 1.0, 1.0, 1.0], [1.0, 1.0, 1.0, 1.0]);
}

function updateWebcamTexture() {
    gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
    if (videoElement && videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);
    }
}

function draw() {
    updateWebcamTexture();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    let eyeSep = parseFloat(document.getElementById('eyeSep').value);
    let fov = parseFloat(document.getElementById('fov').value);
    let nearClip = parseFloat(document.getElementById('nearClip').value);
    let convergence = parseFloat(document.getElementById('convergence').value);

    document.getElementById('eyeSepVal').innerText = eyeSep.toFixed(3);
    document.getElementById('fovVal').innerText = fov;
    document.getElementById('nearClipVal').innerText = nearClip.toFixed(1);
    document.getElementById('convergenceVal').innerText = convergence.toFixed(1);

    let camera = new StereoCamera(convergence, eyeSep, 1.0, fov, nearClip, 100.0);

    gl.disable(gl.DEPTH_TEST);
    gl.uniform1i(shProgram.uIsWebcam, 1);

    gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, webcamQuadBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, webcamTexCoordBuffer);
    gl.vertexAttribPointer(shProgram.iAttribTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribTexCoord);

    gl.colorMask(true, true, true, true);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.DEPTH_TEST);
    gl.uniform1i(shProgram.uIsWebcam, 0);

    let modelViewBase = (typeof spaceball !== 'undefined' && spaceball) ? spaceball.getViewMatrix() : m4.identity();
    
    let modelTransform = m4.translation(0, 0, -10.0);
    modelTransform = m4.scale(modelTransform, 5.0, 5.0, 1.0); 
    
    let modelViewCombined = m4.multiply(modelTransform, modelViewBase);

    let leftProjection = camera.getLeftProjection();
    let leftEyeTranslate = m4.translation(eyeSep / 2, 0, 0); 
    let leftModelView = m4.multiply(leftEyeTranslate, modelViewCombined);
    let leftMVP = m4.multiply(leftProjection, leftModelView);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, leftMVP);
    gl.colorMask(true, false, false, false);
    surface.Draw();

    gl.clear(gl.DEPTH_BUFFER_BIT);

    let rightProjection = camera.getRightProjection();
    let rightEyeTranslate = m4.translation(-eyeSep / 2, 0, 0); 
    let rightModelView = m4.multiply(rightEyeTranslate, modelViewCombined);
    let rightMVP = m4.multiply(rightProjection, rightModelView);

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, rightMVP);
    gl.colorMask(false, true, true, false);
    surface.Draw();

    gl.colorMask(true, true, true, true);
}

function initWebcam() {
    videoElement = document.getElementById('webcam');

    navigator.mediaDevices.getUserMedia({ video: { width: 600, height: 600 } })
    .then(function(stream) {
        videoElement.srcObject = stream;
        videoElement.play();
        function animate() {
            draw();
            requestAnimationFrame(animate);
        }
        requestAnimationFrame(animate);
    })
    .catch(function(err) {
        console.error("Не вдалося отримати доступ до веб-камери: ", err);
    });

    webcamTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    let vertices = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0,
    ]);
    webcamQuadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, webcamQuadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    let texCoords = new Float32Array([
        0.0, 1.0,
        1.0, 1.0,
        0.0, 0.0,
        1.0, 0.0,
    ]);
    webcamTexCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, webcamTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
}

function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('StereoShader', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribTexCoord            = gl.getAttribLocation(prog, "texCoord");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");
    shProgram.uIsWebcam                  = gl.getUniformLocation(prog, "u_isWebcam");

    surface = new Model('Surface');

    rebuildSurfaceFromUI();
    initWebcam();

    ['uCount','vCount'].forEach(id => {
        let el = document.getElementById(id);
        if (el) el.addEventListener('change', () => { rebuildSurfaceFromUI(); draw(); });
    });

    ['eyeSep', 'fov', 'nearClip', 'convergence'].forEach(id => {
        let el = document.getElementById(id);
        if (el) el.addEventListener('input', draw);
    });

    gl.enable(gl.DEPTH_TEST);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader: " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader: " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program: " + gl.getProgramInfoLog(prog));
    }
    return prog;
}

function ShaderProgram(name, program) {
    this.name = name;
    this.prog = program;
    this.iAttribVertex = -1;
    this.iAttribTexCoord = -1;
    this.iColor = -1;
    this.iModelViewProjectionMatrix = -1;
    this.uIsWebcam = -1;
    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);
    draw();
}