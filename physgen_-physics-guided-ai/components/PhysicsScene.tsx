
import React, { useState, useRef, useImperativeHandle, forwardRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, MeshReflectorMaterial, Instance, Instances } from '@react-three/drei';
import { BodyType, ScientificMaterial, SimStats, SpawnMode, VisualizationMode, ParticleShape } from '../types';
import { Vector3, Color, Points, BufferGeometry, BufferAttribute, PointsMaterial, NormalBlending, Raycaster, Plane, Vector2, Object3D, InstancedMesh } from 'three';

// --- Constants ---
const GRAVITY_EARTH = -9.81;
const GRAVITY_ZERO = -0.1;
const DT = 0.016;
const PARTICLE_RADIUS = 0.2;
const FLOOR_LEVEL = 0;
const PARTICLE_MASS = 0.01;

interface ParticleSystemProps {
  objects: SpawnedVolume[];
  material: ScientificMaterial;
  isSimulating: boolean;
  spawnMode: SpawnMode;
  particleDensity: number;
  onStatsUpdate?: (stats: SimStats) => void;
  pointsInstanceRef: React.MutableRefObject<Points | null>;
  meshInstanceRef: React.MutableRefObject<InstancedMesh | null>;
  mousePosition: React.MutableRefObject<Vector3>;
  replayTrigger: number;
  particleShape: ParticleShape;
}

interface SpawnedVolume {
  id: string;
  type: BodyType;
  position: Vector3;
  scale: Vector3;
}

