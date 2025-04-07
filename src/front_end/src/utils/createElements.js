import * as THREE from "three";
import { colors } from "../constants/constants";
import { navigationStore } from "../stores/navigation";
import { ISLAND_DATA } from "../constants/world";

export const createElements = (scene) => {
  const cloudGeometry = new THREE.SphereGeometry(1, 7, 7);
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: colors.clouds,
    flatShading: true,
    transparent: true,
    opacity: 0.9,
  });

  const islandBaseGeometry = new THREE.CylinderGeometry(2, 1.5, 2, 8);
  const islandBaseMaterial = new THREE.MeshStandardMaterial({
    color: colors.islandSide,
    flatShading: true,
  });

  const islandTopGeometry = new THREE.CylinderGeometry(2, 2, 0.5, 8);
  const islandTopMaterial = new THREE.MeshStandardMaterial({
    color: colors.islandTop,
    flatShading: true,
  });

  const shipBodyGeometry = new THREE.CapsuleGeometry(1, 3, 8, 8);
  const shipBodyMaterial = new THREE.MeshStandardMaterial({
    color: colors.shipBody,
    flatShading: true,
  });

  const shipCabinGeometry = new THREE.BoxGeometry(1, 0.6, 1.2);
  const shipCabinMaterial = new THREE.MeshStandardMaterial({
    color: colors.shipAccent,
    flatShading: true,
  });

  const propellerGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8);
  const propellerMaterial = new THREE.MeshStandardMaterial({
    color: colors.shipAccent,
  });

  // Create containers for scene objects
  const clouds = [];
  const islands = [];
  let ship;

  // Create islands using ISLAND_DATA from world.js
  for (let i = 0; i < ISLAND_DATA.length; i++) {
    const islandGroup = new THREE.Group();
    const islandInfo = ISLAND_DATA[i];

    // Create geometries with randomized dimensions
    const baseSize = 2 + Math.random() * 0.5;
    const topSize = 2 + Math.random() * 0.5;

    // Clone and modify geometries for variation
    const customBaseGeometry = islandBaseGeometry.clone();
    customBaseGeometry.scale(baseSize / 2, 1, baseSize / 2);

    const customTopGeometry = islandTopGeometry.clone();
    customTopGeometry.scale(topSize / 2, 1, topSize / 2);

    // Create island parts
    const base = new THREE.Mesh(customBaseGeometry, islandBaseMaterial);

    const top = new THREE.Mesh(customTopGeometry, islandTopMaterial);
    top.position.y = 1;

    // Add island parts to group
    islandGroup.add(base, top);

    // Use position from ISLAND_DATA
    islandGroup.position.copy(islandInfo.position);

    // Store section information in userData for navigation
    islandGroup.userData.type = islandInfo.section;
    islandGroup.userData.name = islandInfo.name;

    scene.add(islandGroup);
    islands.push(islandGroup);
  }

  // Create clouds more efficiently
  for (let i = 0; i < 8; i++) {
    // Clone and modify geometry for each cloud
    const customGeometry = cloudGeometry.clone();
    customGeometry.scale(
      1 + Math.random(),
      1 + Math.random(),
      1 + Math.random()
    );

    const cloud = new THREE.Mesh(customGeometry, cloudMaterial);

    const scale = 0.8 + Math.random() * 1.5;
    cloud.position.set(
      (Math.random() - 0.5) * 40,
      5 + Math.random() * 8,
      (Math.random() - 0.5) * 40
    );

    cloud.scale.set(scale, scale * 0.6, scale);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // Create ship
  ship = new THREE.Group();

  const PI_2 = Math.PI / 2;
  // Ship body
  const body = new THREE.Mesh(shipBodyGeometry, shipBodyMaterial);
  body.rotation.set(0, PI_2, PI_2);

  // Ship cabin
  const cabin = new THREE.Mesh(shipCabinGeometry, shipCabinMaterial);
  cabin.position.y = -0.5;

  // Propellers
  const leftPropeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
  leftPropeller.position.set(-1.5, 0, 0);
  leftPropeller.rotation.set(0, PI_2, PI_2);

  const rightPropeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
  rightPropeller.position.set(1.5, 0, 0);
  rightPropeller.rotation.set(0, PI_2, PI_2);

  // Assemble ship
  ship.add(body, cabin, leftPropeller, rightPropeller);

  // Ship physics properties
  ship.userData = {
    velocity: new THREE.Vector3(0, 0, 0),
    acceleration: new THREE.Vector3(0, 0, 0),
    rotationVelocity: 0,
    targetIsland: null,
    isNavigating: false,
  };

  // Start ship at home island position + offset for height
  const homeIsland = ISLAND_DATA.find((island) => island.section === "home");
  if (homeIsland) {
    ship.position.set(
      homeIsland.position.x,
      homeIsland.position.y + 2, // Offset ship above island
      homeIsland.position.z
    );
  } else {
    ship.position.set(0, 2, 0); // Fallback position
  }

  scene.add(ship);

  return { clouds, islands, ship };
};
