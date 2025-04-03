import * as THREE from "three";
import { colors } from "../constants/constants";
import { navigationStore } from "../stores/navigationStore";

export const createElements = (scene) => {
  const clouds = [];
  const islands = [];
  let ship;

  // Create islands at specific positions for navigation
  const islandPositions = [
    { x: 0, y: 0, z: 0 }, // Home island
    { x: 15, y: 1, z: -10 }, // Experience island
    { x: -12, y: -1, z: -15 }, // Projects island
    { x: 8, y: 0, z: 12 }, // Resume island
  ];

  // Create islands
  for (const element of islandPositions) {
    const islandGroup = new THREE.Group();

    // Island base
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2 + Math.random(), 1.5 + Math.random(), 2, 8),
      new THREE.MeshStandardMaterial({
        color: colors.islandSide,
        flatShading: true,
      })
    );

    // Island top
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(2 + Math.random(), 2 + Math.random(), 0.5, 8),
      new THREE.MeshStandardMaterial({
        color: colors.islandTop,
        flatShading: true,
      })
    );

    top.position.y = 1;
    islandGroup.add(base, top);

    // Position island at pre-defined location
    const pos = element;
    islandGroup.position.set(pos.x, pos.y, pos.z);

    scene.add(islandGroup);
    islands.push(islandGroup);
  }

  // Create clouds
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(1 + Math.random(), 7, 7),
      new THREE.MeshStandardMaterial({
        color: colors.clouds,
        flatShading: true,
        transparent: true,
        opacity: 0.9,
      })
    );

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

  // Create controllable airship
  ship = new THREE.Group();

  // Ship body
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(1, 3, 8, 8),
    new THREE.MeshStandardMaterial({
      color: colors.shipBody,
      flatShading: true,
    })
  );

  body.rotation.y = Math.PI / 2;
  body.rotation.z = Math.PI / 2;

  // Ship cabin
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.6, 1.2),
    new THREE.MeshStandardMaterial({
      color: colors.shipAccent,
      flatShading: true,
    })
  );

  cabin.position.y = -0.5;

  // Add propellers
  const propellerGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8);
  const propellerMaterial = new THREE.MeshStandardMaterial({
    color: colors.shipAccent,
  });

  const leftPropeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
  leftPropeller.position.set(-1.5, 0, 0);
  leftPropeller.rotation.y = Math.PI / 2;
  leftPropeller.rotation.z = Math.PI / 2;

  const rightPropeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
  rightPropeller.position.set(1.5, 0, 0);
  rightPropeller.rotation.y = Math.PI / 2;
  rightPropeller.rotation.z = Math.PI / 2;

  ship.add(body, cabin, leftPropeller, rightPropeller);

  // Add ship physics properties
  ship.userData.velocity = new THREE.Vector3(0, 0, 0);
  ship.userData.acceleration = new THREE.Vector3(0, 0, 0);
  ship.userData.rotationVelocity = 0;
  ship.userData.targetIsland = null;
  ship.userData.isNavigating = false;

  ship.position.set(0, 2, 0);
  scene.add(ship);

  return { clouds, islands, ship };
};