// --- Geometry Sampling (Unchanged math, condensed for brevity) ---
const getShapeParticle = (type: BodyType, scale: Vector3): Vector3 => {
  const vec = new Vector3();
  // Simplified sampling for brevity - ensuring we fill the volume
  if (type === BodyType.SPHERE) {
    do { vec.set((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2); } while (vec.lengthSq() > 1);
    vec.multiply(scale);
  } else if (type === BodyType.CYLINDER) {
    const r = Math.sqrt(Math.random()) * scale.x;
    const theta = Math.random() * 2 * Math.PI;
    vec.set(r * Math.cos(theta), (Math.random() - 0.5) * scale.y, r * Math.sin(theta));
  } else if (type === BodyType.CONE) {
    const h = scale.y; const y = Math.random() * h; const r = (y / h) * scale.x * Math.sqrt(Math.random()); const t = Math.random() * 2 * Math.PI;
    vec.set(r * Math.cos(t), y - (h / 2), r * Math.sin(t));
  } else { // BOX default
    vec.set((Math.random() - 0.5) * scale.x, (Math.random() - 0.5) * scale.y, (Math.random() - 0.5) * scale.z);
  }
  return vec;
};

// --- Particle Engine ---
const ParticleEngine = ({ objects, material, isSimulating, spawnMode, particleDensity, onStatsUpdate, pointsInstanceRef, meshInstanceRef, mousePosition, replayTrigger, particleShape }: ParticleSystemProps) => {
  const frameCounter = useRef(0);
  // Mesh ref is now passed from parent
  const meshRef = meshInstanceRef;

  // Semantic Colors (For AI)
  const semanticColors = useMemo(() => ({
    [BodyType.BOX]: new Color('#00FFFF'),     // Cyan
    [BodyType.SPHERE]: new Color('#FF00FF'),  // Pink
    [BodyType.CYLINDER]: new Color('#800080'),// Purple
    [BodyType.CONE]: new Color('#FFA500'),    // Orange
  }), []);

  const particles = useMemo(() => {
    const isMesh = particleShape !== ParticleShape.POINT;
    const maxParticles = isMesh ? 5000 : 40000;
    return {
      pos: new Float32Array(maxParticles * 3),
      vel: new Float32Array(maxParticles * 3),
      acc: new Float32Array(maxParticles * 3),
      col: new Float32Array(maxParticles * 3), // Current Display Color
      semanticCol: new Float32Array(maxParticles * 3), // Hidden Semantic Color
      userCol: new Float32Array(maxParticles * 3), // Hidden User Preference Color
      count: 0,
      max: maxParticles
    };
  }, [particleShape]);

  // Initialization
  useEffect(() => {
    if (objects.length === 0) {
      particles.count = 0;
      if (pointsInstanceRef.current) pointsInstanceRef.current.geometry.setDrawRange(0, 0);
      if (meshRef.current) meshRef.current.count = 0;
      return;
    }

    let idx = 0;
    const userColor = new Color(material.color);

    // Mesh mode needs fewer particles to maintain FPS
    const densityMultiplier = particleShape !== ParticleShape.POINT ? 0.125 : 1.0;

    objects.forEach(obj => {
      const volumeCount = Math.min(4000, 400 * particleDensity * densityMultiplier);
      const semColor = semanticColors[obj.type] || new Color('#FFFFFF');

      for (let i = 0; i < volumeCount; i++) {
        if (idx >= particles.max) break;

        const localPos = getShapeParticle(obj.type, obj.scale);
        const wx = obj.position.x + localPos.x;
        const wy = obj.position.y + localPos.y;
        const wz = obj.position.z + localPos.z;

        particles.pos[idx * 3] = wx;
        particles.pos[idx * 3 + 1] = wy;
        particles.pos[idx * 3 + 2] = wz;

        // Init Velocity based on Spawn Mode
        let vx = 0, vy = 0, vz = 0;
        if (spawnMode === SpawnMode.BLAST) {
          const mag = 10 + Math.random() * 20;
          const d = localPos.clone().normalize();
          vx = d.x * mag; vy = d.y * mag + 5; vz = d.z * mag;
        } else if (spawnMode === SpawnMode.JET) {
          vx = 20 + Math.random() * 10; vy = (Math.random() - 0.5) * 5; vz = (Math.random() - 0.5) * 5;
        } else if (spawnMode === SpawnMode.FLOAT) {
          vx = (Math.random() - 0.5) * 2; vy = (Math.random() - 0.5) * 2; vz = (Math.random() - 0.5) * 2;
        }
        particles.vel[idx * 3] = vx;
        particles.vel[idx * 3 + 1] = vy;
        particles.vel[idx * 3 + 2] = vz;

        // Store Colors
        // 1. User Color (Visual)
        const variance = (Math.random() - 0.5) * 0.1;
        particles.userCol[idx * 3] = userColor.r + variance;
        particles.userCol[idx * 3 + 1] = userColor.g + variance;
        particles.userCol[idx * 3 + 2] = userColor.b + variance;

        // 2. Semantic Color (AI)
        particles.semanticCol[idx * 3] = semColor.r;
        particles.semanticCol[idx * 3 + 1] = semColor.g;
        particles.semanticCol[idx * 3 + 2] = semColor.b;

        // 3. Set Active Color to User Color initially
        particles.col[idx * 3] = particles.userCol[idx * 3];
        particles.col[idx * 3 + 1] = particles.userCol[idx * 3 + 1];
        particles.col[idx * 3 + 2] = particles.userCol[idx * 3 + 2];

        idx++;
      }
    });
    particles.count = idx;

    if (pointsInstanceRef.current) {
      pointsInstanceRef.current.geometry.attributes.position.needsUpdate = true;
      pointsInstanceRef.current.geometry.attributes.color.needsUpdate = true;
      pointsInstanceRef.current.geometry.setDrawRange(0, particles.count);
    }

    if (meshRef.current) {
      meshRef.current.count = particles.count;
    }

  }, [objects, particles, material.color, particleDensity, spawnMode, replayTrigger, particleShape]);

  // Physics Loop
  useFrame(() => {
    if (!isSimulating && !pointsInstanceRef.current && !meshRef.current) return;

    const count = particles.count;
    const { pos, vel, acc } = particles;
    const activeGravity = spawnMode === SpawnMode.FLOAT ? GRAVITY_ZERO : GRAVITY_EARTH;
    const damping = 0.99; // Air resistance
    const stiffness = material.youngsModulus * 0.2;

    let totalEnergy = 0;
    let totalSnap = 0;

    // Mouse Interaction Vector
    const mouseForce = new Vector3(0, 0, 0);
    const mousePos = mousePosition.current;

    // Temp Object for Matrix Update
    const dummy = new Object3D();

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // --- 1. Forces ---
      if (isSimulating) {
        let fx = 0, fy = activeGravity, fz = 0;

        // Floor interaction
        if (pos[i3 + 1] < FLOOR_LEVEL + 0.2) {
          fy += stiffness * 50 * (0.2 - (pos[i3 + 1] - FLOOR_LEVEL));
          vel[i3] *= 0.9;
          vel[i3 + 2] *= 0.9;
        }

        // Mouse Repulsion (The "Hand of God")
        if (mousePos.y > -999) {
          const dx = pos[i3] - mousePos.x;
          const dy = pos[i3 + 1] - mousePos.y;
          const dz = pos[i3 + 2] - mousePos.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          if (distSq < 25) { // 5 meter radius
            const dist = Math.sqrt(distSq);
            const force = (5.0 - dist) * 15.0; // Strong push
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
            fz += (dz / dist) * force;
          }
        }

        // --- 2. Integration ---
        vel[i3] += fx * DT;
        vel[i3 + 1] += fy * DT;
        vel[i3 + 2] += fz * DT;

        vel[i3] *= damping;
        vel[i3 + 1] *= damping;
        vel[i3 + 2] *= damping;

        pos[i3] += vel[i3] * DT;
        pos[i3 + 1] += vel[i3 + 1] * DT;
        pos[i3 + 2] += vel[i3 + 2] * DT;

        // Hard Floor Constraint
        if (pos[i3 + 1] < FLOOR_LEVEL) {
          pos[i3 + 1] = FLOOR_LEVEL;
          vel[i3 + 1] *= -0.3; // Bounce
        }

        // Stats
        const vSq = vel[i3] ** 2 + vel[i3 + 1] ** 2 + vel[i3 + 2] ** 2;
        totalEnergy += 0.5 * PARTICLE_MASS * vSq;

        // Jerk/Snap calculation
        const ax = (vel[i3] - (vel[i3] - fx * DT)) / DT; // Approximate
        totalSnap += Math.abs(ax);
      }

      // --- 3. Instanced Mesh Update ---
      if (particleShape !== ParticleShape.POINT && meshRef.current) {
        dummy.position.set(pos[i3], pos[i3 + 1], pos[i3 + 2]);

        // Random rotation per particle (stable based on index)
        // simplified: just rotate based on velocity for effect? or static random
        // Use stable random
        const seed = i * 0.134;
        dummy.rotation.set(seed, seed * 2, seed * 3);

        // Scale
        dummy.scale.setScalar(PARTICLE_RADIUS * 1.5);

        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);

        // Color
        meshRef.current.setColorAt(i, new Color(particles.col[i3], particles.col[i3 + 1], particles.col[i3 + 2]));
      }
    }

    if (pointsInstanceRef.current && particleShape === ParticleShape.POINT) {
      pointsInstanceRef.current.geometry.attributes.position.needsUpdate = true;
    }

    if (meshRef.current && particleShape !== ParticleShape.POINT) {
      meshRef.current.instanceMatrix.needsUpdate = true;
      meshRef.current.instanceColor && (meshRef.current.instanceColor.needsUpdate = true);
    }

    frameCounter.current += 1;
    if (onStatsUpdate && frameCounter.current % 10 === 0) {
      onStatsUpdate({
        activeParticles: count,
        systemEnergy: totalEnergy,
        systemSnap: totalSnap / (count || 1)
      });
    }
  });

  if (particleShape === ParticleShape.POINT) {
    return (
      <points ref={pointsInstanceRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={particles.max} array={particles.pos} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={particles.max} array={particles.col} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={PARTICLE_RADIUS} vertexColors sizeAttenuation transparent opacity={0.9} blending={NormalBlending} depthWrite={false} />
      </points>
    );
  } else {
    // Mesh Rendering
    let geometry = <boxGeometry args={[1, 1, 1]} />;
    if (particleShape === ParticleShape.SPHERE) geometry = <sphereGeometry args={[0.6, 8, 8]} />;
    if (particleShape === ParticleShape.CYLINDER) geometry = <cylinderGeometry args={[0.5, 0.5, 1, 8]} />;
    if (particleShape === ParticleShape.CONE) geometry = <coneGeometry args={[0.5, 1, 8]} />;
    if (particleShape === ParticleShape.TRAPEZOID) geometry = <cylinderGeometry args={[0.3, 0.6, 1, 8]} />; // Tapered plug

    return (
      <instancedMesh ref={meshRef} args={[undefined, undefined, particles.max]}>
        {geometry}
        <meshStandardMaterial color={material.color} roughness={0.4} metalness={0.5} />
      </instancedMesh>
    );
  }
};

