"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import {
    PLAYER_SPEED,
    PLAYER_SENSITIVITY,
    GROUND_SIZE,
    PLAYER_JUMP_FORCE,
    GRAVITY,
    PLAYER_RUN_MULTIPLIER,
    PLAYER_NORMAL_HEIGHT,
    PLAYER_CROUCH_HEIGHT,
    PLAYER_CROUCH_SPEED_MULTIPLIER,
    MAX_AIR_JUMPS,
    PLAYER_PUNCH_DAMAGE,
    PLAYER_KICK_DAMAGE,
    GUN1_DAMAGE,
    GUN2_DAMAGE,
    SWORD_DAMAGE,
    POWERUP_COLLECTION_DISTANCE,
    POWERUP_GLOW_INTENSITY,
    PLAYER_MAX_HEALTH,
    INVINCIBILITY_DURATION,
} from '@/config/game-constants';
import { usePlayerHealth } from '@/contexts/player-health-context';
import { VillainManager } from './villain';
import { VillainSpawner } from './villain-spawner';
import { VillainType, VillainState, VILLAIN_STATS } from '@/config/villain-constants';

interface DayNightPhase {
  name: string;
  duration: number;
  ambient: [number, number];
  directional: [number, number];
  background: number;
  fog: number;
}

const dayNightCycleConfig = {
  cycleDuration: 120, // Total cycle in seconds
  phases: [
    { name: 'Day', duration: 0.4, ambient: [0xffffff, 2.8], directional: [0xffffff, 3.5], background: 0x99ddff, fog: 0x99ddff },
    { name: 'Dusk', duration: 0.15, ambient: [0xffccaa, 0.4], directional: [0xffccaa, 0.5], background: 0x504060, fog: 0x504060 },
    { name: 'Night', duration: 0.3, ambient: [0x1a1a2a, 0.05], directional: [0x202030, 0.02], background: 0x050508, fog: 0x050508 },
    { name: 'Dawn', duration: 0.15, ambient: [0xaaccff, 0.3], directional: [0xaaccff, 0.4], background: 0x405070, fog: 0x405070 },
  ] as DayNightPhase[],
};

interface DayNightCycleState {
  currentTime: number;
  currentPhaseDetails: {
    ambientColor: THREE.Color;
    ambientIntensity: number;
    directionalColor: THREE.Color;
    directionalIntensity: number;
    backgroundColor: THREE.Color;
    fogColor: THREE.Color;
  };
}

type PowerUpType = 'gun1' | 'gun2' | 'sword' | 'health' | 'invincibility';
interface WorldPowerUp {
    mesh: THREE.Mesh;
    type: PowerUpType;
    id: string;
    collected: boolean;
}

interface HandheldWeapons {
    sword: THREE.Mesh | null;
    gun1: THREE.Mesh | null;
    gun2: THREE.Mesh | null;
}

const ATTACK_ANIMATION_DURATION = 0.2; // seconds
const COLLISION_EXPANSION_SCALAR = 0.01; // Tiny amount to expand obstacle boxes for collision

function getInterpolatedColor(color1: THREE.Color, color2: THREE.Color, factor: number): THREE.Color {
  return new THREE.Color().lerpColors(color1, color2, factor);
}

function getInterpolatedFloat(val1: number, val2: number, factor: number): number {
  return val1 + (val2 - val1) * factor;
}

const PLAYER_COLLISION_RADIUS = 0.4;

function checkCollisionWithObjects(
    playerObject: THREE.Object3D,
    obstacleMeshes: THREE.Mesh[],
    radius: number,
    playerPhysicsEyeHeight: number
): boolean {
    const playerXZPos = playerObject.position;

    const playerColliderBox = new THREE.Box3(
        new THREE.Vector3(playerXZPos.x - radius, playerObject.position.y - playerPhysicsEyeHeight, playerXZPos.z - radius),
        new THREE.Vector3(playerXZPos.x + radius, playerObject.position.y + 0.1, playerXZPos.z + radius)
    );


    for (const obstacle of obstacleMeshes) {
        if (!obstacle.geometry.boundingBox) {
            obstacle.geometry.computeBoundingBox();
        }
        // It's crucial that boundingBox is not null here.
        // If computeBoundingBox() doesn't create it (e.g., for an empty geometry), this could fail.
        // However, for BoxGeometry and CylinderGeometry, it should be fine.
        const obstacleBox = new THREE.Box3().copy(obstacle.geometry.boundingBox!).applyMatrix4(obstacle.matrixWorld);
        
        const slightlyExpandedObstacleBox = obstacleBox.clone().expandByScalar(COLLISION_EXPANSION_SCALAR);

        if (playerColliderBox.intersectsBox(slightlyExpandedObstacleBox)) {
            return true;
        }
    }
    return false;
}

