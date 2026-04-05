"use client";

import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface ProceduralHair3DProps {
  trackingRef: React.RefObject<{
    landmarks: any[],
    matrix: THREE.Matrix4 | null,
    viewport: { vWidth: number, vHeight: number },
    lastUpdateTime: number
  }>;
}

export default function ProceduralHair3D({ trackingRef }: ProceduralHair3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Create 30,000 hair strands parametrically
  const STRAND_COUNT = 30000;
  
  const { positions, colors, scales } = useMemo(() => {
    const pos = new Float32Array(STRAND_COUNT * 3);
    const col = new Float32Array(STRAND_COUNT * 3);
    const sca = new Float32Array(STRAND_COUNT);
    
    // We shape the hair onto a generic skull dome (hemisphere)
    // The sphere radius roughly matches a human head scale when transformed later
    const radius = 1.0; 
    
    const colorA = new THREE.Color(0x1a120e); // Dark brown/black
    const colorB = new THREE.Color(0x2a1e16); // Slightly lighter brown for highlights
    
    for(let i=0; i<STRAND_COUNT; i++) {
        // Distribute points on upper hemisphere using spherical coordinates
        const u = Math.random();
        const v = Math.random();
        
        // theta: angle around Y axis (0 to 2PI)
        const theta = u * 2.0 * Math.PI;
        // phi: angle from top down to equator (0 to PI/2 for upper hemisphere, plus a bit for back of head)
        // We limit it so hair doesn't grow on the face
        const phi = Math.acos(2.0 * v - 1.0);
        
        // Only keep hair on the top, back, and sides. 
        // We skip the front face area (theta around PI/2, depending on orientation)
        // Let's assume Z+ is front face. Theta=0 is X+, Theta=PI/2 is Z+, Theta=PI is X-, Theta=3PI/2 is Z-
        // We want hair mostly on Y > 0 (phi < PI/2) and back of head.
        
        let valid = false;
        if (phi < Math.PI * 0.45) { // Top of head
            valid = true;
        } else if (phi < Math.PI * 0.65) { 
            // Sides and back
            const isFront = Math.sin(theta) > 0.3; // Z is sin(theta) if spherical mapping
            if (!isFront) {
                valid = true;
            }
        }
        
        if (!valid) {
            i--; // Retry this strand
            continue;
        }
        
        // Calculate Cartesian coordinates
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        
        // Apply some noise to positions so it's not a perfect sphere
        const nx = x + (Math.random() - 0.5) * 0.2;
        const ny = y + (Math.random() - 0.5) * 0.2;
        const nz = z + (Math.random() - 0.5) * 0.2;
        
        pos[i*3] = nx;
        pos[i*3+1] = ny;
        pos[i*3+2] = nz;
        
        // Mix colors
        const mixRatio = Math.random();
        const c = colorA.clone().lerp(colorB, mixRatio);
        col[i*3] = c.r;
        col[i*3+1] = c.g;
        col[i*3+2] = c.b;
        
        // Length of hair varying (longer on top, shorter on back/sides)
        const lengthMod = (1.0 - (phi / (Math.PI*0.65))) * 2.0 + 0.5;
        sca[i] = lengthMod;
    }
    
    return { positions: pos, colors: col, scales: sca };
  }, []);

  useFrame(() => {
    const { landmarks, matrix, viewport } = trackingRef.current;
    if (groupRef.current && matrix && landmarks.length > 0) {
        
        // 1. Calculate Head Size and Center
        const leftTemple = landmarks[234];
        const rightTemple = landmarks[454];
        const nose = landmarks[1];
        
        const dx = (rightTemple.x - leftTemple.x) * viewport.vWidth;
        const dy = (rightTemple.y - leftTemple.y) * viewport.vHeight;
        const headWidth = Math.sqrt(dx*dx + dy*dy);
        
        // Calculate cranial center (behind nose, between temples)
        const centerX = (0.5 - ((leftTemple.x + rightTemple.x) / 2)) * viewport.vWidth;
        // The skull center is significantly above the nose/eye line
        const centerY = -((leftTemple.y + rightTemple.y) / 2 - 0.5) * viewport.vHeight + (headWidth * 0.4); 
        const centerZ = -nose.z * 5.0 - (headWidth * 0.5); // Push the center back into the head

        // Apply scale & position
        groupRef.current.position.set(centerX, centerY, centerZ);
        groupRef.current.scale.set(headWidth * 1.8, headWidth * 2.0, headWidth * 1.9);
        
        // Apply rotation from matrix
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scl = new THREE.Vector3();
        matrix.decompose(pos, quat, scl);
        
        // The rotation is directly extracted from MediaPipe
        groupRef.current.quaternion.copy(quat);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Fallback base mesh (skull skin) to prevent seeing through hair gaps */}
      <mesh scale={[0.9, 0.9, 0.9]} position={[0, -0.1, 0]}>
         <sphereGeometry args={[1, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
         <meshStandardMaterial color={0x1a120e} roughness={0.9} />
      </mesh>

      {/* The actual hair strands instantiated for high performance */}
      <points>
        <bufferGeometry>
          <bufferAttribute 
            attach="attributes-position" 
            count={STRAND_COUNT} 
            array={positions} 
            itemSize={3} 
            args={[positions, 3]} 
          />
          <bufferAttribute 
            attach="attributes-color" 
            count={STRAND_COUNT} 
            array={colors} 
            itemSize={3} 
            args={[colors, 3]} 
          />
        </bufferGeometry>
        <pointsMaterial 
          size={0.08} 
          vertexColors={true} 
          sizeAttenuation={true} 
          transparent={true}
          opacity={0.8}
        />
      </points>
    </group>
  );
}