// --- Scene Controller & Capture Logic ---
const SceneController = forwardRef((props: { pointsInstanceRef: React.MutableRefObject<Points | null>, meshInstanceRef: React.MutableRefObject<InstancedMesh | null> }, ref) => {
  const { gl, scene, camera } = useThree();
  const mouse = useRef(new Vector2());
  const raycaster = useRef(new Raycaster());
  const plane = useRef(new Plane(new Vector3(0, 1, 0), 0));
  const mouseWorldPos = useRef(new Vector3(0, -1000, 0)); // Hidden by default

  // Mouse Interactivity
  useFrame(({ mouse: pointer }) => {
    raycaster.current.setFromCamera(pointer, camera);
    const target = new Vector3();
    raycaster.current.ray.intersectPlane(plane.current, target);
    if (target) {
      mouseWorldPos.current.copy(target);
    } else {
      mouseWorldPos.current.set(0, -1000, 0);
    }
  });

  useImperativeHandle(ref, () => ({
    getMousePos: () => mouseWorldPos,
    capture: () => {
      // --- DUAL-VIEW CAPTURE TECHNOLOGY ---

      // 1. POINTS MODE CAPTURE
      const points = props.pointsInstanceRef.current;
      if (points) {
        const prevSize = (points.material as PointsMaterial).size;
        const prevVertexColors = (points.material as PointsMaterial).vertexColors;
        const prevColor = (points.material as PointsMaterial).color.clone();

        // Set for AI Capture
        (points.material as PointsMaterial).size = prevSize * 6.0; // Splat
        (points.material as PointsMaterial).vertexColors = false;
        (points.material as PointsMaterial).color.setHex(0x00FFFF); // CYAN BLOBS
        (points.material as PointsMaterial).opacity = 1.0;
        (points.material as PointsMaterial).needsUpdate = true;

        gl.render(scene, camera);
        const dataUrl = gl.domElement.toDataURL('image/png');

        // Restore
        (points.material as PointsMaterial).size = prevSize;
        (points.material as PointsMaterial).vertexColors = prevVertexColors;
        (points.material as PointsMaterial).color.copy(prevColor);
        (points.material as PointsMaterial).opacity = 0.9;
        (points.material as PointsMaterial).needsUpdate = true;

        gl.render(scene, camera);
        return dataUrl;
      }

      // 2. MESH MODE CAPTURE
      const mesh = props.meshInstanceRef.current;
      if (mesh) {
        const material = mesh.material as any;
        const prevColor = material.color.clone();

        // Set for AI Capture
        material.color.setHex(0x00FFFF);
        material.needsUpdate = true;

        gl.render(scene, camera);
        const dataUrl = gl.domElement.toDataURL('image/png');

        // Restore
        material.color.copy(prevColor);
        material.needsUpdate = true;

        gl.render(scene, camera);
        return dataUrl;
      }

      return null;
    }
  }));

  return null;
});

