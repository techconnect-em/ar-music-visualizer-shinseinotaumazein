// 詳細なブラウザ・デバイス検出とログ出力
console.log('=== Browser & Device Detection ===');
console.log('User Agent:', navigator.userAgent);
console.log('Platform:', navigator.platform);
console.log('Max Touch Points:', navigator.maxTouchPoints);
console.log('Vendor:', navigator.vendor);

// より詳細なブラウザ検出
const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
const isChrome = /Chrome/.test(navigator.userAgent);
const isFirefox = /Firefox/.test(navigator.userAgent);

console.log('Browser Detection:');
console.log('  Safari:', isSafari);
console.log('  Chrome:', isChrome);
console.log('  Firefox:', isFirefox);

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                 navigator.maxTouchPoints > 1;

console.log('Device Detection:');
console.log('  iOS:', isIOS);
console.log('  Mobile:', isMobile);

if (isSafari) {
    console.log('🦎 Safari検出: スクリプト開始');
}
if (isIOS) {
    console.log('🍎 iPhone/iPad検出: スクリプト開始');
}

document.addEventListener('DOMContentLoaded', () => {
    // デバイス確認ログ
    console.log('🔍 DOM読み込み完了 - デバイス:', isIOS ? 'iOS' : (isMobile ? 'Mobile' : 'Desktop'));
    
    // A-Frameが完全に読み込まれるまで待機
    if (typeof AFRAME !== 'undefined') {
        console.log('A-Frame loaded successfully');
        
        // 404エラーを無視する設定
        console.log('✅ AR Music Visualizer successfully loaded');
        console.log('🌟 Particle system: A-Frame spheres + Three.js particles');
        console.log('🪐 Orbital system: Stable non-reactive planets');
        console.log('🎵 Audio system: Web Audio API + frequency analysis');
    }
    
    if (isIOS) {
        console.log('🍎 iPhone: DOM読み込み完了');
    }
    
    let audioContext, analyser, source;
    const audioControl = document.getElementById('audio-control');
    const audio = document.getElementById('audio');
    const scanningOverlay = document.getElementById('scanning-overlay');
    const scene = document.querySelector('a-scene');
    const sphere = document.getElementById('visualSphere');
    const model = document.getElementById('base-entity');
    const equalizerContainer = document.getElementById('equalizer-container');
    console.log('🔍 DEBUG: DOM equalizerContainer lookup:', equalizerContainer);
    const mindarTarget = document.querySelector('[mindar-image-target]');
    const lyricsOverlay = document.getElementById('lyrics-overlay');
    const toggleLyricsButton = document.getElementById('toggle-lyrics');
    const websiteButton = document.getElementById('website-button');

    
    // 惑星軌道システム要素の取得
    const orbitalSystem = document.getElementById('orbital-system');
    const orbitContainers = [
        document.getElementById('orbit1-container'),
        document.getElementById('orbit2-container'),
        document.getElementById('orbit3-container'),
        document.getElementById('orbit4-container'),
        document.getElementById('orbit5-container')
    ];
    const planetOrbits = [
        document.getElementById('planet1-orbit'),
        document.getElementById('planet2-orbit'),
        document.getElementById('planet3-orbit'),
        document.getElementById('planet4-orbit'),
        document.getElementById('planet5-orbit')
    ];
    const planets = [
        document.getElementById('planet1'),
        document.getElementById('planet2'),
        document.getElementById('planet3'),
        document.getElementById('planet4'),
        document.getElementById('planet5')
    ];
    const centralStar = document.getElementById('central-star');

    //音楽再生バー
    const seekBar = document.getElementById('seek-bar');
    const currentTimeDisplay = document.getElementById('current-time');
    const durationDisplay = document.getElementById('duration');

    const FFT_SIZE = 256;
    const numBars = 32; // より詳細な音楽表現のため32本に増加
    let bars = [];
    let isLyricsVisible = false;

    // 歌詞の初期状態設定
    isLyricsVisible = false;
    lyricsOverlay.style.display = 'none';

    // リンクボタンのイベントリスナー
    websiteButton.addEventListener('click', () => {
        window.open('https://www.instagram.com/techconnect.em/', '_blank');
    });


     // 再生時間を整形する関数
    function formatTime(seconds) {
       const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);

         // 負の時間を考慮
         const absMins = Math.abs(mins);
        const absSecs = Math.abs(secs);

         const formattedMins = String(absMins);
        const formattedSecs = absSecs < 10 ? '0' + String(absSecs) : String(absSecs);
        return (mins < 0 ? '-' : '') + formattedMins + ':' + formattedSecs;
    }

   // イベントリスナー: メタデータがロードされたとき
    audio.addEventListener('loadedmetadata', () => {
        if (isNaN(audio.duration)) {
            console.warn("audio.duration is NaN. Trying again...");
            return;
        }
        const durationInSeconds = audio.duration;
        seekBar.max = durationInSeconds;
        durationDisplay.textContent = formatTime(durationInSeconds); // durationを初期化
    });

    // イベントリスナー: 再生時間が更新されたとき
    audio.addEventListener('timeupdate', () => {
        currentTimeDisplay.textContent = formatTime(audio.currentTime);
        seekBar.value = audio.currentTime;
          // 経過時間から残りの時間を計算して表示
        const timeLeft = audio.duration - audio.currentTime;
        durationDisplay.textContent = formatTime(timeLeft);
    });

    // イベントリスナー: seek barが変更されたとき
    seekBar.addEventListener('input', () => {
        audio.currentTime = seekBar.value;
        currentTimeDisplay.textContent = formatTime(audio.currentTime);
    });

    // イベントリスナー: 楽曲の再生が終わったとき
    audio.addEventListener('ended', () => {
        audioControl.querySelector('i').className = 'fas fa-play';
    });


    // 音声解析の初期化
    async function initAudioAnalyser() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await audioContext.resume();

            analyser = audioContext.createAnalyser();
            analyser.fftSize = FFT_SIZE;
            analyser.smoothingTimeConstant = 0.85;
            source = audioContext.createMediaElementSource(audio);
            source.connect(analyser);
            analyser.connect(audioContext.destination);

            // イコライザーバーの初期化
            try {
                for (let i = 0; i < numBars; i++) {
                    const bar = document.createElement('a-entity');
                    bar.setAttribute('geometry', `primitive: box; width: 0.012; height: 0.1; depth: 0.012`);
                    // リッチなマテリアル設定：グラデーション効果
                    const hue = (i / numBars) * 360; // 色相を360度で分散
                    bar.setAttribute('material', {
                        shader: 'standard',
                        color: `hsl(${hue}, 80%, 60%)`,
                        emissive: `hsl(${hue}, 60%, 30%)`,
                        emissiveIntensity: 0.3,
                        metalness: 0.2,
                        roughness: 0.1,
                        transparent: false
                    });
                    equalizerContainer.appendChild(bar);
                    bars.push(bar);
                }
                console.log('Equalizer bars initialized with rich materials.');
            } catch (error) {
                console.error('Error initializing equalizer bars:', error);
            }

            return true;
        } catch (error) {
            console.error('Audio analyser initialization error:', error);
            return false;
        }
    }


    // 音声データの解析と視覚化
    AFRAME.registerComponent('audio-visualizer', {
        init: function () {
            this.barWidth = 0.012; // より細いバー
            this.barColor = 'yellow';
            this.equalizerRadius = 1.1;
            this.smoothing = 0.3;
            // バー高さ配列は動的に初期化（モバイル対応）
            this.barHeights = [];
            console.log('Audio visualizer component initialized.');
        },
        tick: function () {
            if (analyser && !audio.paused) {
                const freqByteData = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(freqByteData);

                // スフィアのスケールを変更
                let avgScale = 0;
                for (let i = 0; i < freqByteData.length; i++) {
                    avgScale += freqByteData[i];
                }
                avgScale /= freqByteData.length;
                const scale = 1 + (avgScale / 255) * 0.5;
                this.el.object3D.scale.set(scale, scale, scale);

                // イコライザーバーの更新
                this.updateEqualizerBars(freqByteData);
            }
        },
        updateEqualizerBars: function (freqByteData) {
            try {
                // バーが初期化されているかチェック
                if (bars.length === 0) {
                    return;
                }
                
                // 基本要素の存在確認
                if (!mindarTarget || !mindarTarget.object3D || !sphere) {
                    return;
                }
                
                // グローバル変数のブラウザ検出結果を使用
                const currentNumBars = bars.length;
                
                const targetPosition = mindarTarget.object3D.position;
                const radius = parseFloat(sphere.getAttribute('radius')) * this.equalizerRadius;
                const sphereBottomY = targetPosition.y - parseFloat(sphere.getAttribute('radius'));

                for (let i = 0; i < currentNumBars; i++) {
                    const bar = bars[i];

                    if (!bar) {
                        continue;
                    }
                    
                    // iPhone以外はobject3D確認
                    if (!isIOS && !bar.object3D) {
                        continue;
                    }
                    
                    // 周波数データの処理
                    const freqIndex = Math.floor((i / currentNumBars) * Math.min(FFT_SIZE / 2, freqByteData.length));
                    const freqSum = freqByteData[freqIndex] || 0;
                    let barHeight = (freqSum / 255) * (isIOS ? 0.8 : (isMobile ? 1.0 : 1.5));
                    barHeight = Math.max(isIOS ? 0.05 : (isMobile ? 0.1 : 0.15), barHeight);

                    // スムージング処理
                    if (!this.barHeights[i]) {
                        this.barHeights[i] = barHeight;
                    }
                    this.barHeights[i] = this.barHeights[i] + (barHeight - this.barHeights[i]) * this.smoothing;

                    // 動的な色変更（音の強度に応じて）
                    const intensity = Math.min(freqSum / 255, 1.0);
                    const hue = (i / currentNumBars) * 360;
                    const saturation = 60 + intensity * 40; // 音が大きいほど鮮やか
                    const lightness = 40 + intensity * 40;  // 音が大きいほど明るく
                    const emissiveIntensity = 0.2 + intensity * 0.6; // 音が大きいほど光る

                    try {
                        // 統一された円形配置ロジック
                        let angle = 0;
                        if (currentNumBars > 1) {
                            angle = (i / (currentNumBars - 1)) * Math.PI - (Math.PI / 2);
                        }
                        const x = Math.cos(angle - Math.PI / 2) * radius;
                        const z = Math.sin(angle - Math.PI / 2) * radius;
                        const y = sphereBottomY + this.barHeights[i] / 2;

                        bar.setAttribute('position', `${targetPosition.x + x} ${y} ${targetPosition.z + z}`);
                        bar.setAttribute('rotation', `0 ${-angle * 180 / Math.PI - 90} 0`);
                        
                        // 動的マテリアル更新
                        bar.setAttribute('material', {
                            shader: 'standard',
                            color: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
                            emissive: `hsl(${hue}, 60%, 20%)`,
                            emissiveIntensity: emissiveIntensity,
                            metalness: 0.2,
                            roughness: 0.1
                        });
                        
                        // デバイス別のバーサイズ調整（全体的に細く）
                        if (isIOS) {
                            bar.setAttribute('geometry', `primitive: box; width: 0.05; height: ${this.barHeights[i]}; depth: 0.05`);
                        } else if (isMobile) {
                            bar.setAttribute('geometry', `primitive: box; width: 0.018; height: ${this.barHeights[i]}; depth: 0.018`);
                        } else {
                            bar.setAttribute('geometry', `primitive: box; width: ${this.barWidth}; height: ${this.barHeights[i]}; depth: ${this.barWidth}`);
                        }
                    } catch (barError) {
                        console.error(`Error updating bar ${i}:`, barError);
                    }
                }
            } catch (error) {
                console.error('Error during equalizer animation:', error);
            }
        }
    });

    sphere.setAttribute('audio-visualizer', '');

    let isTargetFound = false;
    
    scene.addEventListener('targetFound', () => {
        isTargetFound = true;
        scanningOverlay.classList.add('fade-out');
        // 歌詞表示は手動制御のまま維持
    });

    scene.addEventListener('targetLost', () => {
        isTargetFound = false;
        scanningOverlay.classList.remove('fade-out');
        // 歌詞表示は手動制御のまま維持
    });

    scene.addEventListener('error', (e) => {
        console.error('A-Frame scene error:', e);
    });

    audio.addEventListener('play', updateAudioButton);
    audio.addEventListener('pause', updateAudioButton);


    //音楽再生、歌詞表示、Webサイト移動などのイベントリスナーを定義
    websiteButton.addEventListener('click', () => {
        window.open('https://www.instagram.com/techconnect.em/', '_blank');
    });

    toggleLyricsButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('歌詞ボタンがクリックされました');
        console.log('現在のisLyricsVisible:', isLyricsVisible);
        
        isLyricsVisible = !isLyricsVisible;
        
        // 強制的にスタイルを設定
        if (isLyricsVisible) {
            lyricsOverlay.style.setProperty('display', 'flex', 'important');
            console.log('歌詞を表示に設定');
        } else {
            lyricsOverlay.style.setProperty('display', 'none', 'important');
            console.log('歌詞を非表示に設定');
        }
        
        // 確認のため最終状態をログ出力
        setTimeout(() => {
            console.log('最終的なdisplayプロパティ:', getComputedStyle(lyricsOverlay).display);
        }, 100);
        
        updateLyricsButton();
    });

     function updateLyricsButton() {
        const icon = toggleLyricsButton.querySelector('i');
        icon.className = isLyricsVisible ? 'fas fa-times' : 'fas fa-align-justify';
    }

   audioControl.addEventListener('click', async () => {
        try {
            console.log('Audio control clicked');
            console.log('🔧 Audio control - iOS:', isIOS, 'Mobile:', isMobile, 'Chrome:', isChrome);
            
            // AudioContextが未初期化またはsuspended状態の場合、初期化
            if (!audioContext || audioContext.state === 'suspended') {
                console.log('Initializing audio analyser...');
                const success = await initAudioAnalyser();
                if (!success) {
                    console.log('Audio analyser init failed, retrying...');
                    // リトライ（iPhone Chrome用）
                    setTimeout(async () => {
                        try {
                            await initAudioAnalyser();
                        } catch (retryError) {
                            console.error('Retry failed:', retryError);
                        }
                    }, 1000);
                }
            }
            
            if (audio.paused) {
                console.log('Starting audio playback...');
                await audio.play();
                if (audioContext) {
                    await audioContext.resume();
                    console.log('✅ DEBUG: AudioContext manually resumed, state:', audioContext.state);
                    
                    // AudioContext復帰後、イコライザーバーが作成されているかチェック
                    setTimeout(() => {
                        console.log('🔍 DEBUG: Post-resume equalizer check');
                        console.log('🔍 DEBUG: Bars array length:', bars.length);
                        console.log('🔍 DEBUG: AudioContext final state:', audioContext.state);
                        
                        if (bars.length === 0) {
                            console.log('⚠️ DEBUG: No bars found, attempting to create...');
                            if (equalizerContainer) {
                                window.createEqualizerBars(numBars);
                            }
                        }
                    }, 500);
                }
                
                // iPhone用：再生開始後にイコライザーバーの状態を確認
                if (isIOS) {
                    setTimeout(() => {
                        console.log('=== iOS Audio Playback Check ===');
                        console.log(`Bars array length: ${bars.length}`);
                        console.log(`Audio paused: ${audio.paused}`);
                        console.log(`AudioContext state: ${audioContext ? audioContext.state : 'null'}`);
                        console.log(`Analyser exists: ${!!analyser}`);
                        
                        // iPhone用ログ通知
                        console.log(`🍎 iPhone音楽再生: バー${bars.length}本, 音楽${audio.paused ? '停止中' : '再生中'}`);
                    }, 2000);
                }
            } else {
                console.log('Pausing audio playback...');
                audio.pause();
            }
            updateAudioButton();
        } catch (error) {
            console.error('Audio control error:', error);
        }
    });

    function updateAudioButton() {
        const icon = audioControl.querySelector('i');
        icon.className = audio.paused ? 'fas fa-play' : 'fas fa-pause';
    }

    // 惑星軌道システム制御コンポーネント（音楽反応なし、安定軌道）
    AFRAME.registerComponent('orbital-system-controller', {
        init: function () {
            this.orbitContainers = [
                document.getElementById('orbit1-container'),
                document.getElementById('orbit2-container'),
                document.getElementById('orbit3-container'),
                document.getElementById('orbit4-container'),
                document.getElementById('orbit5-container'),
                document.getElementById('orbit6-container'),
                document.getElementById('orbit7-container'),
                document.getElementById('orbit8-container')
            ];
            this.planetOrbits = [
                document.getElementById('planet1-orbit'),
                document.getElementById('planet2-orbit'),
                document.getElementById('planet3-orbit'),
                document.getElementById('planet4-orbit'),
                document.getElementById('planet5-orbit'),
                document.getElementById('planet6-orbit'),
                document.getElementById('planet7-orbit'),
                document.getElementById('planet8-orbit')
            ];
            this.planets = [
                document.getElementById('planet1'),
                document.getElementById('planet2'),
                document.getElementById('planet3'),
                document.getElementById('planet4'),
                document.getElementById('planet5'),
                document.getElementById('planet6'),
                document.getElementById('planet7'),
                document.getElementById('planet8')
            ];
            this.centralStar = document.getElementById('central-star');
            
            // 実際の太陽系軌道速度（公転周期に基づく）
            this.orbitSpeeds = [6000, 10000, 15000, 25000, 40000, 60000, 90000, 120000]; // 8惑星
            // 実際の惑星サイズ（相対的）
            this.planetRadii = [0.025, 0.038, 0.04, 0.034, 0.08, 0.075, 0.055, 0.053]; // 8惑星
            // 実際の軌道傾斜角
            this.orbitRotations = [
                {x: 0, y: 0, z: 7},      // 水星: 7°
                {x: 0, y: 0, z: 3.4},    // 金星: 3.4°
                {x: 0, y: 0, z: 0},      // 地球: 0° (基準)
                {x: 0, y: 0, z: 1.85},   // 火星: 1.85°
                {x: 0, y: 0, z: 1.3},    // 木星: 1.3°
                {x: 0, y: 0, z: 2.5},    // 土星: 2.5°
                {x: 0, y: 0, z: 0.77},   // 天王星: 0.77°
                {x: 0, y: 0, z: 1.77}    // 海王星: 1.77°
            ];
            
            // 初期化時に軌道と惑星の設定を固定
            this.setupStableOrbits();
        },
        
        setupStableOrbits: function () {
            // 太陽の設定
            if (this.centralStar) {
                this.centralStar.setAttribute('radius', 0.12);
                this.centralStar.setAttribute('material', {
                    shader: 'standard',
                    metalness: 0.1,
                    roughness: 0.0,
                    emissive: '#FF6B00',
                    emissiveIntensity: 0.8
                });
            }
            
            // 各惑星軌道の固定設定
            this.planets.forEach((planet, index) => {
                if (planet && this.planetOrbits[index] && this.orbitContainers[index]) {
                    // 惑星のサイズを固定
                    planet.setAttribute('radius', this.planetRadii[index]);
                    
                    // 惑星の発光強度を固定
                    const currentMaterial = planet.getAttribute('material');
                    planet.setAttribute('material', {
                        ...currentMaterial,
                        emissiveIntensity: 0.3
                    });
                    
                    // 軌道の回転を固定速度で設定（実際の太陽系：すべて反時計回り）
                    this.planetOrbits[index].setAttribute('animation', {
                        property: 'rotation',
                        to: '0 360 0', // すべての惑星が反時計回りに公転（A-Frame座標系では正の値）
                        loop: true,
                        dur: this.orbitSpeeds[index],
                        easing: 'linear'
                    });
                    
                    // 軌道全体の傾斜を固定
                    const rotation = this.orbitRotations[index];
                    this.orbitContainers[index].setAttribute('rotation', 
                        `${rotation.x} ${rotation.y} ${rotation.z}`
                    );
                }
            });
        },
        
        tick: function () {
            // 音楽に反応せず、安定した軌道を維持
            // 何も処理しない
        }
    });

    // Three.js直接使用の星パーティクルシステム - 3D深度強化版
    let threeJsParticleSystem = null;
    let nearParticleSystem = null;
    let farParticleSystem = null;
    
    function initThreeJsParticles() {
        try {
            const sceneEl = document.querySelector('a-scene');
            const cameraEl = document.querySelector('a-camera');
            
            if (!sceneEl || !cameraEl || !sceneEl.object3D || typeof THREE === 'undefined') {
                console.error('A-Frame scene, camera, or THREE.js not ready');
                return;
            }
            
            const scene = sceneEl.object3D;
            const camera = cameraEl.object3D;
        
        // レイヤー1: 遠方の星（小さく暗い）
        const farGeometry = new THREE.BufferGeometry();
        const farParticleCount = 200;
        
        const farPositions = new Float32Array(farParticleCount * 3);
        const farColors = new Float32Array(farParticleCount * 3);
        const farSizes = new Float32Array(farParticleCount);
        
        for (let i = 0; i < farParticleCount; i++) {
            const i3 = i * 3;
            
            // 遠方の球状配置（8-15単位離れた位置）
            const radius = 8 + Math.random() * 7;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            farPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            farPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            farPositions[i3 + 2] = radius * Math.cos(phi);
            
            // 遠方の星は暗めの白色
            const brightness = 0.3 + Math.random() * 0.4;
            farColors[i3] = brightness;
            farColors[i3 + 1] = brightness;
            farColors[i3 + 2] = brightness + Math.random() * 0.2;
            
            farSizes[i] = 0.02 + Math.random() * 0.04;
        }
        
        farGeometry.setAttribute('position', new THREE.BufferAttribute(farPositions, 3));
        farGeometry.setAttribute('color', new THREE.BufferAttribute(farColors, 3));
        farGeometry.setAttribute('size', new THREE.BufferAttribute(farSizes, 1));
        
        // レイヤー2: 中距離の星（中間サイズ）
        const midGeometry = new THREE.BufferGeometry();
        const midParticleCount = 100;
        
        const midPositions = new Float32Array(midParticleCount * 3);
        const midColors = new Float32Array(midParticleCount * 3);
        const midSizes = new Float32Array(midParticleCount);
        
        for (let i = 0; i < midParticleCount; i++) {
            const i3 = i * 3;
            
            // 中距離の球状配置（4-8単位離れた位置）
            const radius = 4 + Math.random() * 4;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            midPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            midPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            midPositions[i3 + 2] = radius * Math.cos(phi);
            
            // 中距離は少し明るめ
            const brightness = 0.5 + Math.random() * 0.3;
            midColors[i3] = brightness;
            midColors[i3 + 1] = brightness + Math.random() * 0.1;
            midColors[i3 + 2] = brightness + Math.random() * 0.2;
            
            midSizes[i] = 0.05 + Math.random() * 0.06;
        }
        
        midGeometry.setAttribute('position', new THREE.BufferAttribute(midPositions, 3));
        midGeometry.setAttribute('color', new THREE.BufferAttribute(midColors, 3));
        midGeometry.setAttribute('size', new THREE.BufferAttribute(midSizes, 1));
        
        // レイヤー3: 近距離の星（大きく明るい）
        const nearGeometry = new THREE.BufferGeometry();
        const nearParticleCount = 50;
        
        const nearPositions = new Float32Array(nearParticleCount * 3);
        const nearColors = new Float32Array(nearParticleCount * 3);
        const nearSizes = new Float32Array(nearParticleCount);
        
        for (let i = 0; i < nearParticleCount; i++) {
            const i3 = i * 3;
            
            // 近距離の球状配置（2-4単位離れた位置）
            const radius = 2 + Math.random() * 2;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            nearPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            nearPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            nearPositions[i3 + 2] = radius * Math.cos(phi);
            
            // 近距離は明るく、色のバリエーション
            const starType = Math.random();
            if (starType < 0.6) {
                // 白色星
                nearColors[i3] = 0.8 + Math.random() * 0.2;
                nearColors[i3 + 1] = 0.8 + Math.random() * 0.2;
                nearColors[i3 + 2] = 1.0;
            } else if (starType < 0.8) {
                // 青色星
                nearColors[i3] = 0.5 + Math.random() * 0.3;
                nearColors[i3 + 1] = 0.7 + Math.random() * 0.3;
                nearColors[i3 + 2] = 1.0;
            } else {
                // 黄色星
                nearColors[i3] = 1.0;
                nearColors[i3 + 1] = 0.9 + Math.random() * 0.1;
                nearColors[i3 + 2] = 0.6 + Math.random() * 0.2;
            }
            
            nearSizes[i] = 0.08 + Math.random() * 0.12;
        }
        
        nearGeometry.setAttribute('position', new THREE.BufferAttribute(nearPositions, 3));
        nearGeometry.setAttribute('color', new THREE.BufferAttribute(nearColors, 3));
        nearGeometry.setAttribute('size', new THREE.BufferAttribute(nearSizes, 1));
        
        // 高度なシェーダーマテリアル（距離に応じたフェード効果）
        const createStarMaterial = (depthLayer) => {
            return new THREE.ShaderMaterial({
                uniforms: {
                    time: { value: 1.0 },
                    audioIntensity: { value: 0.0 },
                    depthFactor: { value: depthLayer } // 0.3(遠), 0.6(中), 1.0(近)
                },
                vertexShader: [
                    'attribute float size;',
                    'uniform float time;',
                    'uniform float audioIntensity;',
                    'uniform float depthFactor;',
                    'varying vec3 vColor;',
                    'varying float vDepth;',
                    '',
                    'void main() {',
                    '    vColor = color;',
                    '    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
                    '    vDepth = -mvPosition.z / 10.0;', // 深度情報を渡す

                    '    ',
                    '    float dynamicSize = size * (1.0 + audioIntensity * depthFactor);',
                    '    float twinkle = 0.8 + 0.2 * sin(time * 3.0 + position.x * 10.0);',
                    '    ',
                    '    gl_PointSize = dynamicSize * twinkle * (300.0 / -mvPosition.z);',
                    '    gl_Position = projectionMatrix * mvPosition;',
                    '}'
                ].join('\n'),
                fragmentShader: [
                    'uniform float time;',
                    'uniform float audioIntensity;',
                    'uniform float depthFactor;',
                    'varying vec3 vColor;',
                    'varying float vDepth;',
                    '',
                    'void main() {',
                    '    vec2 coord = gl_PointCoord - vec2(0.5);',
                    '    float dist = length(coord);',
                    '    ',
                    '    if (dist > 0.5) discard;',
                    '    ',
                    '    // 星の形状（中心が明るく、外側にフェード）',
                    '    float alpha = pow(1.0 - dist * 2.0, 2.0);',
                    '    float glow = 0.6 + 0.4 * sin(time * 2.0 + vDepth * 5.0);',
                    '    ',
                    '    // 距離に応じたフェード効果',
                    '    float depthFade = 1.0 - clamp(vDepth * 0.1, 0.0, 0.7);',
                    '    ',
                    '    vec3 finalColor = vColor * (glow + audioIntensity * depthFactor);',
                    '    float finalAlpha = alpha * depthFade * (0.6 + 0.4 * depthFactor);',
                    '    ',
                    '    gl_FragColor = vec4(finalColor, finalAlpha);',
                    '}'
                ].join('\n'),
                blending: THREE.AdditiveBlending,
                depthTest: true,
                transparent: true,
                vertexColors: true
            });
        };
        
        // 3つのレイヤーを作成
        farParticleSystem = new THREE.Points(farGeometry, createStarMaterial(0.3));
        const midParticleSystem = new THREE.Points(midGeometry, createStarMaterial(0.6));
        nearParticleSystem = new THREE.Points(nearGeometry, createStarMaterial(1.0));
        
        // すべてのパーティクルシステムをシーンに追加
        scene.add(farParticleSystem);
        scene.add(midParticleSystem);
        scene.add(nearParticleSystem);
        
        // メインの参照用（後方互換性）
        threeJsParticleSystem = nearParticleSystem;
        
        console.log('Enhanced 3D star field initialized with depth layers');
        } catch (error) {
            console.error('Error initializing Three.js particles:', error);
        }
    }
    
    // 音楽反応とマスク制御（強化された3D星空システム）
    AFRAME.registerComponent('enhanced-particle-controller', {
        init: function () {
            this.spaceMask = document.getElementById('space-mask');
            this.time = 0;
            
            // 星空マスクを即座にアクティブ化
            if (this.spaceMask) {
                this.spaceMask.classList.add('active');
                console.log('Space mask activated immediately');
            }
            
            // Three.jsパーティクル初期化
            const initParticles = () => {
                if (document.querySelector('a-scene').hasLoaded) {
                    initThreeJsParticles();
                    // 念のため再度マスクをアクティブ化
                    if (this.spaceMask) {
                        this.spaceMask.classList.add('active');
                        console.log('Space mask re-activated after scene load');
                    }
                } else {
                    setTimeout(initParticles, 500);
                }
            };
            initParticles();
        },
        
        tick: function () {
            this.time += 0.016; // 60fps想定
            
            if (analyser && !audio.paused) {
                const freqByteData = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(freqByteData);
                
                // 異なる周波数帯域で異なるレイヤーを制御
                let lowFreqIntensity = 0;
                let midFreqIntensity = 0;
                let highFreqIntensity = 0;
                
                // 低音域（遠方の星用）
                for (let i = 2; i < Math.min(16, freqByteData.length); i++) {
                    lowFreqIntensity += freqByteData[i];
                }
                lowFreqIntensity = lowFreqIntensity / (14 * 255);
                
                // 中音域（中距離の星用）
                for (let i = 16; i < Math.min(64, freqByteData.length); i++) {
                    midFreqIntensity += freqByteData[i];
                }
                midFreqIntensity = midFreqIntensity / (48 * 255);
                
                // 高音域（近距離の星用）
                for (let i = 64; i < Math.min(128, freqByteData.length); i++) {
                    highFreqIntensity += freqByteData[i];
                }
                highFreqIntensity = highFreqIntensity / (64 * 255);
                
                // 各レイヤーのパーティクルシステムを更新
                if (farParticleSystem && farParticleSystem.material) {
                    farParticleSystem.material.uniforms.time.value = this.time;
                    farParticleSystem.material.uniforms.audioIntensity.value = lowFreqIntensity;
                }
                
                if (threeJsParticleSystem && threeJsParticleSystem.material) {
                    // 中距離レイヤー（midParticleSystem）への参照を取得
                    const midParticleSystem = threeJsParticleSystem.parent?.children?.find(child => 
                        child.material?.uniforms?.depthFactor?.value === 0.6
                    );
                    if (midParticleSystem) {
                        midParticleSystem.material.uniforms.time.value = this.time;
                        midParticleSystem.material.uniforms.audioIntensity.value = midFreqIntensity;
                    }
                }
                
                if (nearParticleSystem && nearParticleSystem.material) {
                    nearParticleSystem.material.uniforms.time.value = this.time;
                    nearParticleSystem.material.uniforms.audioIntensity.value = highFreqIntensity;
                }
                
                // CSS マスクの動的変更（全体的な音響強度）
                if (this.spaceMask) {
                    const overallIntensity = (lowFreqIntensity + midFreqIntensity + highFreqIntensity) / 3;
                    const opacity = 0.7 + overallIntensity * 0.3;
                    this.spaceMask.style.opacity = opacity;
                }
            } else {
                // 音楽が再生されていない場合でも星は瞬く
                if (farParticleSystem && farParticleSystem.material) {
                    farParticleSystem.material.uniforms.time.value = this.time;
                }
                if (nearParticleSystem && nearParticleSystem.material) {
                    nearParticleSystem.material.uniforms.time.value = this.time;
                }
            }
        }
    });

    // DOMContentLoaded以降に実行されるように、initAudioAnalyserの呼び出しをここに移動
    init();
    async function init() {
         // AudioContextはユーザー操作後に初期化するため、ここでは呼ばない
         console.log('AR Music Visualizer with Orbital Planetary System initialized');
         
         // シンプルパーティクル制御コンポーネントは削除（enhanced-particle-controllerを使用）
         
         // 惑星軌道システム制御コンポーネントをシーンに追加
         scene.setAttribute('orbital-system-controller', '');
         
         // Three.jsパーティクルと星空マスク制御コンポーネントをシーンに追加
         scene.setAttribute('enhanced-particle-controller', '');
    }
});
