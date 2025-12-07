
export enum BodyType {
  BOX = 'BOX',
  SPHERE = 'SPHERE',
  CYLINDER = 'CYLINDER',
  CONE = 'CONE',
  PYRAMID = 'PYRAMID',
  CAPSULE = 'CAPSULE',
  TORUS = 'TORUS',
  ICOSAHEDRON = 'ICOSAHEDRON'
}

export enum ParticleShape {
  POINT = 'POINT',
  SPHERE = 'SPHERE',
  BOX = 'BOX',
  CYLINDER = 'CYLINDER',
  CONE = 'CONE',
  TRAPEZOID = 'TRAPEZOID'
}

export enum SpawnMode {
  PILE = 'PILE',
  BLAST = 'BLAST',
  JET = 'JET',
  FLOAT = 'FLOAT'
}

export enum VisualizationMode {
  GEOMETRY = 'GEOMETRY',
  STRESS = 'STRESS',
  VELOCITY = 'VELOCITY'
}

export interface ScientificMaterial {
  id: string;
  name: string;
  youngsModulus: number; // Stiffness (MPa)
  viscosity: number;     // Flow Resistance (0-1 factor for simulation)
  yieldStress: number;   // Plasticity Threshold (0-1)
  density: number;       // kg/m^3
  color: string;         // The VISUAL color chosen by user
}

export interface PhysicsAnalysis {
  material: ScientificMaterial;
  objectMapping: {
    [key in BodyType]?: string;
  };
  reasoning: string;
  estimatedCounts: {
    [key in BodyType]?: number;
  };
  spawnMode: SpawnMode;
  snap?: number;
}

export interface SimStats {
  activeParticles: number;
  systemEnergy: number;
  systemSnap: number; // Jerk (da/dt)
}

export interface ParticleData {
  positions: Float32Array;
  colors: Float32Array;
  count: number;
}
