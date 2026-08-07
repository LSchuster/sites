// Distant starfield: a few thousand twinkling points on a far shell, with a
// handful of brighter tinted stars that bloom picks up.

import * as THREE from 'three';

export interface Starfield {
  points: THREE.Points;
  update(time: number): void;
  dispose(): void;
}

export function buildStarfield(count = 2600): Starfield {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const rnd = new Float32Array(count);

  const tints = [
    new THREE.Color(0.72, 0.8, 1.0),
    new THREE.Color(1.0, 0.95, 0.85),
    new THREE.Color(0.85, 0.88, 1.0),
    new THREE.Color(1.0, 0.82, 0.72),
  ];

  for (let i = 0; i < count; i++) {
    // uniform direction on the sphere
    const z = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const dist = 34 + Math.random() * 26;
    positions[i * 3] = r * Math.cos(phi) * dist;
    positions[i * 3 + 1] = z * dist;
    positions[i * 3 + 2] = r * Math.sin(phi) * dist;

    const tint = tints[Math.floor(Math.random() * tints.length)]!;
    const bright = Math.random() < 0.06 ? 1.4 + Math.random() : 0.35 + Math.random() * 0.5;
    colors[i * 3] = tint.r * bright;
    colors[i * 3 + 1] = tint.g * bright;
    colors[i * 3 + 2] = tint.b * bright;
    rnd[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aRnd;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vTwinkle = 0.75 + 0.25 * sin(uTime * (0.6 + fract(aRnd) * 1.7) + aRnd * 13.0);
        gl_PointSize = (1.1 + fract(aRnd * 7.31) * 1.6) * uPixelRatio;
        vColor = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        float alpha = smoothstep(0.5, 0.12, d);
        gl_FragColor = vec4(vColor * vTwinkle, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = -10;

  return {
    points,
    update(time) {
      material.uniforms.uTime!.value = time;
      material.uniforms.uPixelRatio!.value = Math.min(2, window.devicePixelRatio || 1);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
