// Villain types and their properties
export enum VillainType {
  ZOMBIE = 'zombie',
  SKELETON = 'skeleton',
  GHOST = 'ghost',
}

// Villain stats
export const VILLAIN_STATS = {
  [VillainType.ZOMBIE]: {
    health: 100,
    damage: 15, // Reduced to be more balanced
    speed: 4.0,
    attackRange: 3.0,
    detectionRange: 30,
    attackCooldown: 1.0, // Increased cooldown for better balance
    color: 0x2a6e2a, // dark green
    scale: { x: 0.8, y: 1.8, z: 0.6 },
    description: 'Aggressive enemy that deals moderate damage'
  },
  [VillainType.SKELETON]: {
    health: 70,
    damage: 20, // Reduced to be more balanced
    speed: 5.5,
    attackRange: 3.5,
    detectionRange: 35,
    attackCooldown: 0.8, // Increased cooldown for better balance
    color: 0xd9d9d9, // light gray
    scale: { x: 0.7, y: 1.7, z: 0.5 },
    description: 'Fast and agile enemy with strong attacks'
  },
  [VillainType.GHOST]: {
    health: 50,
    damage: 25, // Reduced to be more balanced
    speed: 4.5,
    attackRange: 2.5,
    detectionRange: 25,
    attackCooldown: 0.6, // Increased cooldown for better balance
    color: 0x6666cc, // purple-blue
    scale: { x: 0.6, y: 1.5, z: 0.4 },
    description: 'Sneaky ghost that can surprise the player with powerful attacks'
  }
};

// Villain spawn settings
export const VILLAIN_SPAWN_SETTINGS = {
  maxVillains: 75, // Increased maximum number of villains
  initialSpawnCount: 30, // More villains at the start
  initialSpawnDelay: 1, // Faster initial spawn
  spawnInterval: {
    day: 1.5,    // More frequent spawns during day
    dusk: 1.25,  // More frequent spawns during dusk
    night: 0.75, // Much more frequent spawns at night
    dawn: 1.25,  // More frequent spawns during dawn
  },
  spawnDistance: {
    min: 8,   // Closer minimum spawn distance
    max: 60,   // Further maximum spawn distance
  },
  difficultyIncrease: {
    interval: 20, // Faster difficulty scaling
    healthMultiplier: 1.2,  // Enemies get tougher faster
    damageMultiplier: 1.15, // Enemies hit harder faster
    maxDifficultyLevel: 20  // Higher max difficulty
  }
};

// Villain behavior states
export enum VillainState {
  IDLE = 'idle',
  PATROLLING = 'patrolling',
  CHASING = 'chasing',
  ATTACKING = 'attacking',
  STUNNED = 'stunned',
  DEAD = 'dead'
}

// Villain animation settings
export const VILLAIN_ANIMATION = {
  attackDuration: 0.5, // seconds
  deathDuration: 1.0, // seconds
  stunnedDuration: 2.0, // seconds
  idleMovementRadius: 5.0, // maximum distance to move when idle
  patrolRadius: 15.0, // maximum distance to patrol from spawn point
};

// Sound effects for villains
export const VILLAIN_SOUNDS = {
  [VillainType.ZOMBIE]: {
    spawn: 'zombie_spawn',
    attack: 'zombie_attack',
    hurt: 'zombie_hurt',
    death: 'zombie_death'
  },
  [VillainType.SKELETON]: {
    spawn: 'skeleton_spawn',
    attack: 'skeleton_attack',
    hurt: 'skeleton_hurt',
    death: 'skeleton_death'
  },
  [VillainType.GHOST]: {
    spawn: 'ghost_spawn',
    attack: 'ghost_attack',
    hurt: 'ghost_hurt',
    death: 'ghost_death'
  }
};
