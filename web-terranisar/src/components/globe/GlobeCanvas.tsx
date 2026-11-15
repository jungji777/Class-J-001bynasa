import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  formatLatLon,
  geojsonToRings,
  latLonToVector3,
  vector3ToLatLon,
} from "@/lib/globe/geo";
import GlobeFlat from "./GlobeFlat";

/** Honduras centroid — initial camera focus. */
const HONDURAS = { lat: 14.85, lon: -86.6 };

export interface GlobeLayers {
  border: boolean;
  lights: boolean;
  graticule: boolean;
}

export interface GlobeHandle {
  zoomBy: (factor: number) => void;
  flyTo: (lat: number, lon: number, distance?: number) => void;
}

interface GlobeCanvasProps {
  layers: GlobeLayers;
  onCursor?: (coords: string | null) => void;
  onUserInteract?: () => void;
}

const MIN_DISTANCE = 1.45;
const MAX_DISTANCE = 3.4;

const GlobeCanvas = forwardRef<GlobeHandle, GlobeCanvasProps>(
  ({ layers, onCursor, onUserInteract }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [webglUnavailable, setWebglUnavailable] = useState(false);
    const zoomQueue = useRef<number[]>([]);
    const sceneObjects = useRef<{
      border: THREE.Group | null;
      graticule: THREE.Group | null;
      lights: THREE.MeshStandardMaterial | null;
    }>({ border: null, graticule: null, lights: null });
    const flyTarget = useRef<{
      from: THREE.Vector3;
      to: THREE.Vector3;
      t: number;
      duration: number;
    } | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);

    useImperativeHandle(ref, () => ({
      zoomBy(factor: number) {
        zoomQueue.current.push(factor);
      },
      flyTo(lat: number, lon: number, distance = 2.1) {
        controlsRef.current.autoRotate = false;
        const from = cameraRef.current.position.clone();
        const to = latLonToVector3(lat, lon, distance);
        flyTarget.current = { from, to, t: 0, duration: 1.4 };
      },
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      // Sondeo barato de soporte WebGL antes de montar Three.js
      const probe = document.createElement("canvas");
      const gl =
        probe.getContext("webgl2") ?? probe.getContext("webgl");
      if (!gl) {
        setWebglUnavailable(true);
        return;
      }

      // Creación tolerante: sin GPU real (aceleración de hardware
      // desactivada, GPU en lista de bloqueo, preview sin GPU) se reintenta
      // sin preferencias y, si nada funciona, se activa el respaldo 2D.
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          powerPreference: "high-performance",
        });
      } catch {
        try {
          renderer = new THREE.WebGLRenderer({ antialias: false });
        } catch {
          setWebglUnavailable(true);
          return;
        }
      }

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        42,
        container.clientWidth / container.clientHeight,
        0.05,
        60,
      );
      camera.position.copy(latLonToVector3(HONDURAS.lat, HONDURAS.lon, 3.15));
      cameraRef.current = camera;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setClearColor(0x0b1118, 1);
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controlsRef.current = controls;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.minDistance = MIN_DISTANCE;
      controls.maxDistance = MAX_DISTANCE;
      controls.rotateSpeed = 0.55;
      controls.zoomSpeed = 0.7;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;

      // --- Earth -----------------------------------------------------------
      const textureLoader = new THREE.TextureLoader();
      let textureReady = false;
      const nightTexture = textureLoader.load(
        "/textures/earth-night.jpg",
        () => {
          textureReady = true;
        },
      );
      nightTexture.colorSpace = THREE.SRGBColorSpace;
      nightTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(1, 96, 96),
        new THREE.MeshStandardMaterial({
          map: nightTexture,
          emissiveMap: nightTexture,
          emissive: new THREE.Color(0xbfd8e8),
          emissiveIntensity: 0.9,
          color: new THREE.Color(0x8fa8b8),
          roughness: 1,
          metalness: 0,
          transparent: true,
          opacity: 0,
        }),
      );
      scene.add(earth);

      // --- Atmosphere glow (fresnel, back side) ----------------------------
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.09, 64, 64),
        new THREE.ShaderMaterial({
          vertexShader: /* glsl */ `
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vView = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }
          `,
          fragmentShader: /* glsl */ `
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.1);
              vec3 glow = mix(vec3(0.08, 0.30, 0.36), vec3(0.30, 0.72, 0.64), rim);
              gl_FragColor = vec4(glow, rim * 0.75);
            }
          `,
          transparent: true,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      scene.add(atmosphere);

      // --- Stars -----------------------------------------------------------
      const starCount = 2600;
      const starPositions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const v = new THREE.Vector3()
          .randomDirection()
          .multiplyScalar(18 + Math.random() * 22);
        starPositions.set([v.x, v.y, v.z], i * 3);
      }
      const starGeometry = new THREE.BufferGeometry();
      starGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(starPositions, 3),
      );
      const stars = new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
          color: 0x9fb4c4,
          size: 0.055,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.75,
        }),
      );
      scene.add(stars);

      // --- Honduras border --------------------------------------------------
      let beacon: THREE.Mesh | null = null;
      let beaconHalo: THREE.Mesh | null = null;
      fetch("/geo/hnd.json")
        .then((r) => r.json())
        .then((geojson: { features: { geometry: Parameters<typeof geojsonToRings>[0] }[] }) => {
          const rings = geojsonToRings(geojson.features[0].geometry, 1.004);
          const borderGroup = new THREE.Group();
          rings.forEach(({ points }) => {
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.LineLoop(
              geometry,
              new THREE.LineBasicMaterial({
                color: 0x7fd6c2,
                transparent: true,
                opacity: 0.95,
              }),
            );
            borderGroup.add(line);
          });
          scene.add(borderGroup);
          sceneObjects.current.border = borderGroup;

          // Pulsing beacon over the country centroid
          const pos = latLonToVector3(HONDURAS.lat, HONDURAS.lon, 1.012);
          beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.012, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0x7fd6c2 }),
          );
          beacon.position.copy(pos);
          scene.add(beacon);
          beaconHalo = new THREE.Mesh(
            new THREE.SphereGeometry(0.02, 16, 16),
            new THREE.MeshBasicMaterial({
              color: 0x7fd6c2,
              transparent: true,
              opacity: 0.35,
            }),
          );
          beaconHalo.position.copy(pos);
          scene.add(beaconHalo);
        })
        .catch(() => undefined);

      // --- Graticule --------------------------------------------------------
      const graticuleGroup = new THREE.Group();
      const graticuleMaterial = new THREE.LineBasicMaterial({
        color: 0x8fa2b0,
        transparent: true,
        opacity: 0.14,
      });
      const R = 1.002;
      for (let lat = -75; lat <= 75; lat += 15) {
        const pts: THREE.Vector3[] = [];
        for (let lon = -180; lon <= 180; lon += 3) {
          pts.push(latLonToVector3(lat, lon, R));
        }
        graticuleGroup.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            graticuleMaterial,
          ),
        );
      }
      for (let lon = -180; lon < 180; lon += 15) {
        const pts: THREE.Vector3[] = [];
        for (let lat = -90; lat <= 90; lat += 3) {
          pts.push(latLonToVector3(lat, lon, R));
        }
        graticuleGroup.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            graticuleMaterial,
          ),
        );
      }
      scene.add(graticuleGroup);
      sceneObjects.current.graticule = graticuleGroup;
      sceneObjects.current.lights = earth.material as THREE.MeshStandardMaterial;

      // --- Lighting ----------------------------------------------------------
      scene.add(new THREE.AmbientLight(0xbfd4e0, 0.6));
      const sun = new THREE.DirectionalLight(0x8fb8cc, 0.9);
      sun.position.set(-3, 1.6, 2.4);
      scene.add(sun);

      // --- Interaction: cursor readout + auto-rotate stop ---------------------
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let pointerActive = false;

      const onPointerMove = (e: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        pointerActive = true;
      };
      const onPointerLeave = () => {
        pointerActive = false;
        onCursor?.(null);
      };
      const onControlsStart = () => {
        controls.autoRotate = false;
        onUserInteract?.();
      };
      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerleave", onPointerLeave);
      controls.addEventListener("start", onControlsStart);

      // --- Zoom queue (from +/- buttons) -------------------------------------
      const applyZoom = (factor: number) => {
        const dir = camera.position.clone().normalize();
        const next = THREE.MathUtils.clamp(
          camera.position.length() * factor,
          MIN_DISTANCE,
          MAX_DISTANCE,
        );
        flyTarget.current = {
          from: camera.position.clone(),
          to: dir.multiplyScalar(next),
          t: 0,
          duration: 0.45,
        };
      };

      // --- Animation loop -----------------------------------------------------
      const clock = new THREE.Clock();
      let frame = 0;

      const tick = () => {
        frame = requestAnimationFrame(tick);
        const dt = clock.getDelta();
        const elapsed = clock.elapsedTime;

        if (zoomQueue.current.length > 0) {
          applyZoom(zoomQueue.current.shift()!);
        }

        const fly = flyTarget.current;
        if (fly) {
          fly.t += dt / fly.duration;
          const k = THREE.MathUtils.smoothstep(Math.min(fly.t, 1), 0, 1);
          const dir = fly.from
            .clone()
            .normalize()
            .lerp(fly.to.clone().normalize(), k)
            .normalize();
          const radius = THREE.MathUtils.lerp(
            fly.from.length(),
            fly.to.length(),
            k,
          );
          camera.position.copy(dir.multiplyScalar(radius));
          if (fly.t >= 1) flyTarget.current = null;
        }

        controls.update();

        if (textureReady) {
          const mat = earth.material as THREE.MeshStandardMaterial;
          mat.opacity = Math.min(1, mat.opacity + dt * 3.2);
        }

        if (beacon && beaconHalo) {
          const pulse = 1 + Math.sin(elapsed * 2.4) * 0.35;
          beaconHalo.scale.setScalar(pulse);
          (beaconHalo.material as THREE.MeshBasicMaterial).opacity =
            0.42 - 0.22 * (pulse - 0.65) / 0.7;
        }

        if (pointerActive) {
          raycaster.setFromCamera(pointer, camera);
          const hit = raycaster.intersectObject(earth, false)[0];
          if (hit) {
            const { lat, lon } = vector3ToLatLon(hit.point);
            onCursor?.(formatLatLon(lat, lon));
          } else {
            onCursor?.(null);
          }
        }

        renderer.render(scene, camera);
      };
      tick();

      const onResize = () => {
        if (!container.clientWidth || !container.clientHeight) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      };
      window.addEventListener("resize", onResize);

      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", onResize);
        container.removeEventListener("pointermove", onPointerMove);
        container.removeEventListener("pointerleave", onPointerLeave);
        controls.removeEventListener("start", onControlsStart);
        controls.dispose();
        controlsRef.current = null;
        renderer.dispose();
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
            obj.geometry.dispose();
            const mat = obj.material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat.dispose();
          }
        });
        nightTexture.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // React to layer toggles without rebuilding the scene
    useEffect(() => {
      const { border, graticule, lights } = sceneObjects.current;
      if (border) border.visible = layers.border;
      if (graticule) graticule.visible = layers.graticule;
      if (lights)
        lights.emissiveIntensity = layers.lights ? 0.9 : 0.12;
    }, [layers]);

    if (webglUnavailable) {
      return <GlobeFlat ref={ref} layers={layers} onCursor={onCursor} />;
    }

    return <div ref={containerRef} className="absolute inset-0" />;
  },
);

GlobeCanvas.displayName = "GlobeCanvas";
export default GlobeCanvas;
