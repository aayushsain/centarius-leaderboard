document.addEventListener('DOMContentLoaded', () => {
    // Select core DOM elements
    const gameSelector = document.getElementById('game-selector');
    const leaderboardBody = document.getElementById('leaderboard-body');
    const leaderboardTitle = document.getElementById('leaderboard-title');
    const statTotalPlayers = document.getElementById('stat-total-players');
    const statTopScore = document.getElementById('stat-top-score');
    
    const scoreForm = document.getElementById('score-form');
    const inputGameId = document.getElementById('input-game-id');
    const inputPlayerId = document.getElementById('input-player-id');
    const inputDisplayName = document.getElementById('input-display-name');
    const inputScore = document.getElementById('input-score');
    const submitBtn = document.getElementById('submit-btn');

    // Select custom HUD elements
    const hudCoordinates = document.getElementById('hud-coordinates');
    const currentModelTitle = document.getElementById('current-model-title');
    const formTrigger = document.getElementById('form-trigger');
    const actionAccordion = formTrigger.parentElement;
    const btnSpin = document.getElementById('btn-spin');
    const btnGrid = document.getElementById('btn-grid');

    let currentSelectedGame = '';
    let pollingTimeout = null;
    let chartInstance = null; // Chart.js reference

    // Dynamic Holographic Particle Background Configs per Game Arena
    let currentConfig = null;
    let targetConfig = null;

    const bgThemeConfigs = {
        'centarius-run': {
            pColor1: [6, 182, 212, 0.65],
            pColor2: [255, 255, 255, 0.45],
            connColor: [6, 182, 212, 0.25],
            connectionDist: 140,
            speedMultiplier: 2.2,
            gravityStrength: 0.25,
            baseGlow1: [8, 30, 43],
            baseGlow2: [2, 5, 11]
        },
        'space-invaders': {
            pColor1: [217, 70, 239, 0.65],
            pColor2: [16, 185, 129, 0.55],
            connColor: [217, 70, 239, 0.2],
            connectionDist: 100,
            speedMultiplier: 0.9,
            gravityStrength: 0.15,
            baseGlow1: [27, 8, 37],
            baseGlow2: [2, 5, 11]
        },
        'pac-man': {
            pColor1: [251, 191, 36, 0.75],
            pColor2: [59, 130, 246, 0.55],
            connColor: [251, 191, 36, 0.22],
            connectionDist: 110,
            speedMultiplier: 1.3,
            gravityStrength: 0.35,
            baseGlow1: [24, 18, 3],
            baseGlow2: [2, 5, 11]
        },
        'asteroids': {
            pColor1: [16, 185, 129, 0.65],
            pColor2: [148, 163, 184, 0.45],
            connColor: [16, 185, 129, 0.2],
            connectionDist: 130,
            speedMultiplier: 1.6,
            gravityStrength: 0.08,
            baseGlow1: [6, 23, 18],
            baseGlow2: [2, 5, 11]
        },
        'cyber-knight': {
            pColor1: [244, 63, 94, 0.75],
            pColor2: [17, 24, 39, 0.9],
            connColor: [244, 63, 94, 0.25],
            connectionDist: 120,
            speedMultiplier: 0.75,
            gravityStrength: 0.2,
            baseGlow1: [36, 5, 13],
            baseGlow2: [2, 5, 11]
        }
    };

    // Accordion Toggle for submitting a record entry
    formTrigger.addEventListener('click', () => {
        actionAccordion.classList.toggle('open');
    });

    // --------------------------------------------------------------------------
    // Three.js 3D Showcase & Canvas Engine
    // --------------------------------------------------------------------------
    let scene, camera, renderer, characterGroup, gridHelper;
    let clock = new THREE.Clock(); // High-precision frame timing
    let activeCharacter = null;
    let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let animationFrameId = null;

    // Sub-animation references
    let flameLeft = null, flameRight = null; // Centarius Run flames
    let exhaustRings = [];                    // Centarius Run expanding rings
    let bottomJaw = null, topJaw = null;      // Pac-Man jaws
    let ghosts = [];                          // Pac-Man 3D mini-ghosts
    let asteroidScout = null;                 // Asteroids spaceship
    let asteroidDebris = [];                  // Asteroids space debris field
    let cyberVisor = null;                    // Cyber Knight pulsing visor
    let cyberCogs = [];                       // Cyber Knight rotating neck cogs
    let spaceInvaderLegs = [];                // Space Invaders moving limbs
    let spaceShieldDrones = [];               // Space Invaders orbiting drones

    // Smooth dynamic accumulated animation phases (prevents speed jumps when mouse moves)
    let ghostOrbitAngle = 0;
    let droneOrbitAngle = 0;
    let cyberCog1Angle = 0;
    let cyberCog2Angle = 0;
    let cyberVisorPhase = 0;
    let pacmanBitePhase = 0;
    let spinOffset = { y: 0, positionY: 0 };

    // Dynamic Holographic Live Particle Background Canvas Animation
    function initLiveBg() {
        const bgCanvas = document.getElementById('live-bg-canvas');
        if (!bgCanvas) return;
        const bgCtx = bgCanvas.getContext('2d');
        let width = (bgCanvas.width = window.innerWidth);
        let height = (bgCanvas.height = window.innerHeight);

        const particles = [];
        const particleCount = 75;
        let globalMouse = { x: width / 2, y: height / 2, active: false };

        // Initialize default config references
        currentConfig = JSON.parse(JSON.stringify(bgThemeConfigs['centarius-run']));
        targetConfig = bgThemeConfigs['centarius-run'];

        function lerp(start, end, amt) {
            return (1 - amt) * start + amt * end;
        }

        function lerpArray(start, end, amt) {
            return start.map((s, i) => lerp(s, end[i], amt));
        }

        // Handle Resizing
        window.addEventListener('resize', () => {
            width = (bgCanvas.width = window.innerWidth);
            height = (bgCanvas.height = window.innerHeight);
        });

        // Mouse tracking for parallax network warp
        window.addEventListener('mousemove', (e) => {
            globalMouse.x = e.clientX;
            globalMouse.y = e.clientY;
            globalMouse.active = true;
        });

        window.addEventListener('mouseleave', () => {
            globalMouse.active = false;
        });

        // Initialize particle array
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 1.5 + 0.5,
                colorType: Math.random() > 0.5 ? 0 : 1,
                opacityFactor: Math.random() * 0.6 + 0.4
            });
        }

        // Draw and update particle loop
        function drawBg() {
            bgCtx.clearRect(0, 0, width, height);

            // Interpolate config options smoothly
            const lerpSpeed = 0.05;
            if (currentConfig && targetConfig) {
                currentConfig.connectionDist = lerp(currentConfig.connectionDist, targetConfig.connectionDist, lerpSpeed);
                currentConfig.speedMultiplier = lerp(currentConfig.speedMultiplier, targetConfig.speedMultiplier, lerpSpeed);
                currentConfig.gravityStrength = lerp(currentConfig.gravityStrength, targetConfig.gravityStrength, lerpSpeed);
                currentConfig.pColor1 = lerpArray(currentConfig.pColor1, targetConfig.pColor1, lerpSpeed);
                currentConfig.pColor2 = lerpArray(currentConfig.pColor2, targetConfig.pColor2, lerpSpeed);
                currentConfig.connColor = lerpArray(currentConfig.connColor, targetConfig.connColor, lerpSpeed);
                currentConfig.baseGlow1 = lerpArray(currentConfig.baseGlow1, targetConfig.baseGlow1, lerpSpeed);
                currentConfig.baseGlow2 = lerpArray(currentConfig.baseGlow2, targetConfig.baseGlow2, lerpSpeed);
            }

            // Subtle base glow in the center
            const gradient = bgCtx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, Math.max(width, height));
            const cGlow1 = `rgb(${Math.round(currentConfig.baseGlow1[0])}, ${Math.round(currentConfig.baseGlow1[1])}, ${Math.round(currentConfig.baseGlow1[2])})`;
            const cGlow2 = `rgb(${Math.round(currentConfig.baseGlow2[0])}, ${Math.round(currentConfig.baseGlow2[1])}, ${Math.round(currentConfig.baseGlow2[2])})`;
            gradient.addColorStop(0, cGlow1);
            gradient.addColorStop(1, cGlow2);
            bgCtx.fillStyle = gradient;
            bgCtx.fillRect(0, 0, width, height);

            // Draw drifting matrix grid lines
            for (let i = 0; i < particleCount; i++) {
                const p1 = particles[i];
                p1.x += p1.vx * currentConfig.speedMultiplier;
                p1.y += p1.vy * currentConfig.speedMultiplier;

                // Bounce walls gently
                if (p1.x < 0 || p1.x > width) p1.vx *= -1;
                if (p1.y < 0 || p1.y > height) p1.vy *= -1;

                // Gentle mouse warp/gravity drift
                if (globalMouse.active) {
                    const dx = globalMouse.x - p1.x;
                    const dy = globalMouse.y - p1.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 220) {
                        // Soft attraction
                        p1.x += (dx / dist) * currentConfig.gravityStrength;
                        p1.y += (dy / dist) * currentConfig.gravityStrength;
                    }
                }

                // Draw node
                bgCtx.beginPath();
                bgCtx.arc(p1.x, p1.y, p1.r, 0, Math.PI * 2);
                
                const cColor = p1.colorType === 0 ? currentConfig.pColor1 : currentConfig.pColor2;
                bgCtx.fillStyle = `rgba(${Math.round(cColor[0])}, ${Math.round(cColor[1])}, ${Math.round(cColor[2])}, ${cColor[3] * p1.opacityFactor})`;
                bgCtx.fill();

                // Draw connections
                const connDist = currentConfig.connectionDist;
                for (let j = i + 1; j < particleCount; j++) {
                    const p2 = particles[j];
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < connDist) {
                        const alpha = (1 - dist / connDist) * currentConfig.connColor[3];
                        bgCtx.beginPath();
                        bgCtx.moveTo(p1.x, p1.y);
                        bgCtx.lineTo(p2.x, p2.y);
                        bgCtx.strokeStyle = `rgba(${Math.round(currentConfig.connColor[0])}, ${Math.round(currentConfig.connColor[1])}, ${Math.round(currentConfig.connColor[2])}, ${alpha})`;
                        bgCtx.lineWidth = 0.5;
                        bgCtx.stroke();
                    }
                }
            }

            // Draw interactive pointer HUD reticle, lock-on details, & bracket frames
            if (globalMouse.active) {
                let nearestPart = null;
                let minDist = 120;
                for (let i = 0; i < particleCount; i++) {
                    const p = particles[i];
                    const dx = globalMouse.x - p.x;
                    const dy = globalMouse.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestPart = p;
                    }
                }

                if (nearestPart) {
                    bgCtx.beginPath();
                    bgCtx.moveTo(globalMouse.x, globalMouse.y);
                    bgCtx.lineTo(nearestPart.x, nearestPart.y);
                    bgCtx.strokeStyle = `rgba(${Math.round(currentConfig.pColor1[0])}, ${Math.round(currentConfig.pColor1[1])}, ${Math.round(currentConfig.pColor1[2])}, 0.35)`;
                    bgCtx.lineWidth = 0.8;
                    bgCtx.setLineDash([3, 3]);
                    bgCtx.stroke();
                    bgCtx.setLineDash([]);

                    bgCtx.beginPath();
                    bgCtx.arc(nearestPart.x, nearestPart.y, nearestPart.r + 5, 0, Math.PI * 2);
                    bgCtx.strokeStyle = `rgba(${Math.round(currentConfig.pColor1[0])}, ${Math.round(currentConfig.pColor1[1])}, ${Math.round(currentConfig.pColor1[2])}, 0.5)`;
                    bgCtx.lineWidth = 1;
                    bgCtx.stroke();

                    bgCtx.font = "italic 700 8px 'Space Mono'";
                    bgCtx.fillStyle = `rgba(${Math.round(currentConfig.pColor1[0])}, ${Math.round(currentConfig.pColor1[1])}, ${Math.round(currentConfig.pColor1[2])}, 0.85)`;
                    bgCtx.fillText(`LOCK // NODE_ID: ${Math.round(nearestPart.x)}.${Math.round(nearestPart.y)}`, globalMouse.x + 12, globalMouse.y - 4);
                    bgCtx.fillText(`DIST // VAL: ${Math.round(minDist)}px`, globalMouse.x + 12, globalMouse.y + 6);
                }

                const retSize = 6;
                bgCtx.beginPath();
                bgCtx.moveTo(globalMouse.x - retSize, globalMouse.y);
                bgCtx.lineTo(globalMouse.x + retSize, globalMouse.y);
                bgCtx.moveTo(globalMouse.x, globalMouse.y - retSize);
                bgCtx.lineTo(globalMouse.x, globalMouse.y + retSize);
                bgCtx.strokeStyle = `rgba(${Math.round(currentConfig.pColor1[0])}, ${Math.round(currentConfig.pColor1[1])}, ${Math.round(currentConfig.pColor1[2])}, 0.5)`;
                bgCtx.lineWidth = 1.2;
                bgCtx.stroke();

                const brSize = 12;
                bgCtx.strokeStyle = `rgba(${Math.round(currentConfig.pColor2[0])}, ${Math.round(currentConfig.pColor2[1])}, ${Math.round(currentConfig.pColor2[2])}, 0.4)`;
                bgCtx.lineWidth = 1;
                
                bgCtx.beginPath();
                bgCtx.moveTo(globalMouse.x - brSize, globalMouse.y - brSize + 4);
                bgCtx.lineTo(globalMouse.x - brSize, globalMouse.y - brSize);
                bgCtx.lineTo(globalMouse.x - brSize + 4, globalMouse.y - brSize);
                bgCtx.stroke();
                
                bgCtx.beginPath();
                bgCtx.moveTo(globalMouse.x + brSize, globalMouse.y - brSize + 4);
                bgCtx.lineTo(globalMouse.x + brSize, globalMouse.y - brSize);
                bgCtx.lineTo(globalMouse.x + brSize - 4, globalMouse.y - brSize);
                bgCtx.stroke();

                bgCtx.beginPath();
                bgCtx.moveTo(globalMouse.x - brSize, globalMouse.y + brSize - 4);
                bgCtx.lineTo(globalMouse.x - brSize, globalMouse.y + brSize);
                bgCtx.lineTo(globalMouse.x - brSize + 4, globalMouse.y + brSize);
                bgCtx.stroke();

                bgCtx.beginPath();
                bgCtx.moveTo(globalMouse.x + brSize, globalMouse.y + brSize - 4);
                bgCtx.lineTo(globalMouse.x + brSize, globalMouse.y + brSize);
                bgCtx.lineTo(globalMouse.x + brSize - 4, globalMouse.y + brSize);
                bgCtx.stroke();
            }

            requestAnimationFrame(drawBg);
        }

        drawBg();
    }

    function initThree() {
        const container = document.querySelector('.stage-container');
        const canvas = document.getElementById('three-canvas');
        if (!canvas) return;

        // Initialize Scene
        scene = new THREE.Scene();
        scene.background = null;

        // Initialize Camera
        camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 0.4, 5);

        // Initialize Renderer with high-fidelity soft shadow maps
        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Add Elegant Studio Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

        // Key Directional Light for crisp metallic shadow structures
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
        dirLight.position.set(4, 8, 4);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 512; // Optimized from 1024 for buttery performance
        dirLight.shadow.mapSize.height = 512; // Optimized from 1024
        dirLight.shadow.bias = -0.001;
        scene.add(dirLight);

        // Color Rim Light to generate high-tech metallic reflections
        const blueRimLight = new THREE.PointLight(0x3b82f6, 0.8, 12);
        blueRimLight.position.set(-4, 2, -4);
        scene.add(blueRimLight);

        const pinkRimLight = new THREE.PointLight(0xd946ef, 0.6, 12);
        pinkRimLight.position.set(4, -2, -4);
        scene.add(pinkRimLight);

        // Create Main Floating Character Group
        characterGroup = new THREE.Group();
        scene.add(characterGroup);

        // Ground Plane receiver for soft shadows
        const shadowPlaneGeom = new THREE.PlaneGeometry(15, 15);
        const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.05 });
        const shadowPlane = new THREE.Mesh(shadowPlaneGeom, shadowPlaneMat);
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = -1.55;
        shadowPlane.receiveShadow = true;
        scene.add(shadowPlane);

        // Minimalist Coordinate Grid Floor
        gridHelper = new THREE.GridHelper(10, 20, 0x0f172a, 0x0f172a);
        gridHelper.position.y = -1.55;
        gridHelper.material.opacity = 0.06;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);

        // Resize Listener
        window.addEventListener('resize', onWindowResize);

        // Mouse Parallax movement tracking
        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('mouseleave', () => {
            mouse.targetX = 0;
            mouse.targetY = 0;
        });

        // Initialize Render/Animation Loop
        animate();

        // Trigger Vanilla-Tilt on components
        initVanillaTilt();
    }

    function onWindowResize() {
        const container = document.querySelector('.stage-container');
        if (!container || !camera || !renderer) return;

        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();

        renderer.setSize(container.clientWidth, container.clientHeight);

        // Responsive adjustment on screen resize
        adjustModelScaleForScreen();
    }

    function adjustModelScaleForScreen() {
        if (!characterGroup || !activeCharacter) return;
        const w = window.innerWidth;
        if (w < 768) {
            activeCharacter.scale.set(0.65, 0.65, 0.65);
            camera.position.z = 5.6;
        } else if (w < 1024) {
            activeCharacter.scale.set(0.85, 0.85, 0.85);
            camera.position.z = 5.2;
        } else {
            activeCharacter.scale.set(1.1, 1.1, 1.1);
            camera.position.z = 5.0;
        }
    }

    function onMouseMove(event) {
        const container = document.querySelector('.stage-container');
        const rect = container.getBoundingClientRect();
        
        const x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        const y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
        
        mouse.targetX = x * 0.5;
        mouse.targetY = y * 0.4;

        hudCoordinates.textContent = `X: ${x.toFixed(2)} Y: ${y.toFixed(2)}`;
    }

    function initVanillaTilt() {
        if (window.VanillaTilt) {
            VanillaTilt.init(document.querySelectorAll("[data-tilt]"), {
                max: 6,
                speed: 800,
                glare: true,
                "max-glare": 0.2, // Enhanced premium foil glare sheen
            });
        }
    }

    // Cybernetic Text Shuffle (Glitch) Animation for gaming titles & metrics
    function shuffleText(element, duration = 600) {
        if (element.dataset.shuffling === "true") return;
        element.dataset.shuffling = "true";
        
        const originalText = element.textContent;
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*_+=";
        const startTime = performance.now();
        
        function update(time) {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            let currentText = "";
            for (let i = 0; i < originalText.length; i++) {
                if (originalText[i] === " " || originalText[i] === "/" || originalText[i] === " ") {
                    currentText += originalText[i];
                    continue;
                }
                const threshold = progress * originalText.length;
                if (i < threshold) {
                    currentText += originalText[i];
                } else {
                    currentText += chars[Math.floor(Math.random() * chars.length)];
                }
            }
            element.textContent = currentText;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = originalText;
                element.dataset.shuffling = "false";
            }
        }
        
        requestAnimationFrame(update);
    }

    function initShuffleText() {
        const shuffleTargets = document.querySelectorAll('[data-shuffle], .brand h1, .panel h2, .panel-header h2, .stat-val');
        shuffleTargets.forEach(target => {
            target.addEventListener('mouseenter', () => {
                shuffleText(target, 500);
            });
        });
    }

    // --------------------------------------------------------------------------
    // Hyper-Detailed Procedural Character Factories
    // --------------------------------------------------------------------------
    const charFactories = {
        'centarius-run': () => {
            const group = new THREE.Group();

            // 1. Valkyrie Fuselage Complex (Obsidian alloy core)
            const bodyGeom = new THREE.CylinderGeometry(0.01, 0.35, 1.6, 32);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.98, roughness: 0.05 });
            const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
            bodyMesh.rotation.x = Math.PI / 2;
            bodyMesh.castShadow = true;
            group.add(bodyMesh);

            // 2. Swept forward advanced main delta wings
            const wingGeom = new THREE.BoxGeometry(1.95, 0.03, 0.65);
            const wingMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, metalness: 0.8, roughness: 0.1 });
            const wingMesh = new THREE.Mesh(wingGeom, wingMat);
            wingMesh.position.set(0, -0.05, -0.15);
            wingMesh.rotation.y = 0.05; // slight dihedral sweep
            wingMesh.castShadow = true;
            group.add(wingMesh);

            // Forward swept nose canards
            const canardGeom = new THREE.BoxGeometry(0.65, 0.02, 0.16);
            const leftCanard = new THREE.Mesh(canardGeom, wingMat);
            leftCanard.position.set(-0.25, 0.1, 0.45);
            leftCanard.rotation.y = 0.25;
            leftCanard.rotation.z = 0.1;
            group.add(leftCanard);
            
            const rightCanard = leftCanard.clone();
            rightCanard.position.x = 0.25;
            rightCanard.rotation.y = -0.25;
            rightCanard.rotation.z = -0.1;
            group.add(rightCanard);

            // 3. Glowing central quantum stabilizer ring (Torus)
            const stabRingGeom = new THREE.TorusGeometry(0.42, 0.022, 16, 64);
            const stabRingMat = new THREE.MeshStandardMaterial({ 
                color: 0x06b6d4, 
                emissive: 0x06b6d4, 
                emissiveIntensity: 3.0, 
                roughness: 0.1 
            });
            const stabRing = new THREE.Mesh(stabRingGeom, stabRingMat);
            stabRing.position.set(0, 0.1, -0.25);
            group.add(stabRing);

            // 4. Wingtips glowing quantum lasers
            const laserGeom = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 16);
            const laserMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.9 });
            const lTip = new THREE.Mesh(laserGeom, laserMat);
            lTip.position.set(-0.95, -0.05, -0.1);
            lTip.rotation.x = Math.PI / 2;
            
            // glowing laser core tip
            const coreGeom = new THREE.SphereGeometry(0.035, 16, 16);
            const coreMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
            const lCore = new THREE.Mesh(coreGeom, coreMat);
            lCore.position.set(0, 0.22, 0);
            lTip.add(lCore);
            group.add(lTip);

            const rTip = lTip.clone();
            rTip.position.x = 0.95;
            group.add(rTip);

            // Glowing cockpit canopy dome (High physical transmission)
            const glassGeom = new THREE.SphereGeometry(0.14, 32, 32);
            const glassMat = new THREE.MeshPhysicalMaterial({ 
                color: 0x06b6d4, 
                roughness: 0.05, 
                metalness: 0.95, 
                transmission: 0.75,
                thickness: 0.25,
                clearcoat: 1.0
            });
            const glassMesh = new THREE.Mesh(glassGeom, glassMat);
            glassMesh.position.set(0, 0.15, 0.22);
            glassMesh.scale.set(1, 0.7, 2.3);
            group.add(glassMesh);

            // Dual Thruster nozzles
            const engineGeom = new THREE.CylinderGeometry(0.11, 0.13, 0.45, 32);
            const engineMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.95, roughness: 0.15 });
            
            const leftEng = new THREE.Mesh(engineGeom, engineMat);
            leftEng.position.set(-0.18, -0.05, -0.8);
            leftEng.rotation.x = Math.PI / 2;
            group.add(leftEng);

            const rightEng = leftEng.clone();
            rightEng.position.x = 0.18;
            group.add(rightEng);

            // Active engine combustion flames
            const flameGeom = new THREE.ConeGeometry(0.065, 0.5, 16);
            const flameMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
            
            flameLeft = new THREE.Mesh(flameGeom, flameMat);
            flameLeft.position.set(-0.18, -0.05, -1.15);
            flameLeft.rotation.x = -Math.PI / 2;
            group.add(flameLeft);

            flameRight = flameLeft.clone();
            flameRight.position.x = 0.18;
            group.add(flameRight);

            // Expanding Plasma Exhaust Rings
            exhaustRings = [];
            const ringGeom = new THREE.TorusGeometry(0.12, 0.015, 16, 48);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.8 });
            
            for (let i = 0; i < 4; i++) {
                const ring = new THREE.Mesh(ringGeom, ringMat.clone());
                ring.position.set(0, -0.05, -0.8 - (i * 0.25));
                ring.rotation.x = Math.PI / 2;
                ring.scale.set(0.2, 0.2, 0.2);
                group.add(ring);
                exhaustRings.push(ring);
            }

            group.position.y = 0.2;
            return group;
        },

        'space-invaders': () => {
            const group = new THREE.Group();

            // 1. Sleek robotic core chassis (Hexagonal sphere)
            const coreGeom = new THREE.SphereGeometry(0.68, 6, 6); // low polygon cyber look
            const coreMat = new THREE.MeshStandardMaterial({ 
                color: 0xd946ef, 
                metalness: 0.95, 
                roughness: 0.08,
                emissive: 0xd946ef,
                emissiveIntensity: 0.1
            });
            const chassis = new THREE.Mesh(coreGeom, coreMat);
            chassis.scale.set(1.1, 0.8, 1);
            chassis.castShadow = true;
            group.add(chassis);

            // Secondary side armor plates
            const plateGeom = new THREE.BoxGeometry(0.3, 0.5, 0.45);
            const plateMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.9, roughness: 0.1 });
            const leftPlate = new THREE.Mesh(plateGeom, plateMat);
            leftPlate.position.set(-0.65, 0, 0);
            leftPlate.rotation.z = 0.15;
            group.add(leftPlate);

            const rightPlate = leftPlate.clone();
            rightPlate.position.x = 0.65;
            rightPlate.rotation.z = -0.15;
            group.add(rightPlate);

            // 2. Twin glowing side rail blasters
            const barrelGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 16);
            const barrelMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.95 });
            const leftGun = new THREE.Mesh(barrelGeom, barrelMat);
            leftGun.position.set(-0.55, -0.1, 0.25);
            leftGun.rotation.x = Math.PI / 2;
            
            const muzzleCore = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
            muzzleCore.position.set(0, 0.32, 0);
            leftGun.add(muzzleCore);
            group.add(leftGun);

            const rightGun = leftGun.clone();
            rightGun.position.x = 0.55;
            group.add(rightGun);

            // 3. Central horizontal pulsing visor
            const visorGeom = new THREE.BoxGeometry(0.68, 0.08, 0.24);
            const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
            const visor = new THREE.Mesh(visorGeom, visorMat);
            visor.position.set(0, 0.15, 0.52);
            group.add(visor);

            // 4. Four jointed moving insectoid spider legs wiggling dynamically!
            spaceInvaderLegs = [];
            
            // Leg configurations: [x_sign, z_offset, rotation_y]
            const legConfigs = [
                { x: -1, z: 0.2, ry: 0.4 },
                { x: 1, z: 0.2, ry: -0.4 },
                { x: -1, z: -0.2, ry: -0.4 },
                { x: 1, z: -0.2, ry: 0.4 }
            ];

            const jointMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.95 });
            const limbMat = new THREE.MeshStandardMaterial({ color: 0xd946ef, metalness: 0.8, roughness: 0.1 });

            legConfigs.forEach((cfg, idx) => {
                const legGroup = new THREE.Group();
                legGroup.position.set(cfg.x * 0.58, -0.2, cfg.z);
                legGroup.rotation.y = cfg.ry;

                // Thigh
                const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.4, 16), limbMat);
                thigh.position.set(cfg.x * 0.16, -0.1, 0);
                thigh.rotation.z = cfg.x * 0.5; // angled down
                legGroup.add(thigh);

                // Knee joint
                const knee = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), jointMat);
                knee.position.set(cfg.x * 0.32, -0.2, 0);
                legGroup.add(knee);

                // Calf / Claw tip
                const claw = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.38, 16), jointMat);
                claw.position.set(cfg.x * 0.4, -0.36, 0);
                claw.rotation.z = -cfg.x * 0.4;
                legGroup.add(claw);

                group.add(legGroup);
                // Push joint/claw nodes to legs collection so they wiggle in the animate tick!
                spaceInvaderLegs.push(legGroup);
            });

            // 5. Double Orbiting Quantum Shield Drones (Orbital satellite nodes)
            spaceShieldDrones = [];
            const droneGeom = new THREE.SphereGeometry(0.09, 24, 24);
            const droneMat = new THREE.MeshStandardMaterial({ 
                color: 0x00f0ff, 
                emissive: 0x00f0ff, 
                emissiveIntensity: 1.5, 
                metalness: 0.95 
            });
            
            // Add custom outer sensor ring to each drone to look ultra high-end!
            const sensorRingGeom = new THREE.TorusGeometry(0.14, 0.008, 8, 32);
            const sensorRingMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.9 });

            for (let i = 0; i < 2; i++) {
                const droneGroup = new THREE.Group();
                const sphere = new THREE.Mesh(droneGeom, droneMat);
                sphere.castShadow = true;
                droneGroup.add(sphere);

                const ring = new THREE.Mesh(sensorRingGeom, sensorRingMat);
                ring.rotation.x = Math.PI / 2;
                droneGroup.add(ring);

                group.add(droneGroup);
                spaceShieldDrones.push(droneGroup);
            }

            group.scale.set(1.2, 1.2, 1.2);
            group.position.y = 0.2;
            return group;
        },

        'pac-man': () => {
            const group = new THREE.Group();

            // Mecha Chrome-Gold split shell
            const shellMat = new THREE.MeshStandardMaterial({ 
                color: 0xfbbf24, 
                roughness: 0.08, 
                metalness: 0.98 
            });

            const topGroup = new THREE.Group();
            const bottomGroup = new THREE.Group();

            // Segmented mecha jaw spheres
            const jawGeom = new THREE.SphereGeometry(0.85, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2);
            
            const topMesh = new THREE.Mesh(jawGeom, shellMat);
            topMesh.rotation.x = -Math.PI / 2;
            topMesh.castShadow = true;
            topGroup.add(topMesh);

            const botMesh = new THREE.Mesh(jawGeom, shellMat);
            botMesh.rotation.x = Math.PI / 2;
            botMesh.castShadow = true;
            bottomGroup.add(botMesh);

            // Back cyber exhaust vent pipes (Dual exhaust pipes venting steam/neon blue smoke)
            const ventGeom = new THREE.CylinderGeometry(0.08, 0.09, 0.35, 16);
            const ventMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.95, roughness: 0.1 });
            const leftVent = new THREE.Mesh(ventGeom, ventMat);
            leftVent.position.set(-0.35, 0.25, -0.68);
            leftVent.rotation.x = -Math.PI / 3;
            
            // glowing exhaust core
            const exhaustCore = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), new THREE.MeshBasicMaterial({ color: 0x00f0ff }));
            exhaustCore.position.set(0, 0.18, 0);
            leftVent.add(exhaustCore);
            topGroup.add(leftVent);

            const rightVent = leftVent.clone();
            rightVent.position.x = 0.35;
            topGroup.add(rightVent);

            // Circular mecha trim lines
            const panelGeom = new THREE.TorusGeometry(0.86, 0.015, 12, 64);
            const panelMat = new THREE.MeshStandardMaterial({ color: 0x090d16 });
            const circuit = new THREE.Mesh(panelGeom, panelMat);
            circuit.rotation.y = Math.PI / 2;
            topGroup.add(circuit);

            // Glowing central laser visors (High tech mecha eye)
            const eyeGeom = new THREE.BoxGeometry(0.12, 0.12, 0.18);
            const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
            
            const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
            leftEye.position.set(-0.45, 0.35, 0.58);
            leftEye.rotation.set(0.2, -0.4, 0);
            topGroup.add(leftEye);

            const rightEye = leftEye.clone();
            rightEye.position.x = 0.45;
            rightEye.rotation.y = 0.4;
            topGroup.add(rightEye);

            // Smooth glowing Reactor Core in the center
            const coreGeom = new THREE.SphereGeometry(0.25, 32, 32);
            const coreMat = new THREE.MeshStandardMaterial({ 
                color: 0x00f0ff, 
                emissive: 0x00f0ff, 
                emissiveIntensity: 2.0 
            });
            const core = new THREE.Mesh(coreGeom, coreMat);
            core.position.set(0, 0, 0.05);
            group.add(core);

            // Inside complex gear rings
            const gearGeom = new THREE.TorusGeometry(0.48, 0.025, 8, 32);
            const gearMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.95 });
            const innerGear = new THREE.Mesh(gearGeom, gearMat);
            innerGear.rotation.y = Math.PI / 2;
            group.add(innerGear);

            group.add(topGroup);
            group.add(bottomGroup);

            topJaw = topGroup;
            bottomJaw = bottomGroup;

            // Translucent glowing comets 3D Ghosts
            ghosts = [];
            const ghostColors = [0xf43f5e, 0x06b6d4]; // Magenta vs Cyan
            
            ghostColors.forEach((color, i) => {
                const ghostGroup = new THREE.Group();

                // Sleek capsule head
                const gHeadGeom = new THREE.SphereGeometry(0.18, 32, 32);
                const gMat = new THREE.MeshStandardMaterial({ 
                    color: color, 
                    emissive: color, 
                    emissiveIntensity: 1.5, 
                    transparent: true, 
                    opacity: 0.85,
                    metalness: 0.8,
                    roughness: 0.05
                });
                const head = new THREE.Mesh(gHeadGeom, gMat);
                ghostGroup.add(head);

                // Comet trailing exhaust ring
                const trailGeom = new THREE.TorusGeometry(0.16, 0.01, 8, 32);
                const trailMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.35 });
                
                const trail1 = new THREE.Mesh(trailGeom, trailMat);
                trail1.position.set(0, 0, -0.2);
                ghostGroup.add(trail1);
                
                const trail2 = trail1.clone();
                trail2.position.set(0, 0, -0.38);
                trail2.scale.set(0.7, 0.7, 0.7);
                ghostGroup.add(trail2);

                // High tech visor eye
                const gEyeGeom = new THREE.BoxGeometry(0.15, 0.04, 0.1);
                const gEyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const lEye = new THREE.Mesh(gEyeGeom, gEyeMat);
                lEye.position.set(0, 0.04, 0.12);
                ghostGroup.add(lEye);

                group.add(ghostGroup);
                ghosts.push(ghostGroup);
            });

            return group;
        },

        'asteroids': () => {
            const group = new THREE.Group();

            // 1. Advanced Obsidian Crystal Asteroid
            const geom = new THREE.IcosahedronGeometry(0.85, 3);
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x090d16, 
                flatShading: false,
                roughness: 0.15,     // glossy volcanic obsidian
                metalness: 0.95      // high reflection
            });

            const pos = geom.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                let x = pos.getX(i);
                let y = pos.getY(i);
                let z = pos.getZ(i);

                const offset = 1.0 + (Math.sin(x * 5.0) * Math.cos(y * 5.0) * Math.sin(z * 5.0)) * 0.22;
                pos.setX(i, x * offset);
                pos.setY(i, y * offset);
                pos.setZ(i, z * offset);
            }
            geom.computeVertexNormals();

            const asteroid = new THREE.Mesh(geom, mat);
            asteroid.castShadow = true;
            asteroid.receiveShadow = true;
            group.add(asteroid);

            // 2. High tech glowing Emerald Mining Crystals
            const crystalGeom = new THREE.ConeGeometry(0.11, 0.38, 5); // Sharp octahedral mineral shape
            const crystalMat = new THREE.MeshStandardMaterial({ 
                color: 0x10b981, 
                emissive: 0x10b981, 
                emissiveIntensity: 2.2, 
                roughness: 0.02,
                metalness: 0.98
            });

            const crystalPositions = [
                { p: [0.65, 0.45, 0.4], r: [0.2, 0.4, 0.6] },
                { p: [-0.68, -0.35, 0.45], r: [0.5, -0.2, 0.1] },
                { p: [0.1, -0.74, -0.5], r: [-0.6, 0.1, -0.4] },
                { p: [-0.2, 0.74, -0.4], r: [0.3, 0.5, 0.9] }
            ];

            crystalPositions.forEach(pos => {
                const crystal = new THREE.Mesh(crystalGeom, crystalMat);
                crystal.position.set(pos.p[0], pos.p[1], pos.p[2]);
                crystal.rotation.set(pos.r[0], pos.r[1], pos.r[2]);
                group.add(crystal);
            });

            // 3. Advanced Mineral Extraction Spaceship
            const scoutGroup = new THREE.Group();

            const scoutBodyGeom = new THREE.CylinderGeometry(0.01, 0.09, 0.38, 16);
            const scoutMat = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, metalness: 0.9, roughness: 0.1 });
            const scoutBody = new THREE.Mesh(scoutBodyGeom, scoutMat);
            scoutBody.rotation.x = Math.PI / 2;
            scoutGroup.add(scoutBody);

            // Twin solar panel wings on scout
            const sWingGeom = new THREE.BoxGeometry(0.38, 0.01, 0.12);
            const sWingMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 1.0 });
            const leftSolar = new THREE.Mesh(sWingGeom, sWingMat);
            leftSolar.position.set(-0.16, 0, 0);
            scoutGroup.add(leftSolar);

            const rightSolar = leftSolar.clone();
            rightSolar.position.x = 0.16;
            scoutGroup.add(rightSolar);

            // Twin engine exhaust glows
            const sFlameGeom = new THREE.ConeGeometry(0.02, 0.12, 16);
            const sFlameMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
            const sFlame = new THREE.Mesh(sFlameGeom, sFlameMat);
            sFlame.position.set(0, 0, -0.22);
            sFlame.rotation.x = -Math.PI / 2;
            scoutGroup.add(sFlame);

            group.add(scoutGroup);
            asteroidScout = scoutGroup; // Bind reference for animations

            // 4. Emerald Mineral Extraction Laser Beam!
            // Connects the scout ship nose directly to the mining crystals!
            const laserGeom = new THREE.CylinderGeometry(0.012, 0.012, 1.35, 16);
            const laserMat = new THREE.MeshBasicMaterial({ 
                color: 0x10b981, 
                transparent: true, 
                opacity: 0.6,
                depthWrite: false
            });
            const beam = new THREE.Mesh(laserGeom, laserMat);
            // Orient and position beam so it goes forward from nose
            beam.position.set(0, 0, 0.68);
            beam.rotation.x = Math.PI / 2;
            scoutGroup.add(beam);

            // 5. Orbiting digital debris field
            asteroidDebris = [];
            const debGeom = new THREE.IcosahedronGeometry(0.038, 1);
            const debMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7, roughness: 0.2 });
            
            for (let i = 0; i < 15; i++) {
                const particle = new THREE.Mesh(debGeom, debMat);
                particle.userData = {
                    radius: 1.2 + Math.random() * 0.45,
                    speed: 0.35 + Math.random() * 0.75,
                    phase: Math.random() * Math.PI * 2,
                    offsetY: (Math.random() - 0.5) * 0.6
                };
                group.add(particle);
                asteroidDebris.push(particle);
            }

            return group;
        },

        'cyber-knight': () => {
            const group = new THREE.Group();

            // 1. Sleek Obsidian Helmet Core
            const domeGeom = new THREE.SphereGeometry(0.72, 64, 64);
            const domeMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.98, roughness: 0.05 });
            const helmet = new THREE.Mesh(domeGeom, domeMat);
            helmet.castShadow = true;
            group.add(helmet);

            // 2. Translucent red high-fidelity HUD Visor
            const visorGeom = new THREE.BoxGeometry(0.92, 0.16, 0.48);
            const visorMat = new THREE.MeshPhysicalMaterial({ 
                color: 0xf43f5e, 
                emissive: 0xf43f5e, 
                emissiveIntensity: 1.8,
                roughness: 0.05, 
                metalness: 0.9,
                transmission: 0.4,
                thickness: 0.1
            });
            cyberVisor = new THREE.Mesh(visorGeom, visorMat);
            cyberVisor.position.set(0, 0.1, 0.55);
            group.add(cyberVisor);

            // 3. Left & Right Curved Shoulder Pauldrons (Shield plates)
            const shGeom = new THREE.SphereGeometry(0.38, 32, 16, 0, Math.PI, 0, Math.PI);
            const shMat = new THREE.MeshStandardMaterial({ color: 0x090d16, metalness: 0.95, roughness: 0.08 });
            
            const leftPauldron = new THREE.Mesh(shGeom, shMat);
            leftPauldron.position.set(-0.85, -0.65, 0);
            leftPauldron.rotation.set(0, 0, -0.6);
            group.add(leftPauldron);

            const rightPauldron = leftPauldron.clone();
            rightPauldron.position.x = 0.85;
            rightPauldron.rotation.z = 0.6;
            group.add(rightPauldron);

            // 4. Face respirator grill panel
            const grillGeom = new THREE.BoxGeometry(0.24, 0.35, 0.2);
            const grillMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
            const respirator = new THREE.Mesh(grillGeom, grillMat);
            respirator.position.set(0, -0.28, 0.52);
            respirator.rotation.x = -0.15;
            group.add(respirator);

            // Tactical cheek plates
            const plateGeom = new THREE.BoxGeometry(0.18, 0.44, 0.68);
            const plateMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
            
            const leftCheek = new THREE.Mesh(plateGeom, plateMat);
            leftCheek.position.set(-0.6, -0.22, 0.2);
            leftCheek.rotation.y = 0.28;
            group.add(leftCheek);

            const rightCheek = leftCheek.clone();
            rightCheek.position.x = 0.6;
            rightCheek.rotation.y = -0.28;
            group.add(rightCheek);

            // 5. Neck cogs
            cyberCogs = [];
            const cogGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.1, 32);
            const cogMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.95, roughness: 0.3 });
            
            const cog1 = new THREE.Mesh(cogGeom, cogMat);
            cog1.position.set(0, -0.76, 0);
            group.add(cog1);
            cyberCogs.push(cog1);

            const cog2 = cog1.clone();
            cog2.position.y = -0.88;
            cog2.scale.set(0.8, 1, 0.8);
            group.add(cog2);
            cyberCogs.push(cog2);

            // 6. Tactical Horns with Glowing Energy Halos!
            const hornGeom = new THREE.ConeGeometry(0.08, 0.45, 32);
            const leftHorn = new THREE.Mesh(hornGeom, plateMat);
            leftHorn.position.set(-0.35, 0.62, 0.1);
            leftHorn.rotation.set(-0.2, 0, -0.4);
            leftHorn.castShadow = true;
            
            // Halo on left horn
            const haloGeom = new THREE.TorusGeometry(0.12, 0.015, 8, 32);
            const haloMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e }); // glowing red halo
            const lHalo = new THREE.Mesh(haloGeom, haloMat);
            lHalo.position.set(0, 0.15, 0);
            lHalo.rotation.x = Math.PI / 2;
            leftHorn.add(lHalo);
            group.add(leftHorn);

            const rightHorn = new THREE.Mesh(hornGeom, plateMat);
            rightHorn.position.set(0.35, 0.62, 0.1);
            rightHorn.rotation.set(-0.2, 0, 0.4);
            rightHorn.castShadow = true;
            
            // Halo on right horn
            const rHalo = lHalo.clone();
            rightHorn.add(rHalo);
            group.add(rightHorn);

            // Side antennas
            const antGeom = new THREE.CylinderGeometry(0.015, 0.025, 0.75, 16);
            const antMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.9 });
            
            const leftAnt = new THREE.Mesh(antGeom, antMat);
            leftAnt.position.set(-0.76, 0.3, -0.15);
            leftAnt.rotation.z = -0.5;
            leftAnt.rotation.x = 0.15;
            group.add(leftAnt);

            const rightAnt = leftAnt.clone();
            rightAnt.position.x = 0.76;
            rightAnt.rotation.z = 0.5;
            group.add(rightAnt);

            group.position.y = 0.3;
            return group;
        }
    };

    function set3DModel(gameId) {
        if (!characterGroup) return;

        const cleanId = gameId.toLowerCase().trim();
        const factory = charFactories[cleanId] || charFactories['centarius-run'];

        const transitionOut = () => {
            return new Promise((resolve) => {
                if (activeCharacter) {
                    gsap.to(activeCharacter.scale, {
                        x: 0, y: 0, z: 0,
                        duration: 0.35,
                        ease: "power2.in",
                        onComplete: () => {
                            characterGroup.remove(activeCharacter);
                            activeCharacter = null;
                            resolve();
                        }
                    });

                    gsap.to(activeCharacter.rotation, {
                        x: activeCharacter.rotation.x + 0.4,
                        y: activeCharacter.rotation.y + Math.PI,
                        duration: 0.35
                    });
                } else {
                    resolve();
                }
            });
        };

        transitionOut().then(() => {
            // Null sub-refs
            flameLeft = null; flameRight = null; exhaustRings = [];
            topJaw = null; bottomJaw = null; ghosts = [];
            asteroidScout = null; asteroidDebris = [];
            cyberVisor = null; cyberCogs = [];
            spaceInvaderLegs = []; spaceShieldDrones = [];

            // Reset dynamic animation phases
            ghostOrbitAngle = 0;
            droneOrbitAngle = 0;
            cyberCog1Angle = 0;
            cyberCog2Angle = 0;
            cyberVisorPhase = 0;
            pacmanBitePhase = 0;
            spinOffset = { y: 0, positionY: 0 };

            // Instantiate and add new mesh
            activeCharacter = factory();
            activeCharacter.scale.set(0, 0, 0);
            characterGroup.add(activeCharacter);

            characterGroup.rotation.set(0, 0, 0);

            const formattedName = gameId.replace(/-/g, ' ').toUpperCase();
            currentModelTitle.textContent = formattedName;

            // Apply responsive scale factor on model load
            const screenScale = window.innerWidth < 768 ? 0.65 : (window.innerWidth < 1024 ? 0.85 : 1.1);
            camera.position.z = window.innerWidth < 768 ? 5.6 : (window.innerWidth < 1024 ? 5.2 : 5.0);

            gsap.to(activeCharacter.scale, {
                x: screenScale, y: screenScale, z: screenScale,
                duration: 0.85,
                ease: "back.out(1.5)"
            });

            gsap.fromTo(camera.position, 
                { z: camera.position.z + 1.2, x: 0.5, y: 0.8 },
                { z: camera.position.z, x: 0, y: 0.4, duration: 1.25, ease: "power3.out" }
            );
        });
    }

    // Main Render loop
    function animate() {
        animationFrameId = requestAnimationFrame(animate);

        // Fetch elapsed time and frame delta
        const time = clock.getElapsedTime();
        const delta = Math.min(clock.getDelta(), 0.1); // Safe cap for background tabs

        // Perform smooth mouse parallax tracking
        mouse.x += (mouse.targetX - mouse.x) * 0.08;
        mouse.y += (mouse.targetY - mouse.y) * 0.08;

        // Proximity metrics for interactive touches
        const activity = Math.sqrt(mouse.x * mouse.x + mouse.y * mouse.y);

        if (characterGroup) {
            // High-responsiveness pointer rotations + celebratory spinOffset
            characterGroup.rotation.y = time * 0.3 + mouse.x * 2.2 + spinOffset.y;
            characterGroup.rotation.x = mouse.y * 1.2;
            characterGroup.position.y = Math.sin(time * 1.5) * 0.12 + spinOffset.positionY;
        }

        // Sub-animations & Game-specific interactive mouse pointer touches:
        // 1. Centarius Starfighter flames & ring speed increase
        if (flameLeft && flameRight) {
            // Fuel combustion scales dynamically with mouse movement activity!
            const baseFlame = 1.0 + activity * 1.5;
            const flicker = baseFlame * (1.0 + Math.sin(time * 35) * 0.12);
            flameLeft.scale.set(1, flicker, 1);
            flameRight.scale.set(1, flicker, 1);

            exhaustRings.forEach((ring, idx) => {
                // Exhaust ring speed and growth expand under mouse throttle
                const scaleVal = ring.scale.x + (0.04 + activity * 0.08);
                ring.scale.set(scaleVal, scaleVal, scaleVal);
                ring.position.z -= (0.04 + activity * 0.08);
                
                ring.material.opacity -= 0.035;
                
                if (ring.material.opacity <= 0) {
                    ring.position.z = -0.8;
                    ring.scale.set(0.1, 0.1, 0.1);
                    ring.material.opacity = 0.8;
                }
            });
        }

        // 2. Space Invaders wiggling limbs & protective drone alert state
        if (spaceInvaderLegs.length > 0) {
            spaceInvaderLegs.forEach((limb, index) => {
                limb.position.y += Math.sin(time * 9 + index) * 0.04;
            });
        }
        if (spaceShieldDrones.length > 0) {
            // Satellite drones spin 4x faster and expand wider as mouse moves (smoothly integrated)
            const baseRadius = 0.9 + activity * 0.5;
            const droneSpeed = 2.5 + activity * 6;
            droneOrbitAngle += droneSpeed * delta;

            spaceShieldDrones[0].position.set(Math.cos(droneOrbitAngle) * baseRadius, Math.sin(time * 3) * 0.15, Math.sin(droneOrbitAngle) * baseRadius);
            spaceShieldDrones[1].position.set(Math.cos(droneOrbitAngle + Math.PI) * baseRadius, Math.sin(time * 3 + 1.5) * 0.15, Math.sin(droneOrbitAngle + Math.PI) * baseRadius);
            spaceShieldDrones.forEach(d => {
                d.rotation.y += 0.06;
                d.rotation.x += 0.03;
            });
        }

        // 3. Mecha Pac-Man biting frequency & orbiting ghosts
        if (topJaw && bottomJaw) {
            // Biting speeds up dynamically as cursor approaches center (activity -> 0)
            const biteFreq = 7.0 + (1.0 - Math.min(activity, 1.0)) * 14.0;
            pacmanBitePhase += biteFreq * delta;
            const biteAngle = 0.45 * Math.abs(Math.sin(pacmanBitePhase));
            topJaw.rotation.x = -Math.PI / 2 + biteAngle;
            bottomJaw.rotation.x = Math.PI / 2 - biteAngle;

            const ghostSpeed = 1.5 + activity * 3.5;
            ghostOrbitAngle += ghostSpeed * delta;

            ghosts.forEach((ghost, index) => {
                // Ghosts orbit faster when mouse is active
                const angle = ghostOrbitAngle + (index * Math.PI);
                const radius = 1.35;
                ghost.position.set(Math.cos(angle) * radius, Math.sin(time * 3 + index) * 0.15, Math.sin(angle) * radius);
                ghost.rotation.y = -angle - Math.PI / 2;
            });
        }

        // 4. Crystal Asteroid crystals & spotlight tracking
        if (asteroidScout) {
            // Volumetric spotlight and ship rotation track pointer coordinates in 3D
            const angle = time * 1.2;
            const r = 1.35;
            asteroidScout.position.set(Math.cos(angle) * r, Math.sin(time * 2.5) * 0.25, Math.sin(angle) * r);
            asteroidScout.rotation.y = -angle - Math.PI / 2 + mouse.x * 1.5;
            asteroidScout.rotation.x = mouse.y * 1.0;
        }
        if (asteroidDebris.length > 0) {
            asteroidDebris.forEach(deb => {
                const data = deb.userData;
                const angle = time * data.speed + data.phase;
                deb.position.set(Math.cos(angle) * data.radius, data.offsetY + Math.sin(time + data.phase) * 0.05, Math.sin(angle) * data.radius);
                deb.rotation.x += 0.02;
                deb.rotation.y += 0.03;
            });
        }

        // 5. Cyber Knight cogs acceleration & visor alarm pulse
        if (cyberVisor) {
            // Visor flashes in a rapid alert cycle when mouse moves
            cyberVisorPhase += (3.0 + activity * 10.0) * delta;
            cyberVisor.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(cyberVisorPhase)) * 1.5;
        }
        if (cyberCogs.length > 0) {
            // Mechanical cogs spin up to 5x faster under throttle smoothly
            cyberCog1Angle += (1.8 + activity * 4) * delta;
            cyberCog2Angle += (1.4 + activity * 4) * delta;
            cyberCogs[0].rotation.y = cyberCog1Angle;
            cyberCogs[1].rotation.y = -cyberCog2Angle;
        }

        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }

    // --------------------------------------------------------------------------
    // Custom HUD Buttons actions
    // --------------------------------------------------------------------------
    if (btnSpin) {
        btnSpin.addEventListener('click', () => {
            if (!characterGroup) return;
            if (gsap.isTweening(spinOffset)) return;
            gsap.to(spinOffset, {
                y: spinOffset.y + Math.PI * 4,
                duration: 1.25,
                ease: "power2.inOut"
            });
            gsap.to(spinOffset, {
                positionY: 0.6,
                duration: 0.35,
                yoyo: true,
                repeat: 1,
                ease: "power2.out",
                onComplete: () => {
                    spinOffset.positionY = 0;
                }
            });
        });
    }

    if (btnGrid) {
        btnGrid.addEventListener('click', () => {
            if (!gridHelper) return;
            gridHelper.visible = !gridHelper.visible;
            btnGrid.classList.toggle('active', gridHelper.visible);
        });
    }

    // --------------------------------------------------------------------------
    // Backend API Integrations & Leaderboard Loading
    // --------------------------------------------------------------------------
    async function loadGames(selectGameId = null) {
        try {
            const response = await fetch('/api/get-games/');
            if (!response.ok) throw new Error('Failed to load games list');
            
            const games = await response.json();
            gameSelector.innerHTML = '';

            if (games.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Register a game via Submission!';
                opt.disabled = true;
                opt.selected = true;
                gameSelector.appendChild(opt);
                
                statTotalPlayers.textContent = '0';
                statTopScore.textContent = '-';
                leaderboardTitle.textContent = 'Standings';
                leaderboardBody.innerHTML = `
                    <tr class="info-row">
                        <td colspan="4">No scores submitted yet. Transmit an entry below!</td>
                    </tr>
                `;
                return;
            }

            games.forEach((game, index) => {
                const opt = document.createElement('option');
                opt.value = game.game_id;
                opt.textContent = game.title;
                
                if (selectGameId) {
                    if (game.game_id === selectGameId) opt.selected = true;
                } else {
                    if (index === 0) opt.selected = true;
                }
                gameSelector.appendChild(opt);
            });

            currentSelectedGame = gameSelector.value;

            // Generate premium visual retro game tabs dynamically
            const gameTabsContainer = document.getElementById('game-tabs');
            if (gameTabsContainer) {
                gameTabsContainer.innerHTML = '';
                games.forEach((game, index) => {
                    const tab = document.createElement('button');
                    tab.type = 'button';
                    tab.className = `game-tab-btn ${game.game_id === currentSelectedGame ? 'active' : ''}`;
                    tab.dataset.gameId = game.game_id;
                    
                    // Specific Lucide gaming icons for each arcade archetype
                    let iconName = 'gamepad-2';
                    if (game.game_id === 'centarius-run') iconName = 'rocket';
                    else if (game.game_id === 'space-invaders') iconName = 'skull';
                    else if (game.game_id === 'pac-man') iconName = 'smile';
                    else if (game.game_id === 'asteroids') iconName = 'orbit';
                    else if (game.game_id === 'cyber-knight') iconName = 'shield';
                    
                    tab.innerHTML = `<i data-lucide="${iconName}"></i> <span>${game.title}</span>`;
                    
                    tab.addEventListener('click', () => {
                        if (tab.classList.contains('active')) return;
                        
                        // Micro-animation bounce for clicking the tab pill
                        gsap.fromTo(tab, 
                            { scale: 0.93 },
                            { scale: 1, duration: 0.35, ease: "back.out(2)" }
                        );

                        // Remove active class from all other tabs
                        gameTabsContainer.querySelectorAll('.game-tab-btn').forEach(btn => btn.classList.remove('active'));
                        tab.classList.add('active');
                        
                        // Select target option in select dropdown & fire change event
                        gameSelector.value = game.game_id;
                        gameSelector.dispatchEvent(new Event('change'));
                    });
                    
                    gameTabsContainer.appendChild(tab);
                });
                
                // Re-compile icons on dynamic buttons
                if (window.lucide) {
                    lucide.createIcons();
                }
            }

            if (currentSelectedGame) {
                applyGameTheme(currentSelectedGame);
                loadLeaderboard(currentSelectedGame);
                startPolling(currentSelectedGame);
                set3DModel(currentSelectedGame);
            }

        } catch (error) {
            console.error(error);
            showToast('API Connection Error', 'Could not query registered tournaments.', 'error');
        }
    }

    async function loadLeaderboard(gameId) {
        if (!gameId) return;

        try {
            const response = await fetch(`/api/get-game-leaderboard/?game_id=${encodeURIComponent(gameId)}&limit=10`);
            if (!response.ok) throw new Error('Failed to load leaderboard data');

            const scores = await response.json();
            renderLeaderboard(scores);
            updateAnalyticsChart(scores); // Render Chart.js line/bar spread

            statTotalPlayers.textContent = scores.length;
            if (scores.length > 0) {
                statTopScore.textContent = scores[0].score.toLocaleString();
            } else {
                statTopScore.textContent = '-';
            }

            const selectedOpt = gameSelector.options[gameSelector.selectedIndex];
            if (selectedOpt) {
                leaderboardTitle.textContent = `${selectedOpt.textContent}`;
            }

        } catch (error) {
            console.error(error);
            showToast('Database Error', 'Failed to retrieve high scores archive.', 'error');
        }
    }

    function renderLeaderboard(scores) {
        leaderboardBody.innerHTML = '';

        // Extract Podium Card Elements
        const p1Name = document.getElementById('podium-1-name');
        const p1Score = document.getElementById('podium-1-score');
        const p2Name = document.getElementById('podium-2-name');
        const p2Score = document.getElementById('podium-2-score');
        const p3Name = document.getElementById('podium-3-name');
        const p3Score = document.getElementById('podium-3-score');

        const p1Avatar = document.querySelector('.rank-1-card .podium-avatar');
        const p2Avatar = document.querySelector('.rank-2-card .podium-avatar');
        const p3Avatar = document.querySelector('.rank-3-card .podium-avatar');

        // Populate Gold (Rank 1)
        if (scores.length >= 1) {
            p1Name.textContent = scores[0].display_name;
            p1Score.textContent = scores[0].score.toLocaleString();
            p1Name.parentElement.classList.remove('locked');
            if (p1Avatar) {
                p1Avatar.innerHTML = `<img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(scores[0].player_id)}&backgroundColor=b6e3f4" class="avatar-img" alt="Avatar" />`;
            }
        } else {
            p1Name.textContent = "LOCK // EMPTY";
            p1Score.textContent = "-";
            p1Name.parentElement.classList.add('locked');
            if (p1Avatar) {
                p1Avatar.innerHTML = `<i data-lucide="user"></i>`;
            }
        }

        // Populate Silver (Rank 2)
        if (scores.length >= 2) {
            p2Name.textContent = scores[1].display_name;
            p2Score.textContent = scores[1].score.toLocaleString();
            p2Name.parentElement.classList.remove('locked');
            if (p2Avatar) {
                p2Avatar.innerHTML = `<img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(scores[1].player_id)}&backgroundColor=c0aede" class="avatar-img" alt="Avatar" />`;
            }
        } else {
            p2Name.textContent = "LOCK // EMPTY";
            p2Score.textContent = "-";
            p2Name.parentElement.classList.add('locked');
            if (p2Avatar) {
                p2Avatar.innerHTML = `<i data-lucide="user"></i>`;
            }
        }

        // Populate Bronze (Rank 3)
        if (scores.length >= 3) {
            p3Name.textContent = scores[2].display_name;
            p3Score.textContent = scores[2].score.toLocaleString();
            p3Name.parentElement.classList.remove('locked');
            if (p3Avatar) {
                p3Avatar.innerHTML = `<img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(scores[2].player_id)}&backgroundColor=d1c4e9" class="avatar-img" alt="Avatar" />`;
            }
        } else {
            p3Name.textContent = "LOCK // EMPTY";
            p3Score.textContent = "-";
            p3Name.parentElement.classList.add('locked');
            if (p3Avatar) {
                p3Avatar.innerHTML = `<i data-lucide="user"></i>`;
            }
        }

        // Handle entire empty state
        if (scores.length === 0) {
            leaderboardBody.innerHTML = `
                <tr class="info-row">
                    <td colspan="4">No competitive rankings submitted for this arena yet.</td>
                </tr>
            `;
            return;
        }

        const topScore = scores[0].score;

        scores.forEach(entry => {
            const tr = document.createElement('tr');
            
            const formattedRank = entry.rank < 10 ? `0${entry.rank}` : entry.rank;
            let rankHtml = '';
            if (entry.rank === 1) {
                rankHtml = `<span class="rank-badge rank-1">01</span>`;
            } else if (entry.rank === 2) {
                rankHtml = `<span class="rank-badge rank-2">02</span>`;
            } else if (entry.rank === 3) {
                rankHtml = `<span class="rank-badge rank-3">03</span>`;
            } else {
                rankHtml = `<span class="rank-badge rank-other">${formattedRank}</span>`;
            }

            const date = new Date(entry.date_saved);
            const formattedDate = date.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            const ratioWidth = topScore > 0 ? (entry.score / topScore) * 100 : 0;

            tr.innerHTML = `
                <td>${rankHtml}</td>
                <td class="player-cell">
                    <div class="player-profile">
                        <img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(entry.player_id)}&backgroundColor=b6e3f4,c0aede,d1c4e9" class="table-avatar" alt="Gamer Avatar" />
                        <div class="player-info">
                            <span class="player-name">${escapeHtml(entry.display_name)}</span>
                            <span class="player-uid">UID: ${escapeHtml(entry.player_id)}</span>
                        </div>
                    </div>
                    <div class="xp-bar-container">
                        <div class="xp-bar" data-width="${ratioWidth}"></div>
                    </div>
                </td>
                <td class="score-cell">${entry.score.toLocaleString()}</td>
                <td class="date-cell">${formattedDate}</td>
            `;

            leaderboardBody.appendChild(tr);
        });

        // Re-initialize Vanilla-Tilt on new dynamic cards
        initVanillaTilt();

        // Re-compile Lucide Icons
        if (window.lucide) {
            lucide.createIcons();
        }

        // Trigger coordinated staggered game entries
        animateTableReveal(currentSelectedGame);
    }

    // Chart.js Analytical graphics spread setup
    function updateAnalyticsChart(scores) {
        const ctx = document.getElementById('leaderboard-chart');
        if (!ctx) return;

        // Take top 5 entries
        const top5 = scores.slice(0, 5);
        const labels = top5.map(item => item.display_name);
        const dataValues = top5.map(item => item.score);

        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score Spread',
                    data: dataValues,
                    backgroundColor: [
                        'rgba(251, 191, 36, 0.85)',  // Neon Gold
                        'rgba(6, 182, 212, 0.85)',   // Neon Cyan
                        'rgba(244, 63, 94, 0.85)',   // Neon Bronze/Rose
                        'rgba(99, 102, 241, 0.65)',  // Indigo
                        'rgba(99, 102, 241, 0.45)'   // Darker Indigo
                    ],
                    borderColor: [
                        '#fbbf24',
                        '#06b6d4',
                        '#f43f5e',
                        '#6366f1',
                        '#6366f1'
                    ],
                    borderWidth: 1.5,
                    borderRadius: 4,
                    barThickness: 16
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: '#111827',
                        titleColor: '#f3f4f6',
                        bodyColor: '#fbbf24',
                        borderColor: 'rgba(99, 102, 241, 0.3)',
                        borderWidth: 1,
                        titleFont: { family: 'Space Mono', size: 11 },
                        bodyFont: { family: 'Plus Jakarta Sans', size: 12 }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#9ca3af',
                            font: { family: 'Space Mono', size: 9, weight: '700' }
                        }
                    },
                    y: {
                        grid: { color: 'rgba(99, 102, 241, 0.08)' },
                        ticks: {
                            color: '#6b7280',
                            font: { family: 'Space Mono', size: 8 }
                        }
                    }
                }
            }
        });
    }

    // Submit new score with celebratory animation hooks
    scoreForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const gameId = inputGameId.value.trim();
        const playerId = inputPlayerId.value.trim();
        const displayName = inputDisplayName.value.trim();
        const score = parseInt(inputScore.value);

        if (!gameId || !playerId || !displayName || isNaN(score)) {
            showToast('Validation Failed', 'Inputs are missing or configured incorrectly.', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'TRANSMITTING...';

        try {
            const response = await fetch('/api/enter-leaderboard/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    game_id: gameId,
                    player_id: playerId,
                    display_name: displayName,
                    score: score
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.message || 'Server returned non-ok status');
            }

            const result = await response.json();

            if (result.status === 'success') {
                const updated = result.data.updated;
                if (updated) {
                    showToast('NEW RECORD ARCHIVED!', `${result.data.display_name} captured the rating of ${result.data.highest_score.toLocaleString()}!`, 'success');
                    
                    // Gamified high-score celebration particle blast!
                    if (window.confetti) {
                        confetti({
                            particleCount: 80,
                            spread: 60,
                            origin: { y: 0.7 }
                        });
                    }
                } else {
                    showToast('TRANSMISSION ENDED', `Attempt saved. Current high score stands at ${result.data.highest_score.toLocaleString()}.`, 'info');
                }

                inputScore.value = '';

                // Celebratory vertical jump and rapid spin on active 3D model
                if (btnSpin) {
                    btnSpin.click();
                }
                
                const targetGameId = result.data.game_id;
                await loadGames(targetGameId);
            }

        } catch (error) {
            console.error(error);
            showToast('Transmission Interrupted', error.message || 'Unable to store scores.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'SUBMIT RUN RECORD';
        }
    });

    // Handle game change selections
    gameSelector.addEventListener('change', () => {
        currentSelectedGame = gameSelector.value;
        applyGameTheme(currentSelectedGame);
        loadLeaderboard(currentSelectedGame);
        startPolling(currentSelectedGame);
        set3DModel(currentSelectedGame);
    });

    // Recursive live polling synchronization (updated to every 10 seconds for production sanity)
    function startPolling(gameId) {
        if (pollingTimeout) clearTimeout(pollingTimeout);
        
        async function poll() {
            await loadLeaderboard(gameId);
            pollingTimeout = setTimeout(poll, 10000);
        }
        
        pollingTimeout = setTimeout(poll, 10000);
    }

    // HTML escape sanitizer
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Dynamic visual theme manager
    function applyGameTheme(gameId) {
        if (!gameId) return;
        const cleanId = gameId.toLowerCase().trim();
        
        // Remove existing theme classes
        const themes = ['theme-centarius-run', 'theme-space-invaders', 'theme-pac-man', 'theme-asteroids', 'theme-cyber-knight'];
        themes.forEach(theme => document.body.classList.remove(theme));
        
        // Add active theme class
        document.body.classList.add(`theme-${cleanId}`);

        // Update target background configuration for linear interpolation LERPing
        if (bgThemeConfigs[cleanId]) {
            targetConfig = bgThemeConfigs[cleanId];
        }

        // Sync visual game tabs active state
        const gameTabsContainer = document.getElementById('game-tabs');
        if (gameTabsContainer) {
            gameTabsContainer.querySelectorAll('.game-tab-btn').forEach(btn => {
                if (btn.dataset.gameId === cleanId) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        // Trigger analog CRT scanline flicker glitch reset
        const scanlines = document.querySelector('.crt-scanlines');
        if (scanlines) {
            scanlines.classList.remove('flicker');
            void scanlines.offsetWidth; // Force CSS reflow to restart animation
            scanlines.classList.add('flicker');
        }

        // Trigger dynamic glitch shufflers on core panels and active label titles
        const titlesToGlitch = document.querySelectorAll('.panel h2, .panel-header h2, #current-model-title');
        titlesToGlitch.forEach(el => shuffleText(el, 550));

        // Trigger dynamic, game-specific full page panel entry animations
        animatePageContents(cleanId);
    }

    // Dynamic page-wide panel & content element transitions based on retro game archetype
    function animatePageContents(gameId) {
        const panels = document.querySelectorAll('.panel, .stage-panel');
        const stats = document.querySelectorAll('.stat-item');
        const title = document.getElementById('leaderboard-title');
        const chart = document.querySelector('.chart-box');
        
        if (panels.length === 0) return;
        
        // Kill active tweens to prevent overlapping and jumpiness
        gsap.killTweensOf(panels);
        gsap.killTweensOf(stats);
        if (title) gsap.killTweensOf(title);
        if (chart) gsap.killTweensOf(chart);

        if (gameId === 'centarius-run') {
            // Speed slide-ins from offscreen left/right with buttery clean snap
            gsap.fromTo(panels, 
                { x: (i) => i === 0 ? -120 : (i === 1 ? 0 : 120), opacity: 0, scale: 0.96 },
                { x: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.08, ease: "power4.out" }
            );
            gsap.fromTo(stats, 
                { scaleX: 0, transformOrigin: "left center" },
                { scaleX: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" }
            );
            if (title) {
                gsap.fromTo(title,
                    { letterSpacing: "18px", opacity: 0 },
                    { letterSpacing: "-0.5px", opacity: 1, duration: 0.8, ease: "power4.out" }
                );
            }
        } else if (gameId === 'space-invaders') {
            // Rigid retro voxel grid drops & elastic bounces
            gsap.fromTo(panels, 
                { y: -80, opacity: 0, scale: 0.95 },
                { y: 0, opacity: 1, scale: 1, duration: 0.75, stagger: 0.1, ease: "bounce.out" }
            );
            gsap.fromTo(stats,
                { y: -30, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: "bounce.out" }
            );
            if (title) {
                gsap.fromTo(title,
                    { scale: 0.4, opacity: 0 },
                    { scale: 1, opacity: 1, duration: 0.65, ease: "elastic.out(1.2, 0.6)" }
                );
            }
        } else if (gameId === 'pac-man') {
            // High-energy elasticity and circular 3D chomp pop-ins
            gsap.fromTo(panels, 
                { scale: 0.82, rotation: -3, opacity: 0 },
                { scale: 1, rotation: 0, opacity: 1, duration: 0.85, stagger: 0.08, ease: "elastic.out(1, 0.75)" }
            );
            gsap.fromTo(stats,
                { scale: 0, rotation: -15, opacity: 0 },
                { scale: 1, rotation: 0, opacity: 1, duration: 0.55, stagger: 0.06, ease: "back.out(2)" }
            );
            if (title) {
                gsap.fromTo(title,
                    { rotationY: 180, opacity: 0 },
                    { rotationY: 0, opacity: 1, duration: 0.8, ease: "back.out(1.5)" }
                );
            }
        } else if (gameId === 'asteroids') {
            // Deep cosmic drifts from random vectors and floating rotations
            panels.forEach((panel) => {
                const rx = (Math.random() - 0.5) * 100;
                const ry = (Math.random() - 0.5) * 100;
                const rr = (Math.random() - 0.5) * 6;
                gsap.fromTo(panel,
                    { x: rx, y: ry, opacity: 0, rotation: rr, scale: 0.93 },
                    { x: 0, y: 0, opacity: 1, rotation: 0, scale: 1, duration: 0.95, ease: "power2.out" }
                );
            });
            gsap.fromTo(stats,
                { opacity: 0, scale: 0.7 },
                { opacity: 1, scale: 1, duration: 0.6, stagger: 0.1, ease: "power2.out" }
            );
            if (title) {
                gsap.fromTo(title,
                    { y: -25, opacity: 0 },
                    { y: 0, opacity: 1, duration: 0.75, ease: "power1.out" }
                );
            }
        } else if (gameId === 'cyber-knight') {
            // Heavy armored visor shield locks (3D flips along the X-axis)
            gsap.fromTo(panels, 
                { rotationX: 65, opacity: 0, scale: 0.95, transformOrigin: "center top" },
                { rotationX: 0, opacity: 1, scale: 1, duration: 0.85, stagger: 0.12, ease: "power3.out" }
            );
            gsap.fromTo(stats,
                { rotationY: 90, opacity: 0 },
                { rotationY: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: "power3.out" }
            );
            if (title) {
                gsap.fromTo(title,
                    { scaleY: 0, opacity: 0, transformOrigin: "center top" },
                    { scaleY: 1, opacity: 1, duration: 0.7, ease: "power4.out" }
                );
            }
        }
    }

    // Dynamic, game-specific GSAP entry transitions for cards, rows, and XP level bars
    function animateTableReveal(gameId) {
        const rows = document.querySelectorAll('.leaderboard-table tbody tr');
        const cards = document.querySelectorAll('.podium-card');
        const xpBars = document.querySelectorAll('.leaderboard-table tbody .xp-bar');
        
        if (rows.length === 0) return;

        // Kill active animations on targets to prevent compounding delays
        gsap.killTweensOf(rows);
        gsap.killTweensOf(cards);
        if (xpBars.length > 0) gsap.killTweensOf(xpBars);

        // 1. Staggered reveal for standing rows & podium cards
        if (gameId === 'centarius-run') {
            // Canard Interceptor speed reveal
            gsap.fromTo(rows, 
                { x: 80, opacity: 0 },
                { x: 0, opacity: 1, duration: 0.5, stagger: 0.04, ease: "power4.out" }
            );
            gsap.fromTo(cards,
                { y: 40, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.7, stagger: 0.08, ease: "power3.out" }
            );
        } else if (gameId === 'space-invaders') {
            // Voxel bounce step
            gsap.fromTo(rows, 
                { y: -30, opacity: 0, scaleY: 0 },
                { y: 0, opacity: 1, scaleY: 1, duration: 0.6, stagger: 0.05, ease: "bounce.out" }
            );
            gsap.fromTo(cards,
                { scale: 0.6, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.7, stagger: 0.08, ease: "elastic.out(1, 0.75)" }
            );
        } else if (gameId === 'pac-man') {
            // Playful circular chomp zoom
            gsap.fromTo(rows, 
                { scale: 0.8, rotation: -2, opacity: 0 },
                { scale: 1, rotation: 0, opacity: 1, duration: 0.5, stagger: 0.04, ease: "back.out(1.8)" }
            );
            gsap.fromTo(cards,
                { rotation: 12, scale: 0, opacity: 0 },
                { rotation: 0, scale: 1, opacity: 1, duration: 0.7, stagger: 0.08, ease: "back.out(2)" }
            );
        } else if (gameId === 'asteroids') {
            // Cosmic debris drift from random directions
            rows.forEach((row, idx) => {
                const randomX = (Math.random() - 0.5) * 120;
                const randomY = (Math.random() - 0.5) * 40;
                gsap.fromTo(row,
                    { x: randomX, y: randomY, opacity: 0 },
                    { x: 0, y: 0, opacity: 1, duration: 0.65, delay: idx * 0.03, ease: "power2.out" }
                );
            });
            gsap.fromTo(cards,
                { y: -80, rotation: -8, opacity: 0 },
                { y: 0, rotation: 0, opacity: 1, duration: 0.85, stagger: 0.12, ease: "power2.out" }
            );
        } else if (gameId === 'cyber-knight') {
            // Mechanical face-plate gear lock flip
            gsap.fromTo(rows, 
                { rotationX: 90, opacity: 0 },
                { rotationX: 0, opacity: 1, transformOrigin: "top center", duration: 0.65, stagger: 0.04, ease: "power3.out" }
            );
            gsap.fromTo(cards,
                { rotationY: 90, opacity: 0 },
                { rotationY: 0, opacity: 1, transformOrigin: "center center", duration: 0.85, stagger: 0.08, ease: "power3.out" }
            );
        }

        // 2. Custom game-themed easing animations for all XP progress level bars
        if (xpBars.length > 0) {
            xpBars.forEach((bar) => {
                const targetWidth = bar.dataset.width ? bar.dataset.width + "%" : "0%";
                let easeStr = "power3.out";
                let durationVal = 1.2;
                
                if (gameId === 'centarius-run') {
                    easeStr = "power4.out";
                    durationVal = 0.6;
                } else if (gameId === 'space-invaders') {
                    easeStr = "steps(12)"; // Voxel steps
                    durationVal = 1.4;
                } else if (gameId === 'pac-man') {
                    easeStr = "back.out(2)"; // Playful elastic pop
                    durationVal = 1.0;
                } else if (gameId === 'asteroids') {
                    easeStr = "power1.inOut"; // Celestial fluid drift
                    durationVal = 1.5;
                } else if (gameId === 'cyber-knight') {
                    easeStr = "power3.inOut"; // Heavy industrial lock
                    durationVal = 1.3;
                }

                gsap.fromTo(bar,
                    { width: "0%" },
                    { width: targetWidth, duration: durationVal, ease: easeStr, delay: 0.1 }
                );
            });
        }
    }

    // Elegant alert system
    function showToast(title, message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        toast.innerHTML = `
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${message}</div>
        `;
        
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(15px) scale(0.98)';
            setTimeout(() => {
                toast.remove();
            }, 400);
        }, 5000);
    }

    // ==========================================================================
    // Vercel-Style Command Menu (⌘ K) Implementation
    // ==========================================================================
    const cmdOverlay = document.getElementById('cmd-menu-overlay');
    const cmdDialog = cmdOverlay.querySelector('.cmd-dialog');
    const cmdSearchInput = document.getElementById('cmd-search-input');
    const cmdListbox = document.getElementById('cmd-listbox');
    const cmdTriggerBtn = document.getElementById('cmd-trigger-shortcut');

    let activeItemIndex = 0;

    // Open/Close Command Menu Dialog
    function toggleCommandMenu(show = null) {
        if (!cmdOverlay) return;
        const currentShow = cmdOverlay.style.display !== 'none';
        const targetShow = show !== null ? show : !currentShow;

        if (targetShow) {
            // Kill existing tweens to prevent overlapping conflicts
            gsap.killTweensOf(cmdOverlay);
            gsap.killTweensOf(cmdDialog);
            
            // Set initial state for entry
            cmdOverlay.style.display = 'flex';
            cmdOverlay.style.opacity = 0;
            
            cmdDialog.style.transform = 'translateY(20px) scale(0.97)';
            cmdDialog.style.opacity = 0;
            
            // GSAP Backdrop fade
            gsap.to(cmdOverlay, { opacity: 1, duration: 0.35, ease: "power2.out" });
            
            // GSAP Dialog scale and float
            gsap.to(cmdDialog, { 
                y: 0, 
                scale: 1, 
                opacity: 1, 
                duration: 0.45, 
                delay: 0.05, 
                ease: "back.out(1.5)",
                onComplete: () => {
                    cmdSearchInput.focus();
                }
            });
            
            cmdSearchInput.value = '';
            filterCommandItems('');
            activeItemIndex = 0;
            updateActiveCommandHighlight();

            // Stagger visible action list items
            const visibleItems = cmdListbox.querySelectorAll('.cmd-item');
            gsap.killTweensOf(visibleItems);
            gsap.fromTo(visibleItems,
                { y: 12, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.35, stagger: 0.02, ease: "power2.out", delay: 0.1 }
            );

            showToast("COMMAND MENU OPENED", "Archived commands loaded. Press ESC to exit.", "info");
        } else {
            // Kill existing tweens
            gsap.killTweensOf(cmdOverlay);
            gsap.killTweensOf(cmdDialog);
            
            // Scale and fade out
            gsap.to(cmdDialog, { y: 15, scale: 0.97, opacity: 0, duration: 0.25, ease: "power2.in" });
            gsap.to(cmdOverlay, { 
                opacity: 0, 
                duration: 0.25, 
                ease: "power2.in",
                onComplete: () => {
                    cmdOverlay.style.display = 'none';
                    cmdSearchInput.blur();
                }
            });
        }
    }

    if (cmdTriggerBtn) {
        cmdTriggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCommandMenu(true);
        });
    }

    // Toggle menu via shortcut: Cmd+K / Ctrl+K
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            toggleCommandMenu();
        }
        
        // Escape to close
        if (e.key === 'Escape' && cmdOverlay && cmdOverlay.style.display !== 'none') {
            toggleCommandMenu(false);
        }

        // Direct Quick Action Hotkeys
        if (cmdOverlay && cmdOverlay.style.display === 'none') {
            // 1. Alt + [1-5] to quick swap game arenas
            if (e.altKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
                e.preventDefault();
                const index = parseInt(e.key) - 1;
                if (gameSelector && gameSelector.options[index]) {
                    gameSelector.selectedIndex = index;
                    gameSelector.dispatchEvent(new Event('change'));
                }
            }

            // 2. Cmd + I to trigger inspect spin
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                if (btnSpin) btnSpin.click();
            }

            // 3. Cmd + G to toggle grid lines
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                if (btnGrid) btnGrid.click();
            }

            // 4. Cmd + A to toggle analytics chart card
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                toggleAnalyticsCard();
            }

            // 5. Cmd + E to toggle record form drawer
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                if (formTrigger) formTrigger.click();
                inputGameId.focus();
            }

            // 6. Cmd + M to trigger automated mock speedrun bot
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                simulateMockRun();
            }
        }
    });

    // Close when clicking outside dialog (Backdrop click)
    if (cmdOverlay) {
        cmdOverlay.addEventListener('click', (e) => {
            if (e.target === cmdOverlay) {
                toggleCommandMenu(false);
            }
        });
    }

    // Fuzzy filtering action items in real-time
    function filterCommandItems(query) {
        const cleanQuery = query.toLowerCase().trim();
        const items = cmdListbox.querySelectorAll('.cmd-item');
        const groups = cmdListbox.querySelectorAll('.cmd-group');

        items.forEach(item => {
            const labelText = item.textContent.toLowerCase();
            const valueText = item.dataset.value ? item.dataset.value.toLowerCase() : '';
            const match = labelText.includes(cleanQuery) || valueText.includes(cleanQuery);
            
            if (match) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });

        // Hide empty groups
        groups.forEach(group => {
            const visibleItems = group.querySelectorAll('.cmd-item[style="display: flex;"]');
            const title = group.querySelector('.cmd-group-title');
            if (visibleItems.length === 0) {
                title.style.display = 'none';
            } else {
                title.style.display = 'block';
            }
        });

        // Reset active index
        activeItemIndex = 0;
        updateActiveCommandHighlight();
    }

    if (cmdSearchInput) {
        cmdSearchInput.addEventListener('input', (e) => {
            filterCommandItems(e.target.value);
        });
    }

    // Keyboard Arrow navigation inside dialog
    window.addEventListener('keydown', (e) => {
        if (!cmdOverlay || cmdOverlay.style.display === 'none') return;

        const visibleItems = Array.from(cmdListbox.querySelectorAll('.cmd-item')).filter(
            item => item.style.display !== 'none'
        );

        if (visibleItems.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeItemIndex = (activeItemIndex + 1) % visibleItems.length;
            updateActiveCommandHighlight(visibleItems);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeItemIndex = (activeItemIndex - 1 + visibleItems.length) % visibleItems.length;
            updateActiveCommandHighlight(visibleItems);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const activeItem = visibleItems[activeItemIndex];
            if (activeItem) {
                triggerCommandAction(activeItem);
            }
        }
    });

    // Update active highlight classes
    function updateActiveCommandHighlight(customList = null) {
        const visibleItems = customList || Array.from(cmdListbox.querySelectorAll('.cmd-item')).filter(
            item => item.style.display !== 'none'
        );

        const items = cmdListbox.querySelectorAll('.cmd-item');
        items.forEach(item => {
            item.classList.remove('active');
            item.setAttribute('aria-selected', 'false');
        });

        const activeItem = visibleItems[activeItemIndex];
        if (activeItem) {
            activeItem.classList.add('active');
            activeItem.setAttribute('aria-selected', 'true');
            activeItem.scrollIntoView({ block: 'nearest' });
        }
    }

    // Click trigger on items
    cmdListbox.addEventListener('click', (e) => {
        const item = e.target.closest('.cmd-item');
        if (item) {
            triggerCommandAction(item);
        }
    });

    // Executing commands
    function triggerCommandAction(item) {
        const action = item.dataset.action;
        const val = item.dataset.value;

        if (action === 'arena') {
            if (gameSelector) {
                gameSelector.value = val;
                gameSelector.dispatchEvent(new Event('change'));
            }
            toggleCommandMenu(false);
        } else if (action === 'inspect') {
            if (btnSpin) btnSpin.click();
            toggleCommandMenu(false);
        } else if (action === 'toggle-grid') {
            if (btnGrid) btnGrid.click();
            toggleCommandMenu(false);
        } else if (action === 'toggle-chart') {
            toggleAnalyticsCard();
            toggleCommandMenu(false);
        } else if (action === 'open-form') {
            if (formTrigger) {
                actionAccordion.classList.add('open');
                setTimeout(() => {
                    inputGameId.focus();
                }, 300);
            }
            toggleCommandMenu(false);
        } else if (action === 'mock-score') {
            toggleCommandMenu(false);
            simulateMockRun();
        }
    }

    // Command Menu helper actions:
    // 1. Toggle Analytics chart container
    function toggleAnalyticsCard() {
        const chartBox = document.querySelector('.chart-box');
        if (!chartBox) return;
        const isHidden = chartBox.style.display === 'none';
        
        if (isHidden) {
            chartBox.style.display = 'block';
            showToast("ANALYTICS VISIBLE", "Interactive comparison chart is online.", "info");
        } else {
            chartBox.style.display = 'none';
            showToast("ANALYTICS HIDDEN", "Comparison chart minimized.", "info");
        }
    }

    // 2. Automated Mock Run simulator
    function simulateMockRun() {
        if (!currentSelectedGame) return;
        const gameTitle = gameSelector.options[gameSelector.selectedIndex]?.textContent || "Arena";
        
        const mockPlayerId = "bot_" + Math.floor(Math.random() * 900 + 100);
        const mockPlayerName = "CyberBot_" + Math.floor(Math.random() * 90 + 10);
        
        let topVal = parseInt(statTopScore.textContent.replace(/,/g, '')) || 50000;
        if (isNaN(topVal)) topVal = 85000;
        // Generate score 5% to 20% higher than the top score!
        const mockScore = Math.floor(topVal * (1.05 + Math.random() * 0.15));
        
        // Open submission drawer smoothly
        actionAccordion.classList.add('open');
        
        // Pre-fill form programmatically
        inputGameId.value = currentSelectedGame;
        inputPlayerId.value = mockPlayerId;
        inputDisplayName.value = mockPlayerName;
        inputScore.value = mockScore;
        
        showToast("BOT SPEEDRUN INITIATED", `Pre-loading run coordinates for “${gameTitle}”…`, "info");
        
        // Submit run programmatically after a realistic delay
        setTimeout(() => {
            scoreForm.dispatchEvent(new Event('submit'));
        }, 900);
    }

    // Initialize 3D Engine, Background, Shufflers, & query database
    initLiveBg();
    initThree();
    initShuffleText();
    loadGames();
    
    // Smooth entry brand glitch effect
    const brandHeader = document.querySelector('.brand h1');
    if (brandHeader) {
        setTimeout(() => shuffleText(brandHeader, 900), 500);
    }
});