export default function ArenaDisplay() {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<PointerLockControls | null>(null);

  const moveForward = useRef(false);
  const moveBackward = useRef(false);
  const moveLeft = useRef(false);
  const moveRight = useRef(false);

  const velocity = useRef(new THREE.Vector3());
  const verticalVelocity = useRef(0);
  const onGround = useRef(true);
  const isRunning = useRef(false);
  const isCrouching = useRef(false);
  const jumpsMadeInAirRef = useRef(0);
  const isTorchOnRef = useRef(false);

  const isPunchingRef = useRef(false);
  const isKickingRef = useRef(false);
  const equippedWeaponRef = useRef<Exclude<PowerUpType, 'health' | 'invincibility'> | null>(null);
  const worldPowerUpsRef = useRef<WorldPowerUp[]>([]);
  const whiteSphereRefs = useRef<THREE.Mesh[]>([]);
  const checkpointCountRef = useRef<number>(0);
  const handheldWeaponsRef = useRef<HandheldWeapons>({ sword: null, gun1: null, gun2: null });

  const isAnimatingAttackRef = useRef(false);
  const attackAnimStartTimeRef = useRef(0);

  const { currentHealth, setCurrentHealth, setInvincibilityActive, decreaseHealth } = usePlayerHealth();
  const playerHealthRef = useRef(PLAYER_MAX_HEALTH);
  const isInvincibleRef = useRef(false);
  const invincibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastForcedDamageTimeRef = useRef(0); // Track last time damage was forced

  const direction = useRef(new THREE.Vector3());
  const prevTime = useRef(performance.now());
  const isPaused = useRef(false);

  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const spotLightRef = useRef<THREE.SpotLight | null>(null);
  const spotLightTargetRef = useRef<THREE.Object3D | null>(null);
  const buildingsRef = useRef<THREE.Mesh[]>([]);
  const playerLastSurfaceY = useRef(0);

  const villainManagerRef = useRef<VillainManager | null>(null);
  const villainSpawnerRef = useRef<VillainSpawner | null>(null);
  const lastVillainUpdateRef = useRef<number>(0);

  const [checkpointCount, setCheckpointCount] = useState<number>(0);
  const [dayNightCycle, setDayNightCycle] = useState<DayNightCycleState>(() => {
    const initialPhase = dayNightCycleConfig.phases[0];
    return {
      currentTime: 0,
      currentPhaseDetails: {
        ambientColor: new THREE.Color(initialPhase.ambient[0]),
        ambientIntensity: initialPhase.ambient[1],
        directionalColor: new THREE.Color(initialPhase.directional[0]),
        directionalIntensity: initialPhase.directional[1],
        backgroundColor: new THREE.Color(initialPhase.background),
        fogColor: new THREE.Color(initialPhase.fog),
      },
    };
  });

  const takePlayerDamage = useCallback((amount: number) => {
    if (isInvincibleRef.current) {
        console.log("Player is invincible, no damage taken.");
        return;
    }
    if (!playerHealthRef.current) return; // Should not happen if initialized

    let newHealth = playerHealthRef.current - amount;
    if (newHealth < 0) {
      newHealth = 0;
      // TODO: Implement game over logic
    }
    playerHealthRef.current = newHealth;
    setCurrentHealth(newHealth);
    console.log(`Player took ${amount} damage. Current health: ${playerHealthRef.current}`);
  }, [setCurrentHealth]);

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward.current = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft.current = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward.current = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight.current = true;
        break;
      case 'Space':
        if (!isPaused.current && controlsRef.current?.isLocked) {
          if (onGround.current) {
            verticalVelocity.current = PLAYER_JUMP_FORCE;
            onGround.current = false;
            jumpsMadeInAirRef.current = 0;
          } else if (jumpsMadeInAirRef.current < MAX_AIR_JUMPS) {
            verticalVelocity.current = PLAYER_JUMP_FORCE;
            jumpsMadeInAirRef.current++;
          }
        }
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        isRunning.current = true;
        break;
      case 'ControlLeft':
      case 'KeyC':
         if (!isPaused.current && controlsRef.current?.isLocked) {
            isCrouching.current = !isCrouching.current;
         }
        break;
      case 'KeyF':
        if (!isPaused.current && controlsRef.current?.isLocked && spotLightRef.current) {
            isTorchOnRef.current = !isTorchOnRef.current;
            spotLightRef.current.visible = isTorchOnRef.current;
        }
        break;
      case 'KeyL':
        if (!isPaused.current && controlsRef.current?.isLocked) {
            takePlayerDamage(10);
        }
        break;
      case 'KeyP': {
        isPaused.current = !isPaused.current;
        const pausedMessageEl = document.getElementById('paused-message');
        const instructionsEl = document.getElementById('instructions');
        const blockerEl = document.getElementById('blocker');

        // Update the game-paused DOM element for PlayerStatsDisplay to read
        const gamePausedElement = document.getElementById('game-paused');
        if (gamePausedElement) {
          gamePausedElement.textContent = isPaused.current.toString();
        } else {
          // Create the element if it doesn't exist
          const newElement = document.createElement('div');
          newElement.id = 'game-paused';
          newElement.style.display = 'none'; // Hidden element
          newElement.textContent = isPaused.current.toString();
          document.body.appendChild(newElement);
        }

        if (isPaused.current) {
          if (controlsRef.current?.isLocked) {
            controlsRef.current.unlock();
          }
          if (blockerEl) blockerEl.style.display = 'grid';
          if (pausedMessageEl) pausedMessageEl.style.display = 'block';
          if (instructionsEl) instructionsEl.style.display = 'none';
        } else {
          if (pausedMessageEl) pausedMessageEl.style.display = 'none';
          if (blockerEl) {
            if (controlsRef.current && !controlsRef.current.isLocked) {
              blockerEl.style.display = 'grid';
              if (instructionsEl) instructionsEl.style.display = '';
            } else {
              blockerEl.style.display = 'none';
              if (instructionsEl) instructionsEl.style.display = 'none';
            }
          }
        }
        break;
      }
      case 'KeyE':
        if (controlsRef.current?.isLocked && !isPaused.current && !isAnimatingAttackRef.current) {
          isAnimatingAttackRef.current = true;
          attackAnimStartTimeRef.current = performance.now();
          
          isPunchingRef.current = true;
          setTimeout(() => { isPunchingRef.current = false; }, 100);
          
          if (equippedWeaponRef.current === 'gun1') {
            handlePlayerAttack('gun1');
          } else if (equippedWeaponRef.current === 'gun2') {
            handlePlayerAttack('gun2');
          } else if (equippedWeaponRef.current === 'sword') {
            handlePlayerAttack('sword');
          } else {
            handlePlayerAttack('punch');
          }
          
          // Reset attack animation after duration
          setTimeout(() => {
            isAnimatingAttackRef.current = false;
          }, ATTACK_ANIMATION_DURATION * 1000);
        }
        break;
      case 'KeyR':
        if (controlsRef.current?.isLocked && !isPaused.current && !isAnimatingAttackRef.current) {
          isAnimatingAttackRef.current = true;
          isKickingRef.current = true;
          
          setTimeout(() => { 
            isKickingRef.current = false; 
            isAnimatingAttackRef.current = false; 
          }, 100);
          
          handlePlayerAttack('kick');
        }
        break;
    }
  }, [takePlayerDamage, equippedWeaponRef]);

  const onKeyUp = useCallback((event: KeyboardEvent) => {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        moveForward.current = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        moveLeft.current = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        moveBackward.current = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        moveRight.current = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        isRunning.current = false;
        break;
    }
  }, []);

  // Handle player attack against villains
  const handlePlayerAttack = (attackType: 'punch' | 'kick' | 'gun1' | 'gun2' | 'sword') => {
    if (!villainManagerRef.current || !controlsRef.current || !cameraRef.current) return false;
    
    const player = controlsRef.current.getObject();
    const playerPosition = player.position.clone();
    const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraRef.current.quaternion);
    
    // Get attack range and damage based on attack type
    let attackRange = 2.0; // Default melee range
    let attackDamage = 0;
    
    switch (attackType) {
      case 'punch':
        attackDamage = PLAYER_PUNCH_DAMAGE;
        attackRange = 2.0;
        break;
      case 'kick':
        attackDamage = PLAYER_KICK_DAMAGE;
        attackRange = 2.5;
        break;
      case 'gun1':
        attackDamage = GUN1_DAMAGE;
        attackRange = 20.0;
        break;
      case 'gun2':
        attackDamage = GUN2_DAMAGE;
        attackRange = 25.0;
        break;
      case 'sword':
        attackDamage = SWORD_DAMAGE;
        attackRange = 3.5;
        break;
    }
    
    console.log(`Player Attack: ${attackType} - Damage: ${attackDamage} - Range: ${attackRange}`);
    
    // Check for villains in attack range and direction
    const activeVillains = villainManagerRef.current.getActiveVillains();
    let hitAny = false;
    
    activeVillains.forEach(villain => {
      const directionToVillain = new THREE.Vector3().subVectors(villain.position, playerPosition).normalize();
      const distanceToVillain = playerPosition.distanceTo(villain.position);
      const dotProduct = directionToVillain.dot(cameraDirection);
      
      // Check if villain is in range and in front of player (dot product > 0)
      if (distanceToVillain <= attackRange && dotProduct > 0.7) { // 0.7 is roughly a 45-degree cone
        // Apply damage to villain
        const killed = villainManagerRef.current.damageVillain(villain.id, attackDamage);
        hitAny = true;
        
        console.log(`Hit villain ${villain.id} of type ${villain.type} - Remaining health: ${villain.health} - Killed: ${killed}`);
        
        // Update villain count in UI
        updateVillainCountUI();
      }
    });
    
    return hitAny;
  };
  
  // Update villain count in UI
  const updateVillainCountUI = () => {
    const villainCountElement = document.getElementById('villain-count');
    if (villainCountElement && villainManagerRef.current) {
      const activeCount = villainManagerRef.current.getActiveVillains().length;
      villainCountElement.textContent = activeCount.toString();
    }
  };

  const onMouseDown = useCallback((event: MouseEvent) => {
    if (controlsRef.current?.isLocked && !isPaused.current && !isAnimatingAttackRef.current) {
      isAnimatingAttackRef.current = true;
      attackAnimStartTimeRef.current = performance.now();

      switch (event.button) {
        case 0: // Left mouse button
          isPunchingRef.current = true;
          setTimeout(() => { isPunchingRef.current = false; }, 100);

          if (equippedWeaponRef.current === 'gun1') {
            handlePlayerAttack('gun1');
          } else if (equippedWeaponRef.current === 'gun2') {
            handlePlayerAttack('gun2');
          } else if (equippedWeaponRef.current === 'sword') {
            handlePlayerAttack('sword');
          } else {
            handlePlayerAttack('punch');
          }
          break;
        case 2: // Right mouse button
          isKickingRef.current = true;
          setTimeout(() => isKickingRef.current = false, 100);
          handlePlayerAttack('kick');
          isAnimatingAttackRef.current = false; // Kick animation is simpler for now
          break;
        default:
            isAnimatingAttackRef.current = false;
            break;
      }
    }
  }, []);

  const positionWeaponInHand = (weaponMesh: THREE.Mesh, type: Exclude<PowerUpType, 'health' | 'invincibility'>) => {
    if (!cameraRef.current) return;
    if (type === 'sword') {
        weaponMesh.position.set(0.35, -0.3, -0.5);
        weaponMesh.rotation.set(0, -Math.PI / 2 - 0.2, 0);
    } else if (type === 'gun1' || type === 'gun2') {
        weaponMesh.position.set(0.3, -0.25, -0.4);
        weaponMesh.rotation.set(0, -Math.PI / 2, 0);
    }
  };

  const clickToLockHandler = useCallback(() => {
    const instructionsElement = document.getElementById('instructions');
    const blockerElement = document.getElementById('blocker');
    const pausedMessageElement = document.getElementById('paused-message');

    if (!isPaused.current && controlsRef.current && !controlsRef.current.isLocked) {
        if (rendererRef.current && rendererRef.current.domElement) {
            rendererRef.current.domElement.focus();
        }
        if (typeof controlsRef.current.domElement.requestPointerLock === 'function') {
            controlsRef.current.lock();
        } else {
            console.error('ArenaDisplay: requestPointerLock API is not available or not a function on domElement.');
            // Fallback for environments where pointer lock might fail or isn't desired (e.g. Studio preview)
            if (instructionsElement) instructionsElement.style.display = 'none';
            if (blockerElement) blockerElement.style.display = 'none';
            if (pausedMessageElement) pausedMessageElement.style.display = 'none';
            isPaused.current = false;
        }
    }
}, []);

  const onLockHandler = useCallback(() => {
    const instructionsElement = document.getElementById('instructions');
    const blockerElement = document.getElementById('blocker');
    const pausedMessageElement = document.getElementById('paused-message');

    if (instructionsElement) instructionsElement.style.display = 'none';
    if (blockerElement) blockerElement.style.display = 'none';
    if (pausedMessageElement) pausedMessageElement.style.display = 'none';
    
    // Signal that the game has started for the timer
    const gameStartedElement = document.getElementById('game-started');
    if (gameStartedElement) {
      gameStartedElement.textContent = 'true';
    } else {
      // Create the element if it doesn't exist
      const newElement = document.createElement('div');
      newElement.id = 'game-started';
      newElement.style.display = 'none'; // Hidden element
      newElement.textContent = 'true';
      document.body.appendChild(newElement);
    }
  }, []);

  const onUnlockHandler = useCallback(() => {
    const instructionsElement = document.getElementById('instructions');
    const blockerElement = document.getElementById('blocker');
    const pausedMessageElement = document.getElementById('paused-message');

    if (blockerElement) blockerElement.style.display = 'grid';
    
    // Show paused message when game is paused (ESC pressed)
    if (pausedMessageElement) pausedMessageElement.style.display = 'block';
    if (instructionsElement) instructionsElement.style.display = 'none';
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !mountRef.current) return;

    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.set(0, PLAYER_NORMAL_HEIGHT, 5);
    playerLastSurfaceY.current = 0;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.tabIndex = -1; // Make canvas focusable
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new PointerLockControls(camera, renderer.domElement);
    controls.pointerSpeed = PLAYER_SENSITIVITY / 0.002;
    scene.add(controls.getObject());
    controlsRef.current = controls;

    const instructionsElement = document.getElementById('instructions');
    const blockerElement = document.getElementById('blocker');
    const pausedMessageElement = document.getElementById('paused-message');

    if (blockerElement) {
        blockerElement.addEventListener('click', clickToLockHandler);
    }
    controls.addEventListener('lock', onLockHandler);
    controls.addEventListener('unlock', onUnlockHandler);

    if (pausedMessageElement) pausedMessageElement.style.display = 'none';

    if (currentMount) {
      if (controlsRef.current && !controlsRef.current.isLocked ) {
        if (blockerElement) blockerElement.style.display = 'grid';
        if (instructionsElement) instructionsElement.style.display = '';
        if (isPaused.current) {
             if (pausedMessageElement) pausedMessageElement.style.display = 'block';
             if (instructionsElement) instructionsElement.style.display = 'none';
        }
      } else {
        if (blockerElement) blockerElement.style.display = 'none';
        if (instructionsElement) instructionsElement.style.display = 'none';
        if (pausedMessageElement) pausedMessageElement.style.display = 'none';
        isPaused.current = false;
      }
    }

    ambientLightRef.current = new THREE.AmbientLight();
    scene.add(ambientLightRef.current);

    directionalLightRef.current = new THREE.DirectionalLight();
    directionalLightRef.current.position.set(20, 50, 20);
    directionalLightRef.current.castShadow = true;
    directionalLightRef.current.shadow.mapSize.width = 2048;
    directionalLightRef.current.shadow.mapSize.height = 2048;
    directionalLightRef.current.shadow.camera.near = 0.5;
    directionalLightRef.current.shadow.camera.far = 500;
    directionalLightRef.current.shadow.camera.left = -GROUND_SIZE;
    directionalLightRef.current.shadow.camera.right = GROUND_SIZE;
    directionalLightRef.current.shadow.camera.top = GROUND_SIZE;
    directionalLightRef.current.shadow.camera.bottom = -GROUND_SIZE;
    scene.add(directionalLightRef.current);

    spotLightRef.current = new THREE.SpotLight(0xffffff, 1.5, 70, Math.PI / 7, 0.3, 1.5);
    spotLightRef.current.visible = false;
    spotLightRef.current.position.set(0, 0, 0);
    camera.add(spotLightRef.current);

    spotLightTargetRef.current = new THREE.Object3D();
    spotLightTargetRef.current.position.set(0, 0, -1);
    camera.add(spotLightTargetRef.current);
    spotLightRef.current.target = spotLightTargetRef.current;

    // Add 5 glowing checkpoint spheres at random locations
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const checkpointColor = 0x00ffff; // Cyan - bright blue-green that glows well
    // Create a material that glows in the dark
    const createGlowingMaterial = (color: number) => {
      return new THREE.MeshStandardMaterial({ 
        color: color, 
        roughness: 0.3, 
        metalness: 0.7,
        emissive: color,      // Makes the material emit light
        emissiveIntensity: 0.8 // Controls how strong the emission is
      });
    };
    
    // Clear previous spheres if any
    whiteSphereRefs.current.forEach(sphere => {
      if (sphere.parent) sphere.parent.remove(sphere);
      if (sphere.geometry) sphere.geometry.dispose();
      if (sphere.material) {
        if (Array.isArray(sphere.material)) {
          sphere.material.forEach(m => m.dispose());
        } else {
          (sphere.material as THREE.Material).dispose();
        }
      }
    });
    whiteSphereRefs.current = [];
    
    // Create 5 new spheres with different glowing colors
    for (let i = 0; i < 5; i++) {
      // Generate random positions within the ground area
      // Keep spheres within reasonable bounds and above ground
      const x = (Math.random() - 0.5) * (GROUND_SIZE * 0.8);
      const y = 1 + Math.random() * 3; // Height between 1 and 4 units above ground
      const z = (Math.random() - 0.5) * (GROUND_SIZE * 0.8);
      
      // Use the same color for all checkpoint spheres
      const sphereMaterial = createGlowingMaterial(checkpointColor);
      
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.set(x, y, z);
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      // Add a custom property to identify this as a checkpoint
      sphere.userData = { isCheckpoint: true, id: i, color: checkpointColor };
      scene.add(sphere);
      whiteSphereRefs.current.push(sphere);
    }

    const textureLoader = new THREE.TextureLoader();
    const textureLoadError = (textureName: string) => (event: ErrorEvent | Event) => {
      let errorMessage = `ArenaDisplay: Texture loading failed for '${textureName}'. Attempted path: /textures/${textureName}.`;
      if (event && event instanceof ErrorEvent && event.message) {
        errorMessage += ` Details: ${event.message}`;
      } else if (event && event.target instanceof Image) {
        errorMessage += ` Image load error on target. src: ${(event.target as HTMLImageElement).src}`;
      } else {
        errorMessage += ` An unknown error occurred during texture loading.`;
      }
      console.error(errorMessage, event);
    };

    const groundTexture = textureLoader.load('/textures/ground-texture.jpg', undefined, undefined, textureLoadError('ground-texture.jpg'));
    const roofTexture = textureLoader.load('/textures/roof-texture.jpg', undefined, undefined, textureLoadError('roof-texture.jpg'));
    const wallTexture1 = textureLoader.load('/textures/wall-texture-1.jpg', undefined, undefined, textureLoadError('wall-texture-1.jpg'));
    const wallTexture2 = textureLoader.load('/textures/wall-texture-2.jpg', undefined, undefined, textureLoadError('wall-texture-2.jpg'));
    const wallTexture3 = textureLoader.load('/textures/wall-texture-3.jpg', undefined, undefined, textureLoadError('wall-texture-3.jpg'));

    const allTextures = [groundTexture, roofTexture, wallTexture1, wallTexture2, wallTexture3];
    allTextures.forEach(texture => {
      if (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
      }
    });

    if (groundTexture) groundTexture.repeat.set(GROUND_SIZE / 10, GROUND_SIZE / 10);

    const texturedGroundMaterial = new THREE.MeshStandardMaterial({
      map: groundTexture,
      roughness: 0.9,
      metalness: 0.1
    });

    const placeholderBottomMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9, metalness: 0.1 });

    const makeBuildingFaceMaterials = (wallMap: THREE.Texture | null, roofMap: THREE.Texture | null, sideRoughness: number, sideMetalness: number) => [
      new THREE.MeshStandardMaterial({ map: wallMap, roughness: sideRoughness, metalness: sideMetalness }),
      new THREE.MeshStandardMaterial({ map: wallMap, roughness: sideRoughness, metalness: sideMetalness }),
      new THREE.MeshStandardMaterial({ map: roofMap, roughness: 0.8, metalness: 0.2 }),
      placeholderBottomMaterial,
      new THREE.MeshStandardMaterial({ map: wallMap, roughness: sideRoughness, metalness: sideMetalness }),
      new THREE.MeshStandardMaterial({ map: wallMap, roughness: sideRoughness, metalness: sideMetalness })
    ];

    const residentialMaterials = makeBuildingFaceMaterials(wallTexture1, roofTexture, 0.8, 0.2);
    const commercialMaterials = makeBuildingFaceMaterials(wallTexture2, roofTexture, 0.6, 0.4);
    const industrialMaterials = makeBuildingFaceMaterials(wallTexture3, roofTexture, 0.9, 0.6);
    const downtownMaterials = makeBuildingFaceMaterials(wallTexture2, roofTexture, 0.4, 0.7);

    const smokestackMaterial = new THREE.MeshStandardMaterial({ map: wallTexture3, roughness: 0.9, metalness: 0.6 });

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), texturedGroundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    // buildingsRef.current.push(ground); // Don't add ground to building obstacles for collision

    const wallHeight = GROUND_SIZE ;
    const wallThickness = 10;
    const boundaryWallMaterial = new THREE.MeshStandardMaterial({ color: 0x1A1A1D, roughness: 0.95, metalness: 0.1 });

    const wallN = new THREE.Mesh(new THREE.BoxGeometry(GROUND_SIZE + wallThickness * 2, wallHeight, wallThickness), boundaryWallMaterial);
    wallN.position.set(0, wallHeight/2, -GROUND_SIZE/2 - wallThickness/2);
    wallN.castShadow = true; wallN.receiveShadow = true; scene.add(wallN); buildingsRef.current.push(wallN);

    const wallS = new THREE.Mesh(new THREE.BoxGeometry(GROUND_SIZE + wallThickness * 2, wallHeight, wallThickness), boundaryWallMaterial);
    wallS.position.set(0, wallHeight/2, GROUND_SIZE/2 + wallThickness/2);
    wallS.castShadow = true; wallS.receiveShadow = true; scene.add(wallS); buildingsRef.current.push(wallS);

    const wallE = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, GROUND_SIZE), boundaryWallMaterial);
    wallE.position.set(GROUND_SIZE/2 + wallThickness/2, wallHeight/2, 0);
    wallE.castShadow = true; wallE.receiveShadow = true; scene.add(wallE); buildingsRef.current.push(wallE);

    const wallW = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, GROUND_SIZE), boundaryWallMaterial);
    wallW.position.set(-GROUND_SIZE/2 - wallThickness/2, wallHeight/2, 0);
    wallW.castShadow = true; wallW.receiveShadow = true; scene.add(wallW); buildingsRef.current.push(wallW);

    const addBuilding = (geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], x: number, yBase: number, z: number) => {
      const buildingHeightParam = (geometry.parameters as any).height;
      const building = new THREE.Mesh(geometry, materials);
      building.position.set(x, yBase + buildingHeightParam / 2, z);
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);
      buildingsRef.current.push(building);
    };

    const obstacleMaterials = [residentialMaterials, commercialMaterials, industrialMaterials, downtownMaterials];
    const numBaseBuildings = 60; // Increased building count
    for (let i = 0; i < numBaseBuildings; i++) {
        const sizeX = THREE.MathUtils.randFloat(2, 8); // Slightly larger range
        const sizeY = THREE.MathUtils.randFloat(1.5, 12); // Taller buildings possible
        const sizeZ = THREE.MathUtils.randFloat(2, 8);
        const posX = (Math.random() - 0.5) * (GROUND_SIZE - sizeX - 4);
        const posZ = (Math.random() - 0.5) * (GROUND_SIZE - sizeZ - 4);
        const matIndex = Math.floor(Math.random() * obstacleMaterials.length);
        addBuilding(new THREE.BoxGeometry(sizeX, sizeY, sizeZ), obstacleMaterials[matIndex], posX, 0, posZ);
    }
     // Add more smaller obstacles too
    for (let i = 0; i < numBaseBuildings / 2; i++) {
        const size = THREE.MathUtils.randFloat(0.5, 1.5);
        const posY = 0; // On the ground
        const posX = (Math.random() - 0.5) * (GROUND_SIZE - size - 2);
        const posZ = (Math.random() - 0.5) * (GROUND_SIZE - size - 2);
        addBuilding(new THREE.BoxGeometry(size, size, size), obstacleMaterials[Math.floor(Math.random() * 2)], posX, posY, posZ);
    }
    addBuilding(new THREE.CylinderGeometry(0.7, 0.7, 15, 16), smokestackMaterial, (Math.random() - 0.5) * GROUND_SIZE * 0.6, 0, (Math.random() - 0.5) * GROUND_SIZE * 0.6);
    addBuilding(new THREE.BoxGeometry(8, 30, 8), downtownMaterials, (Math.random() - 0.5) * GROUND_SIZE * 0.3, 0, (Math.random() - 0.5) * GROUND_SIZE * 0.3);

    villainManagerRef.current = new VillainManager(scene);

    villainSpawnerRef.current = new VillainSpawner(villainManagerRef.current);

    const swordHandGeo = new THREE.BoxGeometry(0.1, 1.0, 0.05);
    const swordHandMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.3, metalness: 0.8 });
    handheldWeaponsRef.current.sword = new THREE.Mesh(swordHandGeo, swordHandMat);
    handheldWeaponsRef.current.sword.visible = false;

    const gunHandGeo = new THREE.BoxGeometry(0.15, 0.15, 0.3);
    const gun1HandMat = new THREE.MeshStandardMaterial({ color: 0x3333ff, roughness: 0.5, metalness: 0.5 });
    handheldWeaponsRef.current.gun1 = new THREE.Mesh(gunHandGeo, gun1HandMat);
    handheldWeaponsRef.current.gun1.visible = false;

    const gun2HandMat = new THREE.MeshStandardMaterial({ color: 0x33ff33, roughness: 0.5, metalness: 0.5 });
    handheldWeaponsRef.current.gun2 = new THREE.Mesh(gunHandGeo, gun2HandMat);
    handheldWeaponsRef.current.gun2.visible = false;

    const powerUpY = 0.5;
    const powerUpDefinitions: { type: PowerUpType; color: number; size: [number, number, number] }[] = [
        { type: 'gun1', color: 0x0000ff, size: [0.5, 0.5, 0.5] },
        { type: 'gun2', color: 0x00ff00, size: [0.5, 0.5, 0.5] },
        { type: 'sword', color: 0x808080, size: [0.2, 1.5, 0.2] },
        { type: 'health', color: 0xff00ff, size: [0.6, 0.6, 0.6] },
        { type: 'invincibility', color: 0xffff00, size: [0.7, 0.7, 0.7] },
    ];

    const numPowerUps = powerUpDefinitions.length;
    const zoneWidth = GROUND_SIZE / numPowerUps; // Approximate width per zone
    const halfGround = GROUND_SIZE / 2;
    worldPowerUpsRef.current = [];

    // Distribute power-ups more evenly
    powerUpDefinitions.forEach((def, index) => {
        // Assign to zones to spread them out, can overlap a bit
        const zoneStartX = -halfGround + index * zoneWidth;
        const zoneEndX = zoneStartX + zoneWidth;

        const x = THREE.MathUtils.randFloat(zoneStartX + 2, zoneEndX - 2); // +2, -2 for some padding from zone edges
        const z = THREE.MathUtils.randFloat(-halfGround + 2, halfGround - 2); // +2, -2 for padding from map edges

        const geometry = new THREE.BoxGeometry(...def.size as [number, number, number]);
        const material = new THREE.MeshStandardMaterial({
            color: def.color,
            roughness: 0.5,
            metalness: 0.5,
            emissive: def.color, // Make power-ups glow
            emissiveIntensity: POWERUP_GLOW_INTENSITY
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, powerUpY + def.size[1] / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        worldPowerUpsRef.current.push({ mesh, type: def.type, id: `powerup-${def.type}-${index}`, collected: false });
    });

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);

    const handleResize = () => {
      if (cameraRef.current && rendererRef.current && mountRef.current) {
        cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    let animationFrameId: number;
    // Function to check for checkpoint collection
    const checkCheckpointCollection = () => {
      if (!cameraRef.current) return;
      
      const playerPosition = cameraRef.current.position.clone();
      const CHECKPOINT_COLLECTION_DISTANCE = 2; // Distance at which checkpoints are collected
      
      whiteSphereRefs.current.forEach((sphere, index) => {
        if (sphere.visible) { // Only check visible (uncollected) spheres
          const distance = playerPosition.distanceTo(sphere.position);
          
          if (distance < CHECKPOINT_COLLECTION_DISTANCE) {
            // Player has collected this checkpoint
            sphere.visible = false; // Hide the sphere
            
            // Increment checkpoint counter
            const newCount = checkpointCountRef.current + 1;
            checkpointCountRef.current = newCount;
            setCheckpointCount(newCount);
            
            // Update DOM element for PlayerStatsDisplay to read
            const checkpointCountElement = document.getElementById('checkpoint-count');
            if (checkpointCountElement) {
              checkpointCountElement.textContent = newCount.toString();
            } else {
              // Create the element if it doesn't exist
              const newElement = document.createElement('div');
              newElement.id = 'checkpoint-count';
              newElement.style.display = 'none'; // Hidden element
              newElement.textContent = newCount.toString();
              document.body.appendChild(newElement);
            }
            
            console.log(`Checkpoint ${index + 1} collected! Total: ${newCount}/5`);
          }
        }
      });
    };

    // Function to check if game is over
    const checkGameOver = () => {
      const gameOverElement = document.getElementById('game-over');
      return gameOverElement ? gameOverElement.textContent === 'won' || gameOverElement.textContent === 'lost' : false;
    };
    
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = performance.now();
      const delta = (time - prevTime.current) / 1000;
      
      // Check for game over state
      const isGameOver = checkGameOver();
      if (isGameOver && !isPaused.current) {
        // Pause the game when game over is detected
        isPaused.current = true;
        if (controlsRef.current?.isLocked) {
          controlsRef.current.unlock();
        }
      }

      if (isPaused.current || !controlsRef.current || !cameraRef.current) {
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
        prevTime.current = time - delta * 1000; // Adjust prevTime to avoid large jump on resume
        return;
      }

      const player = controlsRef.current.getObject();
      const physicsEyeOffset = isCrouching.current ? PLAYER_CROUCH_HEIGHT : PLAYER_NORMAL_HEIGHT;
      let visualEyeOffset = physicsEyeOffset;

      if (isPunchingRef.current || isKickingRef.current || (isAnimatingAttackRef.current && equippedWeaponRef.current)) {
        visualEyeOffset -= 0.05; // Camera dip for attacks
      }

      // Ground and surface interaction logic
      if (onGround.current) {
        player.position.y = playerLastSurfaceY.current + visualEyeOffset;
        verticalVelocity.current = 0;

        // Check if still on the same surface or need to fall
        let currentlyOverSupport = false;
        const playerCurrentFeetYForCheck = player.position.y - visualEyeOffset; // Recalculate based on potentially dipped visual offset

        if (Math.abs(playerCurrentFeetYForCheck - playerLastSurfaceY.current) < 0.01) { // Close enough to last known surface
             if (playerLastSurfaceY.current === 0) { // Was on main ground
                if (player.position.x >= -GROUND_SIZE/2 && player.position.x <= GROUND_SIZE/2 &&
                    player.position.z >= -GROUND_SIZE/2 && player.position.z <= GROUND_SIZE/2) {
                    currentlyOverSupport = true;
                }
             } else { // Was on a building
                for (const building of buildingsRef.current) {
                    if (!building.geometry.parameters || building === ground) continue;
                    const geomParams = building.geometry.parameters as any;
                    const buildingHeight = geomParams.height;
                    const buildingBaseY = building.position.y - buildingHeight / 2;
                    const buildingTopActualY = buildingBaseY + buildingHeight;

                    if (Math.abs(buildingTopActualY - playerLastSurfaceY.current) < 0.01) { // Is it the same building top?
                        const halfWidth = geomParams.width ? geomParams.width / 2 : (geomParams.radiusTop || geomParams.radiusBottom || 0);
                        const halfDepth = geomParams.depth ? geomParams.depth / 2 : (geomParams.radiusTop || geomParams.radiusBottom || 0);
                        if (player.position.x >= building.position.x - halfWidth && player.position.x <= building.position.x + halfWidth &&
                            player.position.z >= building.position.z - halfDepth && player.position.z <= building.position.z + halfDepth) {
                            currentlyOverSupport = true;
                            break;
                        }
                    }
                }
             }
        }

        // If not over the *last* surface, check if we've landed on a *new* one or the main ground
        if (!currentlyOverSupport) {
            // Check main ground first
            if (Math.abs(playerCurrentFeetYForCheck - 0) < 0.01 && // Check if feet are near ground level
                player.position.x >= -GROUND_SIZE/2 && player.position.x <= GROUND_SIZE/2 &&
                player.position.z >= -GROUND_SIZE/2 && player.position.z <= GROUND_SIZE/2) {
                currentlyOverSupport = true;
                if (playerLastSurfaceY.current !== 0) playerLastSurfaceY.current = 0; // Update last surface
            } else { // Check buildings
                for (const building of buildingsRef.current) {
                    if (!building.geometry.parameters || building === ground) continue;
                    const geomParams = building.geometry.parameters as any;
                    const buildingHeight = geomParams.height;
                    const buildingBaseY = building.position.y - buildingHeight / 2;
                    const buildingTopActualY = buildingBaseY + buildingHeight;

                    const halfWidth = geomParams.width ? geomParams.width / 2 : (geomParams.radiusTop || geomParams.radiusBottom || 0);
                    const halfDepth = geomParams.depth ? geomParams.depth / 2 : (geomParams.radiusTop || geomParams.radiusBottom || 0);

                    if (
                        player.position.x >= building.position.x - halfWidth && player.position.x <= building.position.x + halfWidth &&
                        player.position.z >= building.position.z - halfDepth && player.position.z <= building.position.z + halfDepth &&
                        Math.abs(playerCurrentFeetYForCheck - buildingTopActualY) < 0.05 // Feet are near this building's top
                    ) {
                        currentlyOverSupport = true;
                        if (playerLastSurfaceY.current !== buildingTopActualY) playerLastSurfaceY.current = buildingTopActualY; // Update last surface
                        break;
                    }
                }
            }
        }

        if (!currentlyOverSupport) { // Truly in the air
            onGround.current = false;
            jumpsMadeInAirRef.current = 0; // Allow first air jump if falling off edge
        } else {
            // Force Y position to be stable if on ground/surface
            player.position.y = playerLastSurfaceY.current + visualEyeOffset;
        }
      }

      // Apply gravity and check for landing if not on ground
      if (!onGround.current) {
        const previousPlayerY = player.position.y;
        verticalVelocity.current -= GRAVITY * delta;
        player.position.y += verticalVelocity.current * delta;

        let landedOnObject = false;
        if (verticalVelocity.current <= 0) { // Only check for landing if moving downwards
          // Check landing on buildings
          for (const building of buildingsRef.current) {
            if (!building.geometry.parameters || building === ground) continue; // Skip ground, handled separately
            const geomParams = building.geometry.parameters as any;
            const buildingHeightParam = geomParams.height;
            const buildingBaseY = building.position.y - buildingHeightParam / 2;
            const buildingTopActualY = buildingBaseY + buildingHeightParam;

            const playerCurrentFeetY = player.position.y - physicsEyeOffset; // Physics height for landing check
            const playerPreviousFeetY = previousPlayerY - physicsEyeOffset;

            if (
              player.position.x >= building.position.x - geomParams.width / 2 && player.position.x <= building.position.x + geomParams.width / 2 &&
              player.position.z >= building.position.z - geomParams.depth / 2 && player.position.z <= building.position.z + geomParams.depth / 2 &&
              playerPreviousFeetY >= buildingTopActualY - 0.01 && // Was above or at top in previous frame
              playerCurrentFeetY <= buildingTopActualY + 0.05 // Is at or just below top in current frame
            ) {
              player.position.y = buildingTopActualY + visualEyeOffset; // Place eyes correctly
              verticalVelocity.current = 0;
              onGround.current = true;
              jumpsMadeInAirRef.current = 0;
              landedOnObject = true;
              playerLastSurfaceY.current = buildingTopActualY; // Update last known surface
              break;
            }
          }

          // Check landing on main ground if not landed on an object
          const mainGroundTargetYVisual = visualEyeOffset; // Target eye Y for main ground
          if (!landedOnObject && player.position.y <= mainGroundTargetYVisual ) {
             const currentFeetY = player.position.y - visualEyeOffset; // Use visual for this final check
             const previousFeetY = previousPlayerY - visualEyeOffset;

             if (previousFeetY >= 0 && currentFeetY <= 0 + 0.05) { // Crossed the ground plane
                player.position.y = mainGroundTargetYVisual;
                verticalVelocity.current = 0;
                onGround.current = true;
                jumpsMadeInAirRef.current = 0;
                playerLastSurfaceY.current = 0; // Update last known surface
             } else if (player.position.y < mainGroundTargetYVisual) { // If somehow fell through, snap back
                player.position.y = mainGroundTargetYVisual;
                verticalVelocity.current = 0;
                onGround.current = true;
                jumpsMadeInAirRef.current = 0;
                playerLastSurfaceY.current = 0;
             }
          }
        }
      }

      // Horizontal movement and collision
      if (controlsRef.current.isLocked === true) {
        velocity.current.x -= velocity.current.x * 10.0 * delta; // Apply damping
        velocity.current.z -= velocity.current.z * 10.0 * delta;

        direction.current.z = Number(moveForward.current) - Number(moveBackward.current);
        direction.current.x = Number(moveRight.current) - Number(moveLeft.current);
        direction.current.normalize(); // Ensure consistent speed in all directions

        let currentMoveSpeed = PLAYER_SPEED;
        if (isRunning.current && !isCrouching.current && onGround.current) { // Can only run if standing and on ground
            currentMoveSpeed *= PLAYER_RUN_MULTIPLIER;
        } else if (isCrouching.current && onGround.current) { // Can only crouch if on ground
            currentMoveSpeed *= PLAYER_CROUCH_SPEED_MULTIPLIER;
        }

        if (moveForward.current || moveBackward.current) velocity.current.z -= direction.current.z * currentMoveSpeed * 10.0 * delta;
        if (moveLeft.current || moveRight.current) velocity.current.x -= direction.current.x * currentMoveSpeed * 10.0 * delta;

        const originalPlayerPosition = player.position.clone();
        const playerEyeHeightForCollision = physicsEyeOffset; // Use physics height for collision checks

        // Strafe movement (local X)
        const strafeAmount = -velocity.current.x * delta;
        if (Math.abs(strafeAmount) > 0.0001) { // Only move if there's significant velocity
            controlsRef.current.moveRight(strafeAmount);
            if (checkCollisionWithObjects(player, buildingsRef.current, PLAYER_COLLISION_RADIUS, playerEyeHeightForCollision)) {
                player.position.x = originalPlayerPosition.x; // Revert world X
                // player.position.z = originalPlayerPosition.z; // Revert world Z as moveRight can affect it
            }
        }
        const positionAfterStrafe = player.position.clone(); // Position after attempting X-axis move (and potential revert)

        // Forward/Backward movement (local Z)
        const forwardAmount = -velocity.current.z * delta;
        if (Math.abs(forwardAmount) > 0.0001) { // Only move if there's significant velocity
            controlsRef.current.moveForward(forwardAmount);
            if (checkCollisionWithObjects(player, buildingsRef.current, PLAYER_COLLISION_RADIUS, playerEyeHeightForCollision)) {
                player.position.z = positionAfterStrafe.z; // Revert world Z to state before this Z move
                // player.position.x = positionAfterStrafe.x; // Revert world X to state before this Z move
            }
        }

        // Clamp player position to stay within ground boundaries (prevents falling off map edges)
        const halfGroundMinusRadius = GROUND_SIZE / 2 - PLAYER_COLLISION_RADIUS;
        player.position.x = Math.max(-halfGroundMinusRadius, Math.min(halfGroundMinusRadius, player.position.x));
        player.position.z = Math.max(-halfGroundMinusRadius, Math.min(halfGroundMinusRadius, player.position.z));

        // Villain management
        if (villainManagerRef.current && villainSpawnerRef.current && controlsRef.current) {
          const playerPosition = player.position.clone();
          
          // Update villain spawner
          villainSpawnerRef.current.update(
            playerPosition,
            'day', // Default to day since name property doesn't exist in currentPhaseDetails
            delta
          );
          
          // Update all active villains
          const activeVillains = villainManagerRef.current.getActiveVillains();
          activeVillains.forEach(villain => {
            // Update villain state based on player position
            if (villainManagerRef.current) {
              villainManagerRef.current.updateVillainState(villain, playerPosition, delta);
              
              // Move villain based on its state
              villainManagerRef.current.moveVillain(villain, delta);
            }
          });
          
          // DIRECT VILLAIN ATTACK SYSTEM - Completely overhauled
          if (villainManagerRef.current) {
            // Log active villains for debugging
            const activeVillains = villainManagerRef.current.getActiveVillains();
            console.log(`%c ACTIVE VILLAINS: ${activeVillains.length}`, 'background: blue; color: white;');
            
            // Force damage with a longer interval to make the game more balanced
            // This ensures the player takes damage even if collision detection fails
            const now = performance.now();
            const forceDamageInterval = 5000; // Force damage every 5 seconds if villains are nearby
            
            if (now - lastForcedDamageTimeRef.current > forceDamageInterval && activeVillains.length > 0) {
              // Find the closest villain
              let closestVillain: Villain | null = null;
              let closestDistance = Infinity;
              
              activeVillains.forEach(villain => {
                const distanceToVillain = playerPosition.distanceTo(villain.position);
                if (distanceToVillain < closestDistance) {
                  closestDistance = distanceToVillain;
                  closestVillain = villain;
                }
              });
              
              // If any villain is within attack range, force damage
              if (closestVillain && closestDistance < 5) { // Increased attack range to 5 units
                console.log(`%c FORCED DAMAGE CHECK: Closest villain at ${closestDistance.toFixed(2)} units`, 'background: orange; color: black;');
                
                // Apply damage if not invincible
                if (!isInvincibleRef.current) {
                  // Get damage from villain - use safe type access with reduced damage
                  const villainType = closestVillain.type as VillainType;
                  const stats = VILLAIN_STATS[villainType];
                  const baseDamage = stats.damage;
                  // Reduce damage to make it more balanced - only 30% of the original damage
                  const damage = Math.round(baseDamage * 0.3);
                  
                  // CRITICAL: Update health in all places
                  // 1. Local ref
                  playerHealthRef.current = Math.max(0, playerHealthRef.current - damage);
                  // 2. Local state
                  setCurrentHealth(playerHealthRef.current);
                  // 3. Context state via decreaseHealth function
                  decreaseHealth(damage);
                  
                  // Update last forced damage time
                  lastForcedDamageTimeRef.current = now;
                  
                  // Visual feedback - flash the screen red
                  const overlay = document.createElement('div');
                  overlay.style.position = 'absolute';
                  overlay.style.top = '0';
                  overlay.style.left = '0';
                  overlay.style.width = '100%';
                  overlay.style.height = '100%';
                  overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.7)'; // More visible red
                  overlay.style.pointerEvents = 'none';
                  overlay.style.zIndex = '1000';
                  document.body.appendChild(overlay);
                  
                  // Remove the overlay after a short time
                  setTimeout(() => {
                    if (overlay.parentNode) {
                      document.body.removeChild(overlay);
                    }
                  }, 300);
                  
                  // Log the attack with very clear message
                  console.log(`%c VILLAIN ATTACK! Damage: ${damage}, Player health now: ${playerHealthRef.current}`, 'background: red; color: white; font-size: 20px');
                  
                  // Play attack animation on the villain
                  if (closestVillain.mesh.material) {
                    const originalMaterial = closestVillain.mesh.material as THREE.MeshStandardMaterial;
                    const originalColor = originalMaterial.color.clone();
                    
                    // Flash bright yellow for attack
                    originalMaterial.color.set(0xffff00);
                    originalMaterial.emissive = new THREE.Color(0xffff00);
                    originalMaterial.emissiveIntensity = 0.8;
                    
                    // Return to original color after a short time
                    setTimeout(() => {
                      if (closestVillain.mesh && closestVillain.mesh.material) {
                        (closestVillain.mesh.material as THREE.MeshStandardMaterial).color.copy(originalColor);
                        (closestVillain.mesh.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x000000);
                        (closestVillain.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
                      }
                    }, 300);
                  }
                  
                  // Update villain state
                  closestVillain.state = VillainState.ATTACKING;
                  closestVillain.lastStateChangeTime = now;
                  closestVillain.lastAttackTime = now;
                }
              }
            }
            
            // Also keep the regular collision detection system as a backup
            const collidingVillains = villainManagerRef.current.checkPlayerVillainCollisions(
              playerPosition,
              PLAYER_COLLISION_RADIUS * 2 // Double the collision radius
            );
            
            if (collidingVillains.length > 0) {
              console.log(`%c COLLIDING VILLAINS: ${collidingVillains.length}`, 'background: purple; color: white;');
            }
          }
        }

        // Power-up collection logic
        const playerPos = player.position;
        for (let i = worldPowerUpsRef.current.length - 1; i >= 0; i--) {
            const powerUp = worldPowerUpsRef.current[i];
            if (!powerUp.collected && powerUp.mesh.parent === sceneRef.current) { // Check if mesh is still in scene
                const distanceToPowerUp = playerPos.distanceTo(powerUp.mesh.position);
                if (distanceToPowerUp < POWERUP_COLLECTION_DISTANCE) {
                    console.log(`Collected ${powerUp.type}`);
                    powerUp.collected = true;
                    if (sceneRef.current && powerUp.mesh.parent) sceneRef.current.remove(powerUp.mesh); // Remove from scene

                    if (powerUp.type === 'health') {
                        setCurrentHealth(PLAYER_MAX_HEALTH);
                        playerHealthRef.current = PLAYER_MAX_HEALTH;
                        console.log("Player health restored to maximum!");
                    } else if (powerUp.type === 'invincibility') {
                        isInvincibleRef.current = true;
                        setInvincibilityActive(INVINCIBILITY_DURATION); // Notify context
                        console.log(`Player is INVINCIBLE for ${INVINCIBILITY_DURATION} seconds!`);
                        if (invincibilityTimeoutRef.current) {
                            clearTimeout(invincibilityTimeoutRef.current);
                        }
                        invincibilityTimeoutRef.current = setTimeout(() => {
                            isInvincibleRef.current = false;
                            console.log("Invincibility WORE OFF!");
                        }, INVINCIBILITY_DURATION * 1000);
                    } else { // Weapon power-up
                        // Unequip previous weapon from hand
                        if (equippedWeaponRef.current && handheldWeaponsRef.current[equippedWeaponRef.current]) {
                            const oldWeaponMesh = handheldWeaponsRef.current[equippedWeaponRef.current];
                            if (oldWeaponMesh && oldWeaponMesh.parent === cameraRef.current) {
                                cameraRef.current?.remove(oldWeaponMesh);
                                oldWeaponMesh.visible = false;
                            }
                        }

                        equippedWeaponRef.current = powerUp.type as Exclude<PowerUpType, 'health' | 'invincibility'>;
                        const newWeaponMesh = handheldWeaponsRef.current[powerUp.type as Exclude<PowerUpType, 'health' | 'invincibility'>];
                        if (newWeaponMesh && cameraRef.current) {
                            cameraRef.current.add(newWeaponMesh);
                            newWeaponMesh.visible = true;
                            positionWeaponInHand(newWeaponMesh, powerUp.type as Exclude<PowerUpType, 'health' | 'invincibility'>);
                        }
                    }
                    // No need to break, allow collecting multiple if overlapping (though unlikely)
                }
            }
        }

        // Attack animation logic
        if (isAnimatingAttackRef.current) {
            const currentTime = performance.now();
            const animProgress = (currentTime - attackAnimStartTimeRef.current) / (ATTACK_ANIMATION_DURATION * 1000);

            const currentEquippedWeaponType = equippedWeaponRef.current;
            const weaponMesh = currentEquippedWeaponType
                ? handheldWeaponsRef.current[currentEquippedWeaponType]
                : null;

            if (weaponMesh && weaponMesh.visible) {
                if (animProgress < 1) {
                    if (currentEquippedWeaponType === 'sword') {
                        const swingAngle = Math.sin(animProgress * Math.PI) * (Math.PI / 3); // Example swing
                        weaponMesh.rotation.z = swingAngle; // Animate around Z axis of weapon
                    } else if (currentEquippedWeaponType === 'gun1' || currentEquippedWeaponType === 'gun2') {
                        const recoilAmount = Math.sin(animProgress * Math.PI) * 0.1; // Example recoil
                        weaponMesh.position.z = -0.4 - recoilAmount; // Move weapon back along its local Z
                    }
                } else {
                    isAnimatingAttackRef.current = false;
                    // Reset weapon position/rotation after animation
                    if (currentEquippedWeaponType && weaponMesh) {
                         positionWeaponInHand(weaponMesh, currentEquippedWeaponType); // Ensure it returns to default hand position
                    }
                }
            } else { // No weapon equipped or weapon not visible (shouldn't happen if logic is correct)
                 if (animProgress >= 1) isAnimatingAttackRef.current = false;
                 // If it was a punch (no weapon mesh), animation ends when isPunchingRef becomes false
            }
        } else if (isPunchingRef.current && !equippedWeaponRef.current){ // Punching (no weapon)
            // The camera dip handles the "animation" for punch
            // isPunchingRef becomes false after 100ms timeout set in onMouseDown
        }
      }
      // Check for checkpoint collection
      checkCheckpointCollection();
      
      prevTime.current = time;
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const cycleIntervalId = setInterval(() => {
      if (isPaused.current) return;
      setDayNightCycle(prev => {
        const newTime = (prev.currentTime + 1) % dayNightCycleConfig.cycleDuration;
        let accumulatedDuration = 0;
        let currentPhaseIndex = 0;
        let nextPhaseIndex = 0;
        let segmentProgress = 0;

        for (let i = 0; i < dayNightCycleConfig.phases.length; i++) {
          const phase = dayNightCycleConfig.phases[i];
          const phaseActualDuration = phase.duration * dayNightCycleConfig.cycleDuration;
          if (newTime < accumulatedDuration + phaseActualDuration) {
            currentPhaseIndex = i;
            nextPhaseIndex = (i + 1) % dayNightCycleConfig.phases.length;
            segmentProgress = (newTime - accumulatedDuration) / phaseActualDuration;
            break;
          }
          accumulatedDuration += phaseActualDuration;
        }
        // Clamp segmentProgress to avoid issues with floating point arithmetic at boundaries
        segmentProgress = Math.max(0, Math.min(1, segmentProgress));

        const currentPhase = dayNightCycleConfig.phases[currentPhaseIndex];
        const nextPhase = dayNightCycleConfig.phases[nextPhaseIndex];

        const newDetails = {
          ambientColor: getInterpolatedColor(new THREE.Color(currentPhase.ambient[0]), new THREE.Color(nextPhase.ambient[0]), segmentProgress),
          ambientIntensity: getInterpolatedFloat(currentPhase.ambient[1], nextPhase.ambient[1], segmentProgress),
          directionalColor: getInterpolatedColor(new THREE.Color(currentPhase.directional[0]), new THREE.Color(nextPhase.directional[0]), segmentProgress),
          directionalIntensity: getInterpolatedFloat(currentPhase.directional[1], nextPhase.directional[1], segmentProgress),
          backgroundColor: getInterpolatedColor(new THREE.Color(currentPhase.background), new THREE.Color(nextPhase.background), segmentProgress),
          fogColor: getInterpolatedColor(new THREE.Color(currentPhase.fog), new THREE.Color(nextPhase.fog), segmentProgress),
        };
        return { currentTime: newTime, currentPhaseDetails: newDetails };
      });
    }, 1000);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(cycleIntervalId);
      if (invincibilityTimeoutRef.current) {
        clearTimeout(invincibilityTimeoutRef.current);
      }
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousedown', onMouseDown);

      const currentBlocker = document.getElementById('blocker');
      if (currentBlocker) {
        currentBlocker.removeEventListener('click', clickToLockHandler);
      }

      if (controlsRef.current) {
        controlsRef.current.removeEventListener('lock', onLockHandler);
        controlsRef.current.removeEventListener('unlock', onUnlockHandler);
        if (controlsRef.current.isLocked) {
          controlsRef.current.unlock();
        }
        controlsRef.current.dispose();
      }

      if (spotLightRef.current) {
        if(spotLightRef.current.shadow && spotLightRef.current.shadow.map) {
            spotLightRef.current.shadow.map.dispose();
        }
      }

      allTextures.forEach(texture => { if (texture) texture.dispose(); });
      placeholderBottomMaterial.dispose();
      residentialMaterials.forEach(material => material.dispose());
      commercialMaterials.forEach(material => material.dispose());
      industrialMaterials.forEach(material => material.dispose());
      downtownMaterials.forEach(material => material.dispose());
      smokestackMaterial.dispose();
      boundaryWallMaterial.dispose();
      texturedGroundMaterial.dispose();

      Object.values(handheldWeaponsRef.current).forEach(weaponMesh => {
        if (weaponMesh) {
            if (weaponMesh.geometry) weaponMesh.geometry.dispose();
            if (weaponMesh.material) {
                if (Array.isArray(weaponMesh.material)) weaponMesh.material.forEach(m => m.dispose());
                else (weaponMesh.material as THREE.Material).dispose();
            }
            if (cameraRef.current && weaponMesh.parent === cameraRef.current) cameraRef.current.remove(weaponMesh);
        }
      });

      worldPowerUpsRef.current.forEach(powerUp => {
        if(powerUp.mesh.parent && sceneRef.current) sceneRef.current.remove(powerUp.mesh); // Ensure removed from scene
        if (powerUp.mesh.geometry) powerUp.mesh.geometry.dispose();
        if (powerUp.mesh.material) {
            if (Array.isArray(powerUp.mesh.material)) {
                powerUp.mesh.material.forEach(m => m.dispose());
            } else {
                (powerUp.mesh.material as THREE.Material).dispose();
            }
        }
      });
      worldPowerUpsRef.current = [];
      
      // Clean up white spheres
      whiteSphereRefs.current.forEach(sphere => {
        if(sphere.parent && sceneRef.current) sceneRef.current.remove(sphere);
        if (sphere.geometry) sphere.geometry.dispose();
        if (sphere.material) {
          if (Array.isArray(sphere.material)) {
            sphere.material.forEach(m => m.dispose());
          } else {
            (sphere.material as THREE.Material).dispose();
          }
        }
      });
      whiteSphereRefs.current = [];

      // Clean up white spheres
      whiteSphereRefs.current.forEach(sphere => {
        if(sphere.parent && sceneRef.current) sceneRef.current.remove(sphere);
        if (sphere.geometry) sphere.geometry.dispose();
        if (sphere.material) {
          if (Array.isArray(sphere.material)) {
            sphere.material.forEach(m => m.dispose());
          } else {
            (sphere.material as THREE.Material).dispose();
          }
        }
      });
      whiteSphereRefs.current = [];

      if (rendererRef.current) {
         rendererRef.current.dispose();
         if (sceneRef.current) {
             sceneRef.current.traverse(object => {
                if (object instanceof THREE.Mesh) {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(m => m.dispose());
                        } else {
                           (object.material as THREE.Material).dispose();
                        }
                    }
                }
             });
             buildingsRef.current = [];
         }
      }

      if (mountRef.current && rendererRef.current?.domElement && currentMount.contains(rendererRef.current.domElement)) {
           currentMount.removeChild(rendererRef.current.domElement);
      }

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      ambientLightRef.current = null;
      directionalLightRef.current = null;
      spotLightRef.current = null;
      spotLightTargetRef.current = null;

      if (villainManagerRef.current) {
        villainManagerRef.current.dispose();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sceneRef.current && ambientLightRef.current && directionalLightRef.current) {
      sceneRef.current.background = dayNightCycle.currentPhaseDetails.backgroundColor;
      if(sceneRef.current.fog) {
        (sceneRef.current.fog as THREE.Fog).color = dayNightCycle.currentPhaseDetails.fogColor;
      } else {
        sceneRef.current.fog = new THREE.Fog(dayNightCycle.currentPhaseDetails.fogColor, GROUND_SIZE / 6, GROUND_SIZE * 0.75);
      }
      ambientLightRef.current.color = dayNightCycle.currentPhaseDetails.ambientColor;
      ambientLightRef.current.intensity = dayNightCycle.currentPhaseDetails.ambientIntensity;
      directionalLightRef.current.color = dayNightCycle.currentPhaseDetails.directionalColor;
      directionalLightRef.current.intensity = dayNightCycle.currentPhaseDetails.directionalIntensity;
    }
  }, [dayNightCycle]);

  return (
    <>
      <div ref={mountRef} className="w-full h-full cursor-grab focus:cursor-grabbing" tabIndex={-1} />
    </>
  );
}