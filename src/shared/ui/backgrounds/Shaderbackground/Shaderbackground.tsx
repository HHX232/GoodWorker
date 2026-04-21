'use client'
import React, { useEffect, useRef } from 'react';

const vsSource = `
  attribute vec4 aVertexPosition;
  void main() {
    gl_Position = aVertexPosition;
  }
`;

const fsSource = `
  precision highp float;
  uniform vec2 iResolution;
  uniform float iTime;

  const float overallSpeed    = 0.15;
  const float gridSmoothWidth = 0.003;
  const float lineSpeed       = 1.0 * overallSpeed;
  const float lineAmplitude   = 0.8;
  const float lineFrequency   = 0.18;
  const float warpSpeed       = 0.15 * overallSpeed;
  const float warpFrequency   = 0.3;
  const float warpAmplitude   = 0.3;
  const float offsetFrequency = 0.4;
  const float offsetSpeed     = 1.0 * overallSpeed;
  const float minOffsetSpread = 0.5;
  const float maxOffsetSpread = 3.5;
  const float lineWidth       = 0.007;   // crisp, thin
  const float scale           = 5.0;
  const int   linesPerGroup   = 6;       // fewer lines

  const vec3 bgColor       = vec3(0.933, 0.937, 0.973);
  const vec3 blackLine     = vec3(0.078, 0.078, 0.086);
  const vec3 gradientStart = vec3(1.0,   0.478, 0.0);
  const vec3 gradientEnd   = vec3(0.741, 0.0,   1.0);

  // Hard crisp line — no softness
  float crispLine(float linePos, float hw, float t) {
    return smoothstep(hw + gridSmoothWidth, hw - gridSmoothWidth, abs(linePos - t));
  }

  float random(float t) {
    return (cos(t) + cos(t * 1.3 + 1.3) + cos(t * 1.4 + 1.4)) / 3.0;
  }

  float plasmaY(float x, float offset) {
    return random(x * lineFrequency + iTime * lineSpeed) * lineAmplitude + offset;
  }

  void main() {
    vec2 uv    = gl_FragCoord.xy / iResolution.xy;
    vec2 space = (gl_FragCoord.xy - iResolution.xy * 0.5) / iResolution.x * 2.0 * scale;

    float vFade = 1.0 - (cos(uv.y * 6.28318) * 0.5 + 0.5);

    // Very subtle warp — keeps lines smooth, not chaotic
    space.y += random(space.x * warpFrequency + iTime * warpSpeed) * warpAmplitude;
    space.x += random(space.y * warpFrequency + iTime * warpSpeed + 2.0) * warpAmplitude * 0.3;

    // --- Black lines: crisp, edge to edge, no hFade ---
    float blackAlpha = 0.0;
    for (int l = 0; l < linesPerGroup; l++) {
      float fi        = float(l);
      float offsetPos = fi + space.x * offsetFrequency;
      float rand      = random(offsetPos + iTime * offsetSpeed) * 0.5 + 0.5;
      float offset    = random(offsetPos + iTime * offsetSpeed * (1.0 + fi * 0.1))
                        * mix(minOffsetSpread, maxOffsetSpread, 0.5);
      float lineY     = plasmaY(space.x, offset);
      float line      = crispLine(lineY, lineWidth, space.y);
      blackAlpha     += line * 0.85;
    }
    blackAlpha = clamp(blackAlpha, 0.0, 1.0) * vFade;

    // --- Single gradient accent line ---
    float ai      = 3.5;
    float aOff    = random(ai + iTime * offsetSpeed * 0.9)
                    * mix(minOffsetSpread, maxOffsetSpread, 0.6);
    float aLineY  = plasmaY(space.x, aOff);
    float aLine   = crispLine(aLineY, lineWidth * 1.6, space.y);
    float accentA = clamp(aLine, 0.0, 1.0) * vFade;

    vec3 gradColor = mix(gradientStart, gradientEnd, uv.x);

    vec3 col = bgColor;
    col = mix(col, blackLine, blackAlpha);
    col = mix(col, gradColor, accentA);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function loadShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initShaderProgram(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const vert = loadShader(gl, gl.VERTEX_SHADER, vs);
  const frag = loadShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!vert || !frag) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

const canvasStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  zIndex: -1,
  display: 'block',
};

const ShaderBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.warn('WebGL not supported.');
      return;
    }

    const program = initShaderProgram(gl, vsSource, fsSource);
    if (!program) return;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const vertexPos   = gl.getAttribLocation(program, 'aVertexPosition');
    const resolutionL = gl.getUniformLocation(program, 'iResolution');
    const timeL       = gl.getUniformLocation(program, 'iTime');

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    let animId: number;
    const start = Date.now();

    const render = () => {
      const t = (Date.now() - start) / 1000;
      gl.clearColor(0.933, 0.937, 0.973, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(resolutionL, canvas.width, canvas.height);
      gl.uniform1f(timeL, t);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(vertexPos, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(vertexPos);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} style={canvasStyle} />;
};

export default ShaderBackground;