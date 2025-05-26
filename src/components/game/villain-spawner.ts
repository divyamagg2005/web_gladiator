import * as THREE from 'three';
import { VillainType, VILLAIN_SPAWN_SETTINGS } from '@/config/villain-constants';
import { VillainManager } from './villain';

export class VillainSpawner {
  private villainManager: VillainManager;
  private lastSpawnTime: number = 0;
  private difficultyLevel: number = 1;
  private lastDifficultyIncreaseTime: number = 0;
  private gameStartTime: number = 0;
  private currentPhase: string = 'day';
  
  private initialSpawnComplete: boolean = false;
  
  constructor(villainManager: VillainManager) {
    this.villainManager = villainManager;
    this.gameStartTime = performance.now();
    this.lastSpawnTime = this.gameStartTime;
    this.lastDifficultyIncreaseTime = this.gameStartTime;
  }
  
  /**
   * Update spawner - called every frame
   */
  update(playerPosition: THREE.Vector3, currentPhase: string, delta: number): void {
    const now = performance.now();
    this.currentPhase = currentPhase.toLowerCase();
    
    // Handle initial spawn wave
    if (!this.initialSpawnComplete && now - this.gameStartTime >= VILLAIN_SPAWN_SETTINGS.initialSpawnDelay * 1000) {
      this.spawnInitialWave(playerPosition);
      this.initialSpawnComplete = true;
      this.lastSpawnTime = now;
      return;
    }
    
    // Update difficulty level
    this.updateDifficultyLevel(now);
    
    // Check if it's time to spawn a new villain
    if (this.shouldSpawnVillain(now)) {
      this.spawnVillain(playerPosition);
      this.lastSpawnTime = now;
    }
  }
  
  /**
   * Determine if a new villain should spawn
   */
  private shouldSpawnVillain(now: number): boolean {
    // Check if game is over - don't spawn villains if game is over
    const gameOverElement = document.getElementById('game-over');
    if (gameOverElement && (gameOverElement.textContent === 'won' || gameOverElement.textContent === 'lost')) {
      return false;
    }
    
    // Check if game is paused - don't spawn villains if game is paused
    const pauseElement = document.getElementById('game-paused');
    if (pauseElement && pauseElement.textContent === 'true') {
      return false;
    }
    
    // Get spawn interval based on current phase
    let spawnInterval = VILLAIN_SPAWN_SETTINGS.spawnInterval.day;
    
    switch (this.currentPhase) {
      case 'dusk':
        spawnInterval = VILLAIN_SPAWN_SETTINGS.spawnInterval.dusk;
        break;
      case 'night':
        spawnInterval = VILLAIN_SPAWN_SETTINGS.spawnInterval.night;
        break;
      case 'dawn':
        spawnInterval = VILLAIN_SPAWN_SETTINGS.spawnInterval.dawn;
        break;
    }
    
    // Check if enough time has passed since last spawn
    const timeSinceLastSpawn = (now - this.lastSpawnTime) / 1000; // convert to seconds
    
    // Check if we've reached the maximum number of villains
    const activeVillains = this.villainManager.getActiveVillains().length;
    
    return timeSinceLastSpawn >= spawnInterval && activeVillains < VILLAIN_SPAWN_SETTINGS.maxVillains;
  }
  
  /**
   * Spawn the initial wave of villains
   */
  private spawnInitialWave(playerPosition: THREE.Vector3): void {
    const count = VILLAIN_SPAWN_SETTINGS.initialSpawnCount;
    console.log(`Spawning initial wave of ${count} enemies!`);
    
    for (let i = 0; i < count; i++) {
      // Stagger spawns slightly to prevent performance hit
      setTimeout(() => {
        this.spawnVillain(playerPosition, true);
      }, i * 100); // 100ms between each spawn
    }
  }
  
  /**
   * Spawn a new villain
   */
  private spawnVillain(playerPosition: THREE.Vector3, isInitialWave: boolean = false): void {
    // Choose a random villain type with higher chance for harder enemies as difficulty increases
    const villainTypes = Object.values(VillainType);
    let randomType: VillainType;
    
    // Adjust enemy type distribution based on difficulty
    const difficultyModifier = this.difficultyLevel / VILLAIN_SPAWN_SETTINGS.difficultyIncrease.maxDifficultyLevel;
    const randomValue = Math.random();
    
    if (randomValue < 0.1 + (difficultyModifier * 0.3)) { // 10-40% chance for ghost (hardest)
      randomType = VillainType.GHOST;
    } else if (randomValue < 0.3 + (difficultyModifier * 0.3)) { // 20-50% chance for skeleton
      randomType = VillainType.SKELETON;
    } else { // 30-50% chance for zombie (easiest)
      randomType = VillainType.ZOMBIE;
    }
    
    // Calculate spawn position away from player
    const spawnPosition = this.calculateSpawnPosition(playerPosition);
    
    // Create the villain
    this.villainManager.createVillain(randomType, spawnPosition);
    
    // Update the villain count in the DOM for PlayerStatsDisplay to read
    const activeVillains = this.villainManager.getActiveVillains().length;
    const villainCountElement = document.getElementById('villain-count');
    if (villainCountElement) {
      villainCountElement.textContent = activeVillains.toString();
    } else {
      // Create the element if it doesn't exist
      const newElement = document.createElement('div');
      newElement.id = 'villain-count';
      newElement.style.display = 'none'; // Hidden element
      newElement.textContent = activeVillains.toString();
      document.body.appendChild(newElement);
    }
    
    if (!isInitialWave) {
      console.log(`Spawned new ${randomType}! Total enemies: ${activeVillains}`);
    }
  }
  
  /**
   * Calculate a spawn position that is a certain distance from the player
   */
  private calculateSpawnPosition(playerPosition: THREE.Vector3): THREE.Vector3 {
    // Choose a random angle
    const angle = Math.random() * Math.PI * 2;
    
    // Choose a random distance within the min-max range
    const distance = VILLAIN_SPAWN_SETTINGS.spawnDistance.min + 
                    Math.random() * (VILLAIN_SPAWN_SETTINGS.spawnDistance.max - VILLAIN_SPAWN_SETTINGS.spawnDistance.min);
    
    // Calculate position
    const x = playerPosition.x + Math.cos(angle) * distance;
    const z = playerPosition.z + Math.sin(angle) * distance;
    
    // Use player's y position (ground level)
    return new THREE.Vector3(x, playerPosition.y - 1.7, z); // Subtract eye height to place on ground
  }
  
  /**
   * Update difficulty level based on time elapsed
   */
  private updateDifficultyLevel(now: number): void {
    const timeSinceLastIncrease = (now - this.lastDifficultyIncreaseTime) / 1000; // convert to seconds
    
    if (timeSinceLastIncrease >= VILLAIN_SPAWN_SETTINGS.difficultyIncrease.interval && 
        this.difficultyLevel < VILLAIN_SPAWN_SETTINGS.difficultyIncrease.maxDifficultyLevel) {
      this.difficultyLevel++;
      this.lastDifficultyIncreaseTime = now;
    }
  }
  
  /**
   * Get current difficulty level
   */
  getDifficultyLevel(): number {
    return this.difficultyLevel;
  }
  
  /**
   * Reset spawner
   */
  reset(): void {
    this.gameStartTime = performance.now();
    this.lastSpawnTime = this.gameStartTime + VILLAIN_SPAWN_SETTINGS.initialSpawnDelay * 1000;
    this.lastDifficultyIncreaseTime = this.gameStartTime;
    this.difficultyLevel = 1;
  }
}
