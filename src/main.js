import './style.css'
import gsap from 'gsap'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'lil-gui'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { BokehPass } from './Passes/BokehPass'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import terrainVertexShader from './shaders/terrain/vertex.glsl'
import terrainFragmentShader from './shaders/terrain/fragment.glsl'
import terrainDepthVertexShader from './shaders/terrain/vertex.glsl'
import terrainDepthFragmentShader from './shaders/terrain/fragment.glsl'
import overlayVertexShader from './shaders/overlay/vertex.glsl'
import overlayFragmentShader from './shaders/overlay/fragment.glsl'

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
let showDebug = true

const debugMenu = document.querySelector('.menu')
debugMenu.addEventListener('click', () => {
  if (showDebug) {
    gui.hide()
    showDebug = false
  } else {
    gui.show()
    showDebug = true
  }
})

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
  camera.instance.aspect = sizes.width / sizes.height
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
const camera = {}
camera.position = new THREE.Vector3()
camera.rotation = new THREE.Euler()
camera.rotation.reorder('YXZ')

// Base camera
camera.instance = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.instance.rotation.reorder('YXZ')
scene.add(camera.instance)

// Orbit controls
const orbitControls = new OrbitControls(camera.instance, canvas)
orbitControls.enabled = false
orbitControls.enableDamping = true

/**
 * Terrain
 */
const terrain = {}
const terrainFolder = gui.addFolder('Terrain Material')

// Texture
terrain.texture = {}
terrain.texture.visible = false
terrain.texture.linesCount = 5
terrain.texture.bigLineWidth = 0.08
terrain.texture.smallLineWidth = 0.01
terrain.texture.smallLineAlpha = 0.5
terrain.texture.width = 1
terrain.texture.height = 128
terrain.texture.canvas = document.createElement('canvas')
terrain.texture.canvas.width = terrain.texture.width
terrain.texture.canvas.height = terrain.texture.height
terrain.texture.canvas.style.position = 'fixed'
terrain.texture.canvas.style.top = 0
terrain.texture.canvas.style.left = 0
terrain.texture.canvas.style.width = '50px'
terrain.texture.canvas.style.height = `${terrain.texture.height}px`
terrain.texture.canvas.style.zIndex = 1

if (terrain.texture.visible) {
  document.body.append(terrain.texture.canvas)
}

terrain.texture.context = terrain.texture.canvas.getContext('2d')

terrain.texture.instance = new THREE.CanvasTexture(terrain.texture.canvas)
terrain.texture.instance.wrapS = THREE.RepeatWrapping
terrain.texture.instance.wrapT = THREE.RepeatWrapping
terrain.texture.instance.magFilter = THREE.NearestFilter

terrain.texture.update = () => {
  terrain.texture.context.clearRect(0, 0, terrain.texture.width, terrain.texture.height)

  // Big line
  const actualBigLineWidth = Math.round(terrain.texture.height * terrain.texture.bigLineWidth)
  terrain.texture.context.globalAlpha = 1
  terrain.texture.context.fillStyle = '#ffffff'

  terrain.texture.context.fillRect(
    0,
    0,
    terrain.texture.width,
    actualBigLineWidth
  )

  // Small lines
  const actualSmallLineWidth = Math.round(terrain.texture.height * terrain.texture.smallLineWidth)
  const smallLinesCount = terrain.texture.linesCount - 1

  for (let i = 0; i < smallLinesCount; i++) {
    terrain.texture.context.globalAlpha = terrain.texture.smallLineAlpha
    terrain.texture.context.fillStyle = '#00ffff'
    terrain.texture.context.fillRect(
      0,
      actualBigLineWidth + Math.round((terrain.texture.height - actualBigLineWidth) / terrain.texture.linesCount) * (i + 1),
      terrain.texture.width,
      actualSmallLineWidth
    )
  }

  // Update texture instance
  terrain.texture.instance.needsUpdate = true
}

terrain.texture.update()


const textureFolder = gui.addFolder('Terrain Texture')
textureFolder.add(terrain.texture, 'linesCount').min(1).max(10).step(1).onChange(terrain.texture.update)
textureFolder.add(terrain.texture, 'bigLineWidth').min(0).max(0.1).step(0.0001).onChange(terrain.texture.update)
textureFolder.add(terrain.texture, 'smallLineWidth').min(0).max(0.1).step(0.0001).onChange(terrain.texture.update)
textureFolder.add(terrain.texture, 'smallLineAlpha').min(0).max(1).step(0.001).onChange(terrain.texture.update)
textureFolder.add(terrain.texture, 'visible').name('Terrain texture').onChange(() => {
  if (terrain.texture.visible) {
    document.body.append(terrain.texture.canvas)
  }
  else {
    document.body.removeChild(terrain.texture.canvas)
  }
})

