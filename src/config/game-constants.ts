
export const PLAYER_SPEED = 5.0; // units per second
export const PLAYER_SENSITIVITY = 0.002; // mouse sensitivity
export const GROUND_SIZE = 100; // width and depth of the ground plane

// New constants for jump, run, crouch
export const PLAYER_JUMP_FORCE = 8.0; // Initial upward velocity for jump
export const GRAVITY = 20.0; // Acceleration due to gravity (units per second squared)
export const PLAYER_RUN_MULTIPLIER = 1.8; // Speed multiplier when running
export const PLAYER_NORMAL_HEIGHT = 1.7; // Player's eye-level height when standing
export const PLAYER_CROUCH_HEIGHT = 1.0; // Player's eye-level height when crouching
export const PLAYER_CROUCH_SPEED_MULTIPLIER = 0.5; // Speed multiplier when crouching
export const MAX_AIR_JUMPS = 3; // Maximum number of jumps allowed in the air after the initial ground jump

// Player attack constants
export const PLAYER_PUNCH_DAMAGE = 5;
export const PLAYER_KICK_DAMAGE = 8;
export const GUN1_DAMAGE = 15;
export const GUN2_DAMAGE = 22;
export const SWORD_DAMAGE = 30;

// Power-up constants
export const POWERUP_COLLECTION_DISTANCE = 1.5; // Distance within which player collects power-up
export const POWERUP_GLOW_INTENSITY = 1.5;
export const INVINCIBILITY_DURATION = 10; // seconds

// Player Health
export const PLAYER_MAX_HEALTH = 150;

