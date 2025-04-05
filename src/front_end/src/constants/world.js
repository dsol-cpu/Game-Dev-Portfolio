import * as THREE from "three";

export const HEIGHT = {
  MAX: 50,
  MIN: -30,
};

export const NAVIGATION = {
  ARRIVAL_DISTANCE: 5,
  HEIGHT: 20,
  LANDING_SPEED: 0.1,
};

// Island data with section connections
export const ISLAND_DATA = [
  {
    name: "Home Island",
    position: new THREE.Vector3(10, -5, 0),
    section: "home",
  },
  {
    name: "Experience Island",
    position: new THREE.Vector3(60, 20, 20),
    section: "experience",
  },
  {
    name: "Projects Island",
    position: new THREE.Vector3(-20, 5, -50),
    section: "projects",
  },
  {
    name: "Resume Island",
    position: new THREE.Vector3(-10, 5, 40),
    section: "resume",
  },
];

// UI helper functions moved from component
export const getHeightColor = (height) => {
  if (height > 30) return "#ff3300";
  if (height > 15) return "#ff9900";
  if (height > 0) return "#33cc33";
  if (height > -15) return "#3399ff";
  return "#000099";
};

export const getHeightStatus = (height) => {
  if (height >= HEIGHT.MAX) {
    return { text: "MAXIMUM ALTITUDE", color: "text-red-400", icon: "▲" };
  } else if (height <= HEIGHT.MIN) {
    return { text: "MAXIMUM DEPTH", color: "text-blue-600", icon: "▼" };
  } else if (height > 30) {
    return { text: "HIGH ALTITUDE", color: "text-red-400", icon: "▲" };
  } else if (height > 0) {
    return { text: "NORMAL FLIGHT", color: "text-green-400", icon: "●" };
  } else {
    return { text: "DEEP", color: "text-blue-400", icon: "▼" };
  }
};