// Geometry
terrain.geometry = new THREE.PlaneGeometry(1, 1, 1000, 1000)
terrain.geometry.rotateX(- Math.PI * 0.5)

// Uniforms
terrain.uniforms = {
  uTexture: { value: terrain.texture.instance },
  uElevation: { value: 2 },
  uElevationValley: { value: 0.4 },
  uElevationValleyFrequency: { value: 1.5 },
  uElevationGeneral: { value: 0.2 },
  uElevationGeneralFrequency: { value: 0.2 },
  uElevationDetails: { value: 0.2 },
  uElevationDetailsFrequency: { value: 2.012 },
  uTextureFrequency: { value: 10 },
  uTextureOffset: { value: 0.585 },
  uTime: { value: 0 },
  uHslHue: { value: 1.0 },
  uHslHueOffset: { value: 0.0 },
  uHslHueFrequency: { value: 10.0 },
  uHslTimeFrequency: { value: 0.05 },
  uHslLightness: { value: 0.75 },
  uHslLightnessVariation: { value: 0.25 },
  uHslLightnessFrequency: { value: 20.0 }
}


terrainFolder.add(terrain.uniforms.uElevation, "value").min(0).max(5).step(0.001).name("uElevation")
terrainFolder.add(terrain.uniforms.uElevationValley, "value").min(0).max(1).step(0.001).name("uElevationValley")
terrainFolder.add(terrain.uniforms.uElevationValleyFrequency, "value").min(0).max(10).step(0.001).name("uElevationValleyFrequency")
terrainFolder.add(terrain.uniforms.uElevationGeneral, "value").min(0).max(1).step(0.001).name("uElevationGeneral")
terrainFolder.add(terrain.uniforms.uElevationGeneralFrequency, "value").min(0).max(10).step(0.001).name("uElevationGeneralFrequency")
terrainFolder.add(terrain.uniforms.uElevationDetails, "value").min(0).max(1).step(0.001).name("uElevationDetails")
terrainFolder.add(terrain.uniforms.uElevationDetailsFrequency, "value").min(0).max(10).step(0.001).name("uElevationDetailsFrequency")
terrainFolder.add(terrain.uniforms.uTextureFrequency, "value").min(0.01).max(50).step(0.01).name("uTextureFrequency")
terrainFolder.add(terrain.uniforms.uHslHue, "value").min(0).max(1).step(0.001).name("uHslHue")
terrainFolder.add(terrain.uniforms.uHslHueOffset, "value").min(0).max(1).step(0.001).name("uHslHueOffset")
terrainFolder.add(terrain.uniforms.uHslHueFrequency, "value").min(0).max(50).step(0.01).name("uHslHueFrequency")
terrainFolder.add(terrain.uniforms.uHslLightness, "value").min(0).max(1).step(0.001).name("uHslLightness")
terrainFolder.add(terrain.uniforms.uHslLightnessVariation, "value").min(0).max(1).step(0.001).name("uHslLightnessVariation")
terrainFolder.add(terrain.uniforms.uHslLightnessFrequency, "value").min(0).max(50).step(0.01).name("uHslLightnessFrequency")
terrainFolder.add(terrain.uniforms.uHslTimeFrequency, "value").min(0).max(0.2).step(0.001).name("uHslTimeFrequency")
terrainFolder.add(terrain.uniforms.uTextureOffset, "value").min(0).max(1).step(0.001).name("uTextureOffset")

// Material
terrain.material = new THREE.ShaderMaterial({
  transparent: true,
  // blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  vertexShader: terrainVertexShader,
  fragmentShader: terrainFragmentShader,
  uniforms: terrain.uniforms
})

// Depth material
const uniforms = THREE.UniformsUtils.merge([
  THREE.UniformsLib.common,
  THREE.UniformsLib.displacementmap
])
for (const uniformKey in terrain.uniforms) {
  uniforms[uniformKey] = terrain.uniforms[uniformKey]
}

terrain.depthMaterial = new THREE.ShaderMaterial({
  uniforms: uniforms,
  vertexShader: terrainDepthVertexShader,
  fragmentShader: terrainDepthFragmentShader
})

terrain.depthMaterial.depthPacking = THREE.RGBADepthPacking
terrain.depthMaterial.blending = THREE.NoBlending