const PhysicsScene = forwardRef<any, {
  onCapture: (url: string) => void,
  material: ScientificMaterial,
  isSimulating: boolean,
  spawnMode: SpawnMode,
  particleDensity: number,
  onStatsUpdate: (stats: SimStats) => void,
  particleShape: ParticleShape
}>((props, ref) => {

  const [volumes, setVolumes] = useState<SpawnedVolume[]>([]);
  const [replayTrigger, setReplayTrigger] = useState(0);
  const controllerRef = useRef<any>(null);
  const pointsInstanceRef = useRef<Points>(null);
  const meshInstanceRef = useRef<InstancedMesh>(null);

  useImperativeHandle(ref, () => ({
    spawnBatch: (counts: any) => {
      setVolumes([]);
      setTimeout(() => {
        const newVolumes: SpawnedVolume[] = [];
        Object.entries(counts).forEach(([type, count]: [string, any]) => {
          const numericCount = typeof count === 'number' ? count : 0;
          for (let i = 0; i < numericCount; i++) {
            newVolumes.push({
              id: Math.random().toString(),
              type: type as BodyType,
              position: new Vector3((Math.random() - 0.5) * 4, 5 + Math.random() * 4, (Math.random() - 0.5) * 4), // Lower spawn height
              scale: new Vector3(1.5, 1.5, 1.5),
            });
          }
        });
        setVolumes(newVolumes);
      }, 50);
    },
    addObject: (type: BodyType) => {
      setVolumes(prev => [...prev, {
        id: Math.random().toString(),
        type: type,
        position: new Vector3((Math.random() - 0.5) * 4, 6, (Math.random() - 0.5) * 4),
        scale: new Vector3(1.5, 1.5, 1.5),
      }]);
    },
    resetScene: () => setVolumes([]),
    triggerCapture: () => {
      const dataUrl = controllerRef.current?.capture();
      if (dataUrl) props.onCapture(dataUrl);
    },
    triggerReplay: () => {
      setReplayTrigger(t => t + 1);
    }
  }));

  return (
    <Canvas
      camera={{ position: [10, 10, 10], fov: 45 }}
      className="w-full h-full bg-slate-950"
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      shadows
    >
      <SceneController ref={controllerRef} pointsInstanceRef={pointsInstanceRef} meshInstanceRef={meshInstanceRef} />
      <color attach="background" args={['#020617']} />

      {/* Reflective Floor for visual grounding */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[50, 50]} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={1024}
          mixBlur={1}
          mixStrength={40}
          roughness={1}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#1e293b"
          metalness={0.5}
        />
      </mesh>

      <Grid args={[30, 30]} cellSize={1} cellThickness={1} cellColor="#334155" sectionSize={5} sectionThickness={1.5} sectionColor="#0ea5e9" fadeDistance={30} position={[0, 0.01, 0]} />

      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 20, 5]} intensity={1.5} castShadow />
      <pointLight position={[-10, 5, -10]} intensity={1} color="#06b6d4" />

      <ParticleEngine
        objects={volumes}
        material={props.material}
        isSimulating={props.isSimulating}
        spawnMode={props.spawnMode}
        particleDensity={props.particleDensity}
        onStatsUpdate={props.onStatsUpdate}
        pointsInstanceRef={pointsInstanceRef}
        meshInstanceRef={meshInstanceRef}
        mousePosition={controllerRef.current ? controllerRef.current.getMousePos() : { current: new Vector3(0, -1000, 0) }}
        replayTrigger={replayTrigger}
        particleShape={props.particleShape}
      />

      <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
    </Canvas>
  );
});

export default PhysicsScene;

