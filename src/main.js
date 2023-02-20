import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'lil-gui'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import terrainVertexShader from './shaders/terrain/vertex.glsl'
import terrainFragmentShader from './shaders/terrain/fragment.glsl'
import { LinearFilter, WebGLRenderTarget } from 'three'

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Debug
 */
const gui = new dat.GUI({ width: 300 })
const guiDummy = {}
guiDummy.clearColor = '#080024'

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: Math.min(window.devicePixelRatio, 2)
}

window.addEventListener('resize', () => {
  // Update sizes
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight
  sizes.pixelRatio = Math.min(window.devicePixelRatio, 2)

  // Update camera
  camera.aspect = sizes.width / sizes.height
  camera.instance.updateProjectionMatrix()

  // Update renderer
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(sizes.pixelRatio)
  
  // Update effect composer
  effectComposer.setSize(sizes.width, sizes.height)
  effectComposer.setPixelRatio(sizes.pixelRatio)

  // Update passes
  bokehPass.renderTargetDepth.width = sizes.width * sizes.pixelRatio
  bokehPass.renderTargetDepth.height = sizes.height * sizes.pixelRatio
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.x = 1
camera.position.y = 1
camera.position.z = 1
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Terrain
 */
const terrain = {}
const terrainFolder = gui.addFolder('Terrain Material')

// Texture
terrain.texture = {}
terrain.texture.linesCount = 5
terrain.texture.bigLineWidth = 0.04
terrain.texture.smallLineWAlpha = 0.5
terrain.texture.smallLineWidth = 0.01
terrain.texture.width = 32
terrain.texture.height = 128
terrain.texture.canvas = document.createElement('canvas')
terrain.texture.canvas.width = terrain.texture.width
terrain.texture.canvas.height = terrain.texture.height
terrain.texture.canvas.style.position = 'fixed'
terrain.texture.canvas.style.top = 0
terrain.texture.canvas.style.left = 0
terrain.texture.canvas.style.zIndex = 1
document.body.append(terrain.texture.canvas)

terrain.texture.context = terrain.texture.canvas.getContext('2d')

terrain.texture.instance = new THREE.CanvasTexture(terrain.texture.canvas)
terrain.texture.instance.wrapS = THREE.RepeatWrapping
terrain.texture.instance.wrapT = THREE.RepeatWrapping
terrain.texture.instance.mabFilter = THREE.NearestFilter

terrain.texture.update = () => {
  terrain.texture.context.clearRect(0, 0, terrain.texture.width, terrain.texture.height)

  // Big line
  const actualBigLineWidth = Math.round(terrain.texture.height * terrain.texture.bigLineWidth)
  terrain.texture.context.globalAlpha = 1

  terrain.texture.context.fillStyle = '#ffffff'
  terrain.texture.context.fillRect(0,
    0,
    terrain.texture.width,
    actualBigLineWidth)

  //Small lines
  const actualSmallLineWidth = Math.round(terrain.texture.height * terrain.texture.smallLineWidth)
  const smallLinesCount = terrain.texture.linesCount - 1

  for (let i = 0; i < smallLinesCount; i++) {
    terrain.texture.context.globalAlpha = terrain.texture.smallLineWAlpha
    terrain.texture.context.fillRect(
      0,
      actualBigLineWidth + Math.round((terrain.texture.height - actualBigLineWidth) / terrain.texture.linesCount) * (i + 1),
      terrain.texture.width,
      actualSmallLineWidth
    )
  }

  // Update texture inistance
  terrain.texture.instance.needsUpdate = true
}

terrain.texture.update()
const textureFolder = gui.addFolder('Terrain Texture')
textureFolder.add(terrain.texture, 'linesCount').min(1).max(10).step(1).onChange(terrain.texture.update)
textureFolder.add(terrain.texture, 'bigLineWidth').min(0).max(0.1).step(0.0001).onChange(terrain.texture.update)
textureFolder.add(terrain.texture, 'smallLineWidth').min(0).max(0.1).step(0.0001).onChange(terrain.texture.update)
textureFolder.add(terrain.texture, 'smallLineWAlpha').min(0).max(1).step(0.001).onChange(terrain.texture.update)

// Geometry
terrain.geometry = new THREE.PlaneGeometry(1, 1, 1000, 1000)
terrain.geometry.rotateX(- Math.PI * 0.5)

// Material
terrain.material = new THREE.ShaderMaterial({
  transparent: true,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  vertexShader: terrainVertexShader,
  fragmentShader: terrainFragmentShader,
  uniforms: {
    uTexture: { value: terrain.texture.instance },
    uElevation: { value: 2}
  }
})


terrainFolder.add(terrain.material.uniforms.uElevation, "value").min(0).max(5).step(0.001).name("uElevation")

// Mesh
terrain.mesh = new THREE.Mesh(terrain.geometry, terrain.material)
terrain.mesh.scale.set(10, 10, 10)
scene.add(terrain.mesh)

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
})
renderer.setClearColor(guiDummy.clearColor, 1)
renderer.outputEncoding = THREE.sRGBEncoding
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)

// EffectComposer
const renderTarget = new THREE.WebGLRenderTarget(800, 600, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
  encoding: THREE.sRGBEncoding
})
const effectComposer = new EffectComposer(renderer)
effectComposer.setSize(sizes.width, sizes.height)
effectComposer.setPixelRatio(sizes.pixelRatio)

// RenderPass
const renderPass = new RenderPass(scene, camera)
effectComposer.addPass(renderPass)

// Bokeh Pass
const bokehPass = new BokehPass(scene, camera, {
  focus: 1.0,
  aperture: 0.025,
  maxblur: 0.01,

  width: sizes.width * sizes.pixelRatio,
  height: sizes.height * sizes.pixelRatio
})
effectComposer.addPass(bokehPass)

const folder = gui.addFolder( 'BokehPass' );
folder.add(bokehPass, "enabled").name('bokeh enabled')
folder.add(bokehPass.materialBokeh.uniforms.focus, "value").min(0).max(10).step(0.001).name('focus')
folder.add(bokehPass.materialBokeh.uniforms.aperture, "value").min(0.0002).max(0.1).step(0.0001).name('aperture')
folder.add(bokehPass.materialBokeh.uniforms.maxblur, "value").min(0).max(0.02).step(0.0001).name('maxblur')


/**
 * Animate
 */
const clock = new THREE.Clock()
let lastElapsedTime = 0

const tick = () => {
  const elapsedTime = clock.getElapsedTime()
  const deltaTime = elapsedTime - lastElapsedTime
  lastElapsedTime = elapsedTime

  // Update controls
  controls.update()

  // Render
  renderer.render(scene, camera)
  effectComposer.render()

  // Call tick again on the next frame
  window.requestAnimationFrame(tick)
}

tick()