// Mesh
terrain.mesh = new THREE.Mesh(terrain.geometry, terrain.material)
terrain.mesh.scale.set(10, 10, 10)
terrain.mesh.userData.depthMaterial = terrain.depthMaterial
scene.add(terrain.mesh)

/**
 * Overlay
 */
const overlay = {}

overlay.vignetteColor = {}
overlay.vignetteColor.value = '#4f1f96'
overlay.vignetteColor.instance = new THREE.Color(overlay.vignetteColor.value)

overlay.overlayColor = {}
overlay.overlayColor.value = '#130621'
overlay.overlayColor.instance = new THREE.Color(overlay.overlayColor.value)

overlay.geometry = new THREE.PlaneGeometry(2, 2)

overlay.material = new THREE.ShaderMaterial({
  uniforms:
  {
    uVignetteColor: { value: overlay.vignetteColor.instance },
    uVignetteMultiplier: { value: 1.16 },
    uVignetteOffset: { value: - 1 },
    uOverlayColor: { value: overlay.overlayColor.instance },
    uOverlayAlpha: { value: 1 }
  },
  vertexShader: overlayVertexShader,
  fragmentShader: overlayFragmentShader,
  transparent: true,
  depthTest: false
})
overlay.mesh = new THREE.Mesh(overlay.geometry, overlay.material)
overlay.mesh.userData.noBokeh = true
overlay.mesh.frustumCulled = false
scene.add(overlay.mesh)

window.requestAnimationFrame(() => {
  gsap.to(overlay.material.uniforms.uOverlayAlpha, { delay: 0.4, duration: 3, value: 0, ease: 'power2.out' })
  gsap.to(overlay.material.uniforms.uVignetteOffset, { delay: 0.4, duration: 3, value: - 0.165, ease: 'power2.out' })
})

const vignetteFolder = gui.addFolder('Vignette');
vignetteFolder.add(overlay.material.uniforms.uVignetteMultiplier, "value").min(0).max(5).step(0.001).name('uMultiplier')
vignetteFolder.add(overlay.material.uniforms.uVignetteOffset, "value").min(-2).max(2).step(0.001).name('uOffset')



/**
 * Renderer
 */
// Renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  // antialias: true,
})
renderer.setClearColor(guiDummy.clearColor, 1)
renderer.outputEncoding = THREE.sRGBEncoding
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(sizes.pixelRatio)

// EffectComposer
const effectComposer = new EffectComposer(renderer)
effectComposer.setSize(sizes.width, sizes.height)
effectComposer.setPixelRatio(sizes.pixelRatio)

// Render pass
const renderPass = new RenderPass(scene, camera.instance)
effectComposer.addPass(renderPass)

// Bokeh pass
const bokehPass = new BokehPass(
  scene,
  camera.instance,
  {
    focus: 1.0,
    aperture: 0.015,
    maxblur: 0.01,

    width: sizes.width * sizes.pixelRatio,
    height: sizes.height * sizes.pixelRatio
  }
)

effectComposer.addPass(bokehPass)

const folder = gui.addFolder('BokehPass');
folder.add(bokehPass, "enabled").name('bokeh enabled')
folder.add(bokehPass.materialBokeh.uniforms.focus, "value").min(0).max(10).step(0.001).name('focus')
folder.add(bokehPass.materialBokeh.uniforms.aperture, "value").min(0.0002).max(0.1).step(0.0001).name('aperture')
folder.add(bokehPass.materialBokeh.uniforms.maxblur, "value").min(0).max(0.02).step(0.0001).name('maxblur')

// Unreal bloom pass
const unrealBloomPass = new UnrealBloomPass(new THREE.Vector2(sizes.width, sizes.height), 1.5, 0.4, 0.85)
unrealBloomPass.enabled = false
effectComposer.addPass(unrealBloomPass)

/**
 * View
 */
const view = {}
view.index = 0
view.settings = [
  {
    position: { x: 0, y: 2.124, z: - 0.172 },
    rotation: { x: -1.489, y: - Math.PI, z: 0 },
    focus: 2.14,
    parallaxMultiplier: 0.25
  },
  {
    position: { x: 1, y: 1.1, z: 0 },
    rotation: { x: -0.833, y: 1.596, z: 1.651 },
    focus: 1.1,
    parallaxMultiplier: 0.12
  },
  {
    position: { x: 1, y: 0.87, z: - 0.97 },
    rotation: { x: - 0.638, y: 2.33, z: 0 },
    focus: 1.36,
    parallaxMultiplier: 0.12
  },
  {
    position: { x: -1.43, y: 0.33, z: -0.144 },
    rotation: { x: -0.312, y: -1.67, z: 0 },
    focus: 1.25,
    parallaxMultiplier: 0.12
  }
]
view.current = view.settings[view.index]

