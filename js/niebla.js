import * as THREE from "three";

// Niebla del color del cielo: lo lejano no se funde en un gris parejo (que se veía como trozos
// blancos sobre Lima) sino en la foto del cielo que hay justo detrás, en esa misma dirección.
// Se importa antes de crear materiales: cambia los trozos de shader de la niebla para todos.
export const uniformesCielo = {
  cieloNiebla: { value: null },
  cieloTinte: { value: new THREE.Color(0xffffff) },
  cieloListo: { value: 0 },
};

THREE.ShaderChunk.fog_pars_vertex += `
#ifdef USE_FOG
  varying vec3 vDirCielo;
#endif`;
THREE.ShaderChunk.fog_vertex += `
#ifdef USE_FOG
  vDirCielo = (vec4(mvPosition.xyz, 0.0) * viewMatrix).xyz;
#endif`;
THREE.ShaderChunk.fog_pars_fragment += `
#ifdef USE_FOG
  varying vec3 vDirCielo;
  uniform sampler2D cieloNiebla;
  uniform vec3 cieloTinte;
  uniform float cieloListo;
#endif`;
// Mismo mapeo que la esfera del cielo (SphereGeometry con la v elevada a 1.5) y mismo tono
THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace(
  "gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );", `
  vec3 colorNiebla = fogColor;
  if (cieloListo > 0.5) {
    vec3 dir = normalize(vDirCielo);
    float u = fract(atan(dir.z, -dir.x) / 6.2831853);
    float v = pow(clamp(1.0 - acos(clamp(dir.y, -1.0, 1.0)) / 3.14159265, 0.0, 1.0), 1.5);
    vec3 cielo = textureLod(cieloNiebla, vec2(u, v), 2.0).rgb * cieloTinte;
    #ifdef TONE_MAPPING
      cielo = toneMapping(cielo);
    #endif
    colorNiebla = linearToOutputTexel(vec4(cielo, 1.0)).rgb;
  }
  gl_FragColor.rgb = mix(gl_FragColor.rgb, colorNiebla, fogFactor);`);

// Cada material recibe los mismos objetos uniformes: basta cambiar .value una vez.
export function conNieblaCielo(shader) {
  Object.assign(shader.uniforms, uniformesCielo);
}
THREE.Material.prototype.onBeforeCompile = conNieblaCielo;
