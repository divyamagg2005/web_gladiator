import * as THREE from 'three';
import { VillainType, VillainState, VILLAIN_STATS, VILLAIN_ANIMATION } from '@/config/villain-constants';

// Interface for villain instance
export interface Villain {
  id: string;
  type: VillainType;
  mesh: THREE.Mesh;
  state: VillainState;
  health: number;
  maxHealth: number;
  position: THREE.Vector3;
  spawnPosition: THREE.Vector3;
  target: THREE.Vector3 | null;
  lastAttackTime: number;
  lastStateChangeTime: number;
  isDead: boolean;
  isActive: boolean;
  difficultyLevel: number;
  patrolTarget: THREE.Vector3 | null;
  stunEndTime: number;
}

// Class to manage villains
export class VillainManager {
  private villains: Map<string, Villain> = new Map();
  private scene: THREE.Scene;
  private lastSpawnTime: number = 0;
  private difficultyLevel: number = 1;
  private lastDifficultyIncreaseTime: number = 0;
  private villainsKilled: number = 0;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.lastSpawnTime = performance.now();
    this.lastDifficultyIncreaseTime = performance.now();
  }

  /**
   * Create a new villain
   */
  createVillain(type: VillainType, position: THREE.Vector3): Villain {
    const id = `villain_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const stats = VILLAIN_STATS[type];
    
    // Create villain mesh
    const geometry = new THREE.BoxGeometry(
      stats.scale.x,
      stats.scale.y,
      stats.scale.z
    );
    
    // Create material with villain color
    const material = new THREE.MeshStandardMaterial({
      color: stats.color,
      roughness: 0.7,
      metalness: 0.2,
    });
    
    // Create mesh and position it
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Add to scene
    this.scene.add(mesh);
    
    // Create villain object
    const villain: Villain = {
      id,
      type,
      mesh,
      state: VillainState.IDLE,
      health: stats.health * this.difficultyLevel,
      maxHealth: stats.health * this.difficultyLevel,
      position: position.clone(),
      spawnPosition: position.clone(),
      target: null,
      lastAttackTime: 0,
      lastStateChangeTime: performance.now(),
      isDead: false,
      isActive: true,
      difficultyLevel: this.difficultyLevel,
      patrolTarget: null,
      stunEndTime: 0
    };
    
    // Add to villains map
    this.villains.set(id, villain);
    
    // Create health bar for the villain
    this.updateVillainHealthBar(villain);
    
    // Update villain count in UI
    this.updateVillainCountUI();
    
    return villain;
  }

  /**
   * Remove a villain from the game
   */
  removeVillain(id: string): void {
    const villain = this.villains.get(id);
    if (villain) {
      // Remove mesh from scene
      this.scene.remove(villain.mesh);
      
      // Dispose of geometry and material
      if (villain.mesh.geometry) {
        villain.mesh.geometry.dispose();
      }
      
      if (villain.mesh.material) {
        if (Array.isArray(villain.mesh.material)) {
          villain.mesh.material.forEach(m => m.dispose());
        } else {
          (villain.mesh.material as THREE.Material).dispose();
        }
      }
      
      // Remove from map
      this.villains.delete(id);
      
      // Update villain count in UI
      this.updateVillainCountUI();
    }
  }

  /**
   * Get all active villains
   */
  getActiveVillains(): Villain[] {
    return Array.from(this.villains.values()).filter(v => v.isActive && !v.isDead);
  }

  /**
   * Get all villains
   */
  getAllVillains(): Villain[] {
    return Array.from(this.villains.values());
  }

  /**
   * Get villain by ID
   */
  getVillain(id: string): Villain | undefined {
    return this.villains.get(id);
  }
  
  /**
   * Get villains killed count
   */
  getVillainsKilled(): number {
    return this.villainsKilled;
  }
  
  /**
   * Update villain count in UI
   */
  updateVillainCountUI(): void {
    // Update active villain count
    const villainCountElement = document.getElementById('villain-count');
    if (villainCountElement) {
      const activeCount = this.getActiveVillains().length;
      villainCountElement.textContent = activeCount.toString();
    } else {
      // Create the element if it doesn't exist
      const newElement = document.createElement('div');
      newElement.id = 'villain-count';
      newElement.style.display = 'none'; // Hidden element
      newElement.textContent = this.getActiveVillains().length.toString();
      document.body.appendChild(newElement);
    }
    
    // Update villain kill count
    const killCountElement = document.getElementById('villain-kill-count');
    if (killCountElement) {
      killCountElement.textContent = this.villainsKilled.toString();
    } else {
      // Create the element if it doesn't exist
      const newElement = document.createElement('div');
      newElement.id = 'villain-kill-count';
      newElement.style.display = 'none'; // Hidden element
      newElement.textContent = this.villainsKilled.toString();
      document.body.appendChild(newElement);
    }
  }

  /**
   * Update villain state based on player position
   */
  updateVillainState(villain: Villain, playerPosition: THREE.Vector3, delta: number): void {
    const stats = VILLAIN_STATS[villain.type];
    const now = performance.now();
    
    // Skip if villain is dead
    if (villain.isDead) return;
    
    // Check if villain is stunned and should recover
    if (villain.state === VillainState.STUNNED && now >= villain.stunEndTime) {
      villain.state = VillainState.IDLE;
      villain.lastStateChangeTime = now;
    }
    
    // Skip further updates if stunned
    if (villain.state === VillainState.STUNNED) return;
    
    // Calculate distance to player
    const distanceToPlayer = villain.mesh.position.distanceTo(playerPosition);
    
    // State machine for villain behavior
    switch (villain.state) {
      case VillainState.IDLE:
        // If player is within detection range, start chasing
        if (distanceToPlayer <= stats.detectionRange) {
          villain.state = VillainState.CHASING;
          villain.target = playerPosition.clone();
          villain.lastStateChangeTime = now;
        } 
        // Occasionally start patrolling
        else if (now - villain.lastStateChangeTime > 5000 && Math.random() < 0.01) {
          villain.state = VillainState.PATROLLING;
          
          // Set a random patrol target within patrol radius
          const angle = Math.random() * Math.PI * 2;
          const radius = Math.random() * VILLAIN_ANIMATION.patrolRadius;
          villain.patrolTarget = new THREE.Vector3(
            villain.spawnPosition.x + Math.cos(angle) * radius,
            villain.spawnPosition.y,
            villain.spawnPosition.z + Math.sin(angle) * radius
          );
          villain.lastStateChangeTime = now;
        }
        break;
        
      case VillainState.PATROLLING:
        // If player is within detection range, start chasing
        if (distanceToPlayer <= stats.detectionRange) {
          villain.state = VillainState.CHASING;
          villain.target = playerPosition.clone();
          villain.lastStateChangeTime = now;
        } 
        // If reached patrol target, go back to idle
        else if (villain.patrolTarget && 
                villain.mesh.position.distanceTo(villain.patrolTarget) < 1.0) {
          villain.state = VillainState.IDLE;
          villain.patrolTarget = null;
          villain.lastStateChangeTime = now;
        }
        break;
        
      case VillainState.CHASING:
        // Update target to current player position
        villain.target = playerPosition.clone();
        
        // If player is within attack range, attack
        if (distanceToPlayer <= stats.attackRange) {
          // Only attack if cooldown has passed
          if (now - villain.lastAttackTime > stats.attackCooldown * 1000) {
            villain.state = VillainState.ATTACKING;
            villain.lastStateChangeTime = now;
            villain.lastAttackTime = now;
          }
        } 
        // If player is out of detection range, go back to patrolling
        else if (distanceToPlayer > stats.detectionRange * 1.5) {
          villain.state = VillainState.PATROLLING;
          
          // Set a patrol target back toward spawn point
          villain.patrolTarget = villain.spawnPosition.clone();
          villain.lastStateChangeTime = now;
        }
        break;
        
      case VillainState.ATTACKING:
        // Attack animation plays for a fixed duration
        if (now - villain.lastStateChangeTime > VILLAIN_ANIMATION.attackDuration * 1000) {
          villain.state = VillainState.CHASING;
          villain.lastStateChangeTime = now;
        }
        break;
    }
  }

  /**
   * Move villain based on its current state
   */
  moveVillain(villain: Villain, delta: number): void {
    const stats = VILLAIN_STATS[villain.type];
    
    // Skip if villain is dead or stunned
    if (villain.isDead || villain.state === VillainState.STUNNED) return;
    
    // Calculate movement based on state
    switch (villain.state) {
      case VillainState.PATROLLING:
        if (villain.patrolTarget) {
          this.moveTowardsTarget(villain, villain.patrolTarget, stats.speed * 0.5, delta);
        }
        break;
        
      case VillainState.CHASING:
        if (villain.target) {
          this.moveTowardsTarget(villain, villain.target, stats.speed, delta);
        }
        break;
        
      // Don't move during attack or idle states
      case VillainState.ATTACKING:
      case VillainState.IDLE:
        break;
    }
  }

  /**
   * Helper to move villain towards a target position
   */
  private moveTowardsTarget(villain: Villain, target: THREE.Vector3, speed: number, delta: number): void {
    // Calculate direction vector
    const direction = new THREE.Vector3()
      .subVectors(target, villain.mesh.position)
      .normalize();
    
    // Don't change Y position (keep on ground)
    direction.y = 0;
    
    // Calculate movement distance for this frame
    const moveDistance = speed * delta;
    
    // Move the villain
    villain.mesh.position.add(direction.multiplyScalar(moveDistance));
    
    // Update stored position
    villain.position.copy(villain.mesh.position);
    
    // Make villain face the direction of movement
    if (direction.length() > 0) {
      villain.mesh.lookAt(new THREE.Vector3(
        villain.mesh.position.x + direction.x,
        villain.mesh.position.y,
        villain.mesh.position.z + direction.z
      ));
    }
  }

  /**
   * Apply damage to a villain
   */
  damageVillain(id: string, amount: number): boolean {
    const villain = this.villains.get(id);
    if (!villain || villain.isDead) return false;
    
    villain.health -= amount;
    
    // Update villain health bar
    this.updateVillainHealthBar(villain);
    
    // Visual feedback for hit - flash the villain red
    if (villain.mesh.material) {
      const originalMaterial = villain.mesh.material as THREE.MeshStandardMaterial;
      const originalColor = originalMaterial.color.clone();
      
      // Flash red
      originalMaterial.color.set(0xff0000);
      
      // Return to original color after a short time
      setTimeout(() => {
        if (villain.mesh && villain.mesh.material) {
          (villain.mesh.material as THREE.MeshStandardMaterial).color.copy(originalColor);
        }
      }, 150);
    }
    
    // Check if villain is dead
    if (villain.health <= 0) {
      villain.health = 0;
      villain.isDead = true;
      villain.state = VillainState.DEAD;
      villain.lastStateChangeTime = performance.now();
      
      // Increment villains killed counter
      this.villainsKilled++;
      
      // Update villain kill count in UI
      this.updateVillainCountUI();
      
      // Change color to black when dead
      if (villain.mesh.material) {
        (villain.mesh.material as THREE.MeshStandardMaterial).color.set(0x000000);
        // Make it partially transparent to indicate it's fading away
        (villain.mesh.material as THREE.MeshStandardMaterial).transparent = true;
        (villain.mesh.material as THREE.MeshStandardMaterial).opacity = 0.7;
      }
      
      // Schedule removal after death animation
      setTimeout(() => {
        this.removeVillain(villain.id);
      }, VILLAIN_ANIMATION.deathDuration * 1000);
      
      return true; // Villain died
    }
    
    // Stun the villain when hit
    villain.state = VillainState.STUNNED;
    villain.stunEndTime = performance.now() + VILLAIN_ANIMATION.stunnedDuration * 1000;
    
    return false; // Villain still alive
  }
  
  /**
   * Create and update health bars for villains
   */
  private updateVillainHealthBar(villain: Villain): void {
    // Create a health bar if it doesn't exist
    if (!villain.mesh.userData.healthBar) {
      // Create a health bar container
      const healthBarGeometry = new THREE.BoxGeometry(1, 0.1, 0.1);
      const healthBarMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const healthBar = new THREE.Mesh(healthBarGeometry, healthBarMaterial);
      
      // Position the health bar above the villain
      // Use type assertion to access parameters (Three.js types issue)
      const geometryParams = villain.mesh.geometry as any;
      healthBar.position.y = (geometryParams.parameters?.height || 1) / 2 + 0.2;
      
      // Add the health bar to the villain mesh
      villain.mesh.add(healthBar);
      villain.mesh.userData.healthBar = healthBar;
      
      // Create background for health bar
      const backgroundGeometry = new THREE.BoxGeometry(1, 0.1, 0.05);
      const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
      const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
      background.position.z = -0.03;
      healthBar.add(background);
    }
    
    // Update the health bar scale based on health percentage
    const healthPercentage = villain.health / villain.maxHealth;
    const healthBar = villain.mesh.userData.healthBar as THREE.Mesh;
    healthBar.scale.x = Math.max(0.01, healthPercentage);
    
    // Update color based on health percentage
    if (healthBar.material) {
      const material = healthBar.material as THREE.MeshBasicMaterial;
      if (healthPercentage > 0.6) {
        material.color.set(0x00ff00); // Green for high health
      } else if (healthPercentage > 0.3) {
        material.color.set(0xffff00); // Yellow for medium health
      } else {
        material.color.set(0xff0000); // Red for low health
      }
    }
  }

  /**
   * Check if a villain can attack the player
   */
  canVillainAttack(id: string): boolean {
    const villain = this.villains.get(id);
    if (!villain || villain.isDead) return false;
    
    // Allow attacks even if not in attacking state to make villains more aggressive
    // This will let them attack as soon as they're in range
    if (villain.state === VillainState.CHASING || villain.state === VillainState.ATTACKING) {
      const now = performance.now();
      // Check if cooldown has passed - reduce cooldown by 90% to make attacks much more frequent
      return now - villain.lastAttackTime >= VILLAIN_STATS[villain.type].attackCooldown * 100; // Reduced cooldown by 90%
    }
    
    return false;
  }

  /**
   * Get damage amount for a villain
   */
  getVillainDamage(id: string): number {
    const villain = this.villains.get(id);
    if (!villain) return 0;
    
    return VILLAIN_STATS[villain.type].damage * villain.difficultyLevel;
  }

  /**
   * Check for collisions between player and villains
   */
  checkPlayerVillainCollisions(playerPosition: THREE.Vector3, playerRadius: number): string[] {
    const collidingVillains: string[] = [];
    
    this.getActiveVillains().forEach(villain => {
      const distanceToVillain = playerPosition.distanceTo(villain.position);
      // Increase collision threshold to make it easier for villains to attack
      // Use type assertion to access parameters (Three.js types issue)
      const geometryParams = villain.mesh.geometry as any;
      const villainWidth = Math.max(geometryParams.parameters?.width || 0.8, geometryParams.parameters?.depth || 0.6);
      const collisionThreshold = (playerRadius + villainWidth / 2) * 1.5; // 50% larger collision radius
      
      if (distanceToVillain <= collisionThreshold) {
        collidingVillains.push(villain.id);
      }
    });
    
    return collidingVillains;
  }

  /**
   * Clean up all villains
   */
  dispose(): void {
    this.getAllVillains().forEach(villain => {
      this.removeVillain(villain.id);
    });
    this.villains.clear();
  }
}