// Parallax
view.parallax = {}
view.parallax.target = {}
view.parallax.target.x = 0
view.parallax.target.y = 0
view.parallax.eased = {}
view.parallax.eased.x = 0
view.parallax.eased.y = 0
view.parallax.eased.multiplier = 4

window.addEventListener('mousemove', (_event) => {
  view.parallax.target.x = (_event.clientX / sizes.width - 0.5) * view.parallax.multiplier
  view.parallax.target.y = - (_event.clientY / sizes.height - 0.5) * view.parallax.multiplier
})

// Apply
view.apply = () => {
  // Camera
  camera.position.copy(view.current.position)
  camera.rotation.x = view.current.rotation.x
  camera.rotation.y = view.current.rotation.y

  // Bokeh
  bokehPass.materialBokeh.uniforms.focus.value = view.current.focus

  // Parallax
  view.parallax.multiplier = view.current.parallaxMultiplier
}

// Change
view.change = (_index) => {
  view.index = _index
  view.current = view.settings[_index]

  // Show overlay
  gsap.to(
    overlay.material.uniforms.uOverlayAlpha,
    {
      duration: 1.25,
      value: 1,
      ease: 'power2.inOut',
      onComplete: () => {
        view.apply()

        // Hide overlay
        gsap.to(
          overlay.material.uniforms.uOverlayAlpha,
          {
            duration: 1,
            value: 0,
            ease: 'power2.inOut'
          }
        )
      }
    }
  )
}

view.apply()

window.setInterval(() => {
  view.change((view.index + 1) % view.settings.length)
}, 7500)

// Focus animation
const changeFocus = () => {
  gsap.to(
    bokehPass.materialBokeh.uniforms.focus,
    {
      duration: 0.5 + Math.random() * 3,
      delay: 0.5 + Math.random() * 1,
      ease: 'power2.inOut',
      onComplete: changeFocus,
      value: view.current.focus + Math.random() - 0.2
    }
  )
}

changeFocus()

/**
 * Presets
 */
const presets = {}
presets.settings = [
  {
    vignetteColor: '#4f1f96',
    overlayColor: '#130621',
    clearColor: '#080024',
    terrainHue: 1,
    terrainHueOffset: 0
  },
  {
    vignetteColor: '#590826',
    overlayColor: '#21060b',
    clearColor: '#240004',
    terrainHue: 0.145,
    terrainHueOffset: 0.86
  },
  {
    vignetteColor: '#1f6a96',
    overlayColor: '#050e1c',
    clearColor: '#000324',
    terrainHue: 0.12,
    terrainHueOffset: 0.5
  },
  {
    vignetteColor: '#1f9682',
    overlayColor: '#02100c',
    clearColor: '#00240c',
    terrainHue: 0.12,
    terrainHueOffset: 0.2
  }
]

presets.apply = (_index) => {
  const presetsSettings = presets.settings[_index]

  overlay.vignetteColor.instance.set(presetsSettings.vignetteColor)

  overlay.overlayColor.instance.set(presetsSettings.overlayColor)

  terrain.uniforms.uHslHue.value = presetsSettings.terrainHue
  terrain.uniforms.uHslHueOffset.value = presetsSettings.terrainHueOffset

  renderer.setClearColor(presetsSettings.clearColor, 1)
}

/**
 * Animate
 */
const clock = new THREE.Clock()
let lastElapsedTime = 0

const tick = () => {
  const elapsedTime = clock.getElapsedTime()
  const deltaTime = elapsedTime - lastElapsedTime
  lastElapsedTime = elapsedTime

  // Update terrain
  terrain.uniforms.uTime.value = elapsedTime

  // Update controls
  if (orbitControls.enabled) {
    orbitControls.update()
  }

  // Camera
  camera.instance.position.copy(camera.position)

  view.parallax.eased.x += (view.parallax.target.x - view.parallax.eased.x) * deltaTime * view.parallax.eased.multiplier
  view.parallax.eased.y += (view.parallax.target.y - view.parallax.eased.y) * deltaTime * view.parallax.eased.multiplier
  camera.instance.translateX(view.parallax.eased.x)
  camera.instance.translateY(view.parallax.eased.y)

  camera.instance.rotation.x = camera.rotation.x
  camera.instance.rotation.y = camera.rotation.y

  // Render
  // renderer.render(scene, camera.instance)
  effectComposer.render()

  // Call tick again on the next frame
  window.requestAnimationFrame(tick)
}

tick()