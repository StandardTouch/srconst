import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import IsometricBuildingCanvas from './IsometricBuildingCanvas';

export default function ThreeBuildingCanvas({
  site,
  selectedBlock,
  onSelectBlock,
  selectedFloor,
  onSelectFloor,
  lightingMode = 'dusk', // 'dusk' | 'night' | 'day'
  hoveredFlat,
  onHoverFloor
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const blocksGroupRef = useRef(null);
  const floorMeshesRef = useRef([]);
  const blockMeshesRef = useRef([]);
  const animFrameRef = useRef(null);
  const targetCamPosRef = useRef(new THREE.Vector3(0, 35, 45));
  const targetLookAtRef = useRef(new THREE.Vector3(0, 8, 0));
  const currentLookAtRef = useRef(new THREE.Vector3(0, 8, 0));

  const [hoveredBlockName, setHoveredBlockName] = useState(null);
  const [hoveredFloorNum, setHoveredFloorNum] = useState(null);
  const [webglError, setWebglError] = useState(false);

  // Initialize Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isMounted = true;
    let isContextLost = false;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 35, 45);
    cameraRef.current = camera;

    // Renderer with Safari safety flags
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false,
        precision: 'mediump'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.BasicShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;

      // Handle context lost gracefully
      const canvas = renderer.domElement;
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        isContextLost = true;
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        console.warn('WebGL context lost - recovered gracefully');
      }, false);

      canvas.addEventListener('webglcontextrestored', () => {
        isContextLost = false;
        console.info('WebGL context restored');
      }, false);

      container.innerHTML = '';
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (e) {
      console.error('WebGL initialization error:', e);
      setWebglError(true);
      return;
    }

    // Lighting setup based on mode
    const lightsGroup = new THREE.Group();
    scene.add(lightsGroup);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    lightsGroup.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffecd2, 1.6);
    mainLight.position.set(30, 50, 30);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    lightsGroup.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.7);
    fillLight.position.set(-30, 20, -30);
    lightsGroup.add(fillLight);

    // Ground platform / podium
    const groundGeo = new THREE.CylinderGeometry(40, 42, 1.2, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    scene.add(ground);

    // Reflective inner luxury podium ring
    const innerRingGeo = new THREE.RingGeometry(3, 38, 32);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.1,
      metalness: 0.9,
      side: THREE.DoubleSide
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.02;
    innerRing.receiveShadow = true;
    scene.add(innerRing);

    // Decorative ground architectural lights / grid lines
    const gridHelper = new THREE.GridHelper(70, 35, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0.03;
    scene.add(gridHelper);

    // Group for building blocks
    const blocksGroup = new THREE.Group();
    scene.add(blocksGroup);
    blocksGroupRef.current = blocksGroup;

    // Raycasting for interactions
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e) => {
      if (!renderer || isContextLost) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      if (selectedBlock) {
        const floorIntersects = raycaster.intersectObjects(floorMeshesRef.current);
        if (floorIntersects.length > 0) {
          const hitFloor = floorIntersects[0].object.userData.floorNumber;
          setHoveredFloorNum(hitFloor);
          if (onHoverFloor) onHoverFloor(hitFloor);
          container.style.cursor = 'pointer';
        } else {
          setHoveredFloorNum(null);
          if (onHoverFloor) onHoverFloor(null);
          container.style.cursor = 'default';
        }
      } else {
        const blockIntersects = raycaster.intersectObjects(blockMeshesRef.current, true);
        if (blockIntersects.length > 0) {
          let root = blockIntersects[0].object;
          while (root.parent && !root.userData.blockData && root.parent !== blocksGroup) {
            root = root.parent;
          }
          if (root.userData.blockData) {
            setHoveredBlockName(root.userData.blockData.name);
            container.style.cursor = 'pointer';
          }
        } else {
          setHoveredBlockName(null);
          container.style.cursor = 'default';
        }
      }
    };

    const handlePointerDown = (e) => {
      if (!renderer || isContextLost) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      if (selectedBlock) {
        const floorIntersects = raycaster.intersectObjects(floorMeshesRef.current);
        if (floorIntersects.length > 0) {
          const clickedFloor = floorIntersects[0].object.userData.floorNumber;
          onSelectFloor(clickedFloor);
        }
      } else {
        const blockIntersects = raycaster.intersectObjects(blockMeshesRef.current, true);
        if (blockIntersects.length > 0) {
          let root = blockIntersects[0].object;
          while (root.parent && !root.userData.blockData && root.parent !== blocksGroup) {
            root = root.parent;
          }
          if (root.userData.blockData) {
            onSelectBlock(root.userData.blockData);
          }
        }
      }
    };

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerdown', handlePointerDown);

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera || isContextLost) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop with smooth camera lerping
    let time = 0;
    const animate = () => {
      if (!isMounted) return;
      animFrameRef.current = requestAnimationFrame(animate);

      if (isContextLost || !rendererRef.current) return;

      time += 0.01;

      // Smooth camera interpolation
      camera.position.lerp(targetCamPosRef.current, 0.05);
      currentLookAtRef.current.lerp(targetLookAtRef.current, 0.05);
      camera.lookAt(currentLookAtRef.current);

      // Subtle ambient motion when in campus view
      if (!selectedBlock) {
        const orbitRadius = 45;
        const speed = 0.0015;
        targetCamPosRef.current.x = Math.sin(time * speed) * 35;
        targetCamPosRef.current.z = Math.cos(time * speed) * 35 + 10;
        targetCamPosRef.current.y = 32 + Math.sin(time * speed * 0.5) * 3;
      }

      // Rotate subtle light accents
      fillLight.position.x = Math.sin(time * 0.2) * 30;
      fillLight.position.z = Math.cos(time * 0.2) * 30;

      try {
        renderer.render(scene, camera);
      } catch (err) {
        console.warn('Suppressing WebGL transient render error:', err);
      }
    };
    animate();

    return () => {
      isMounted = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerdown', handlePointerDown);

      if (renderer) {
        try {
          if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
          renderer.dispose();
        } catch (e) {}
      }
    };
  }, []);

  // Update lighting mode
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    if (lightingMode === 'dusk') {
      scene.fog = new THREE.FogExp2(0x0f172a, 0.012);
    } else if (lightingMode === 'night') {
      scene.fog = new THREE.FogExp2(0x030712, 0.015);
    } else {
      scene.fog = new THREE.FogExp2(0x1e293b, 0.008);
    }
  }, [lightingMode]);

  // Build Procedural 3D Towers whenever site/blocks change
  useEffect(() => {
    const blocksGroup = blocksGroupRef.current;
    if (!blocksGroup || !site || !site.blocks) return;

    // Clear previous blocks
    while (blocksGroup.children.length > 0) {
      blocksGroup.remove(blocksGroup.children[0]);
    }
    floorMeshesRef.current = [];
    blockMeshesRef.current = [];

    const floorHeight = 1.35;
    const towerWidth = 8.5;
    const towerDepth = 9.5;

    site.blocks.forEach((block) => {
      const blockRoot = new THREE.Group();
      blockRoot.position.set(block.posX || 0, 0, block.posZ || 0);
      blockRoot.userData = { blockData: block };

      const totalFloors = block.totalFloors || 14;
      const isThisBlockSelected = selectedBlock && selectedBlock.name === block.name;

      // Base Podium for Tower
      const podiumGeo = new THREE.BoxGeometry(towerWidth + 2.5, 1.2, towerDepth + 2.5);
      const podiumMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.4,
        metalness: 0.6
      });
      const podium = new THREE.Mesh(podiumGeo, podiumMat);
      podium.position.y = 0.6;
      podium.castShadow = true;
      podium.receiveShadow = true;
      blockRoot.add(podium);

      // Procedural Floors
      for (let floorNum = 1; floorNum <= totalFloors; floorNum++) {
        const floorGroup = new THREE.Group();
        const yPos = 1.2 + (floorNum - 1) * floorHeight + floorHeight / 2;
        floorGroup.position.set(0, yPos, 0);

        // Floor slab
        const slabGeo = new THREE.BoxGeometry(towerWidth + 0.3, 0.22, towerDepth + 0.3);
        const isFloorActive = selectedFloor === floorNum;
        const slabMat = new THREE.MeshStandardMaterial({
          color: isFloorActive ? 0x38bdf8 : 0x334155,
          roughness: 0.2,
          metalness: 0.8,
          emissive: isFloorActive ? 0x0284c7 : 0x000000,
          emissiveIntensity: isFloorActive ? 0.6 : 0
        });
        const slabMesh = new THREE.Mesh(slabGeo, slabMat);
        slabMesh.position.y = -floorHeight / 2 + 0.11;
        slabMesh.castShadow = true;
        slabMesh.receiveShadow = true;
        floorGroup.add(slabMesh);

        // Floor Glass Facade Body
        const glassGeo = new THREE.BoxGeometry(towerWidth, floorHeight - 0.25, towerDepth);
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.2,
          metalness: 0.8,
          transparent: true,
          opacity: 0.85
        });
        const glassMesh = new THREE.Mesh(glassGeo, glassMat);
        glassMesh.castShadow = true;
        floorGroup.add(glassMesh);

        // Interior warm lighting glow
        const glowGeo = new THREE.BoxGeometry(towerWidth - 0.4, floorHeight - 0.35, towerDepth - 0.4);
        const glowMat = new THREE.MeshBasicMaterial({
          color: isFloorActive ? 0x38bdf8 : 0xffecc4,
          transparent: true,
          opacity: isFloorActive ? 0.45 : 0.18
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        floorGroup.add(glowMesh);

        // Interactive Invisible Click Hitbox for the floor
        const hitGeo = new THREE.BoxGeometry(towerWidth + 1.2, floorHeight, towerDepth + 1.2);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitMesh = new THREE.Mesh(hitGeo, hitMat);
        hitMesh.userData = {
          blockName: block.name,
          floorNumber: floorNum
        };
        floorGroup.add(hitMesh);

        if (isThisBlockSelected) {
          floorMeshesRef.current.push(hitMesh);
        }

        blockRoot.add(floorGroup);
      }

      // Penthouse / Architectural Crown Roof Feature
      const crownY = 1.2 + totalFloors * floorHeight + 1.2;
      const crownGeo = new THREE.BoxGeometry(towerWidth - 1.5, 2.0, towerDepth - 1.5);
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        roughness: 0.2,
        metalness: 0.9,
        emissive: 0x0369a1,
        emissiveIntensity: 0.3
      });
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.y = crownY;
      crown.castShadow = true;
      blockRoot.add(crown);

      // Helipad ring on top
      const heliGeo = new THREE.RingGeometry(1.2, 1.8, 16);
      const heliMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
      const helipad = new THREE.Mesh(heliGeo, heliMat);
      helipad.rotation.x = -Math.PI / 2;
      helipad.position.y = crownY + 1.02;
      blockRoot.add(helipad);

      blockMeshesRef.current.push(blockRoot);
      blocksGroup.add(blockRoot);
    });
  }, [site, selectedBlock, selectedFloor]);

  // Smooth Camera Framing depending on selection state
  useEffect(() => {
    if (selectedBlock) {
      const targetX = selectedBlock.posX || 0;
      const targetZ = selectedBlock.posZ || 0;
      const totalFloors = selectedBlock.totalFloors || 14;
      const midTowerHeight = (totalFloors * 1.35) / 2 + 1;

      if (selectedFloor) {
        const floorY = 1.2 + (selectedFloor - 0.5) * 1.35;
        targetCamPosRef.current.set(targetX + 16, floorY + 4, targetZ + 18);
        targetLookAtRef.current.set(targetX, floorY, targetZ);
      } else {
        targetCamPosRef.current.set(targetX + 22, midTowerHeight + 6, targetZ + 26);
        targetLookAtRef.current.set(targetX, midTowerHeight, targetZ);
      }
    } else {
      const maxDist = Math.max(...(site?.blocks || []).map(b => Math.hypot(b.posX || 0, b.posZ || 0)), 14);
      const camDist = Math.max(maxDist * 2.1, 36);
      targetCamPosRef.current.set(0, camDist * 0.72, camDist);
      targetLookAtRef.current.set(0, 8, 0);
    }
  }, [site, selectedBlock, selectedFloor]);

  if (webglError) {
    return (
      <IsometricBuildingCanvas
        site={site}
        selectedBlock={selectedBlock}
        onSelectBlock={onSelectBlock}
        selectedFloor={selectedFloor}
        onSelectFloor={onSelectFloor}
        lightingMode={lightingMode}
      />
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {!selectedBlock && hoveredBlockName && (
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: 12,
          padding: '10px 20px',
          color: '#fff',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          pointerEvents: 'none',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8' }} />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
              {hoveredBlockName}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Click tower to zoom in & view floors
            </div>
          </div>
        </div>
      )}

      {selectedBlock && (hoveredFloorNum || selectedFloor) && (
        <div style={{
          position: 'absolute',
          top: 24,
          right: 24,
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1px solid rgba(56, 189, 248, 0.5)',
          borderRadius: 12,
          padding: '12px 18px',
          color: '#fff',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          minWidth: 200
        }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#38bdf8' }}>
            {selectedBlock.name}
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, margin: '2px 0 6px 0', color: '#f8fafc' }}>
            Level {String(hoveredFloorNum || selectedFloor).padStart(2, '0')}
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: '0.78rem' }}>
            <span style={{ color: '#10b981' }}>● Available</span>
            <span style={{ color: '#f59e0b' }}>● In Process</span>
            <span style={{ color: '#ef4444' }}>● Sold</span>
          </div>
        </div>
      )}
    </div>
  );
}
