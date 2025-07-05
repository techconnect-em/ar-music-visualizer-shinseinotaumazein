document.addEventListener('DOMContentLoaded', () => {
    let audioContext, analyser, source;
    const audioControl = document.getElementById('audio-control');
    const audio = document.getElementById('audio');
    const scanningOverlay = document.getElementById('scanning-overlay');
    const scene = document.querySelector('a-scene');
    const sphere = document.getElementById('visualSphere');
    const model = document.getElementById('base-entity');
    const equalizerContainer = document.getElementById('equalizer-container');
    const mindarTarget = document.querySelector('[mindar-image-target]');
    const lyricsOverlay = document.getElementById('lyrics-overlay');
    const toggleLyricsButton = document.getElementById('toggle-lyrics');
    const websiteButton = document.getElementById('website-button');

    // パーティクルシステム要素の取得
    const particleSystem1 = document.getElementById('particle-system1');
    const particleSystem2 = document.getElementById('particle-system2');
    const particleSystem3 = document.getElementById('particle-system3');
    
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
    const numBars = 32; // 固定のバーの数に変更
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

         const formattedMins = String(absMins).padStart(0, '0');
        const formattedSecs = String(absSecs).padStart(2, '0');
        return `${mins < 0 ? '-' : ''}${formattedMins}:${formattedSecs}`;
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
            
            // AudioContextが suspended状態の場合、ユーザー操作後に resume
            if (audioContext.state === 'suspended') {
                console.log('AudioContext is suspended, will resume on user interaction');
                return false;
            }
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
                    bar.setAttribute('geometry', `primitive: box; width: 0.02; height: 0.1; depth: 0.02`);
                    bar.setAttribute('material', `color: yellow`);
                    equalizerContainer.appendChild(bar);
                    bars.push(bar);
                }
                console.log('Equalizer bars initialized successfully.');
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
            this.barWidth = 0.02;
            this.barColor = 'yellow';
            this.equalizerRadius = 1.1;
            this.smoothing = 0.3;
            this.barHeights = new Array(numBars).fill(0); // スムージング用の配列
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
                const targetPosition = mindarTarget.object3D.position;
                const radius = parseFloat(sphere.getAttribute('radius')) * this.equalizerRadius;
                const sphereBottomY = targetPosition.y - parseFloat(sphere.getAttribute('radius'));

                for (let i = 0; i < numBars; i++) {
                    const bar = bars[i];

                    if (!bar) {
                        console.error('bar is null or undefined:', i, bars);
                        continue;
                    }
                    // 使用する周波数データを選択（高周波数帯域をカット）
                    const freqIndex = Math.floor((i / numBars) * (FFT_SIZE / 2));
                    const freqSum = freqByteData[freqIndex] || 0;
                    let barHeight = (freqSum / 255) * 1.5;
                    barHeight = Math.max(0.1, barHeight); // 最小値を設定

                    // スムージング処理
                    this.barHeights[i] = this.barHeights[i] + (barHeight - this.barHeights[i]) * this.smoothing;

                    let angle = 0;
                    if (numBars > 1) {
                        angle = (i / (numBars - 1)) * Math.PI - (Math.PI / 2);
                    }
                    const x = Math.cos(angle - Math.PI / 2) * radius;
                    const z = Math.sin(angle - Math.PI / 2) * radius;
                    const y = sphereBottomY + this.barHeights[i] / 2;

                    bar.setAttribute('position', `${targetPosition.x + x} ${y} ${targetPosition.z + z}`);
                    bar.setAttribute('geometry', `primitive: box; width: ${this.barWidth}; height: ${this.barHeights[i]}; depth: ${this.barWidth}`);
                    bar.setAttribute('rotation', `0 ${-angle * 180 / Math.PI - 90} 0`);
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
            // AudioContextが未初期化またはsuspended状態の場合、初期化
            if (!audioContext || audioContext.state === 'suspended') {
                await initAudioAnalyser();
            }
            
            if (audio.paused) {
                await audio.play();
                if (audioContext) {
                    await audioContext.resume();
                }
            } else {
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

    // 惑星軌道システム制御コンポーネント
    AFRAME.registerComponent('orbital-system-controller', {
        init: function () {
            this.orbitContainers = [
                document.getElementById('orbit1-container'),
                document.getElementById('orbit2-container'),
                document.getElementById('orbit3-container'),
                document.getElementById('orbit4-container'),
                document.getElementById('orbit5-container')
            ];
            this.planetOrbits = [
                document.getElementById('planet1-orbit'),
                document.getElementById('planet2-orbit'),
                document.getElementById('planet3-orbit'),
                document.getElementById('planet4-orbit'),
                document.getElementById('planet5-orbit')
            ];
            this.planets = [
                document.getElementById('planet1'),
                document.getElementById('planet2'),
                document.getElementById('planet3'),
                document.getElementById('planet4'),
                document.getElementById('planet5')
            ];
            this.centralStar = document.getElementById('central-star');
            
            // 基本軌道速度（ミリ秒）
            this.baseOrbitSpeeds = [8000, 12000, 18000, 25000, 30000];
            // 基本惑星サイズ
            this.basePlanetRadii = [0.03, 0.04, 0.05, 0.06, 0.04];
            // 基本軌道傾斜
            this.baseRotations = [
                {x: 0, y: 0, z: 15},
                {x: 30, y: 0, z: 45},
                {x: 60, y: 0, z: -30},
                {x: -45, y: 0, z: 60},
                {x: 90, y: 0, z: 0}
            ];
        },
        
        tick: function () {
            if (analyser && !audio.paused) {
                const freqByteData = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(freqByteData);
                
                // 音域別の強度を計算
                let totalIntensity = 0;
                let bassIntensity = 0;
                let midIntensity = 0;
                let highIntensity = 0;
                
                for (let i = 0; i < freqByteData.length; i++) {
                    totalIntensity += freqByteData[i];
                    if (i < 8) bassIntensity += freqByteData[i];
                    else if (i < 16) midIntensity += freqByteData[i];
                    else if (i < 32) highIntensity += freqByteData[i];
                }
                
                totalIntensity = totalIntensity / (freqByteData.length * 255);
                bassIntensity = bassIntensity / (8 * 255);
                midIntensity = midIntensity / (8 * 255);
                highIntensity = highIntensity / (16 * 255);
                
                // 中心の星（太陽）の効果
                if (this.centralStar) {
                    const starIntensity = totalIntensity;
                    const newStarRadius = 0.1 + starIntensity * 0.05;
                    const starEmissive = starIntensity * 0.8 + 0.2;
                    
                    this.centralStar.setAttribute('radius', newStarRadius);
                    this.centralStar.setAttribute('material', {
                        shader: 'standard',
                        metalness: 0.2,
                        roughness: 0.1,
                        emissive: '#FFF700',
                        emissiveIntensity: starEmissive
                    });
                }
                
                // 各惑星軌道の更新
                this.planets.forEach((planet, index) => {
                    if (planet && this.planetOrbits[index] && this.orbitContainers[index]) {
                        // 音域に応じた反応を設定
                        let intensity;
                        if (index === 0 || index === 1) intensity = bassIntensity;
                        else if (index === 2 || index === 3) intensity = midIntensity;
                        else intensity = highIntensity;
                        
                        // 惑星のサイズ変化
                        const newRadius = this.basePlanetRadii[index] * (1 + intensity * 0.8);
                        planet.setAttribute('radius', newRadius);
                        
                        // 惑星の発光強度
                        const emissiveIntensity = 0.3 + intensity * 0.5;
                        const currentMaterial = planet.getAttribute('material');
                        planet.setAttribute('material', {
                            ...currentMaterial,
                            emissiveIntensity: emissiveIntensity
                        });
                        
                        // 軌道速度の変化（音楽に反応して高速化）
                        const speedMultiplier = 1 + intensity * 1.5;
                        const newDuration = Math.max(1000, this.baseOrbitSpeeds[index] / speedMultiplier);
                        
                        // アニメーションの更新
                        this.planetOrbits[index].setAttribute('animation', {
                            property: 'rotation',
                            to: index % 2 === 0 ? '0 360 0' : '0 -360 0',
                            loop: true,
                            dur: newDuration,
                            easing: 'linear'
                        });
                        
                        // 軌道全体の動的傾斜（低音に反応）
                        const baseRot = this.baseRotations[index];
                        const dynamicTilt = bassIntensity * 20;
                        this.orbitContainers[index].setAttribute('rotation', 
                            `${baseRot.x + dynamicTilt} ${baseRot.y} ${baseRot.z + dynamicTilt}`
                        );
                    }
                });
                
                // 軌道システム全体の回転（音楽全体に反応）
                if (orbitalSystem) {
                    const systemRotationSpeed = totalIntensity * 0.5;
                    const currentRotation = orbitalSystem.getAttribute('rotation') || {x: 0, y: 0, z: 0};
                    const newRotationY = (currentRotation.y || 0) + systemRotationSpeed;
                    orbitalSystem.setAttribute('rotation', `0 ${newRotationY} 0`);
                }
            }
        }
    });

    // パーティクルシステム制御コンポーネント
    AFRAME.registerComponent('particle-controller', {
        init: function () {
            this.particleSystems = [
                document.getElementById('particle-system1'),
                document.getElementById('particle-system2'),
                document.getElementById('particle-system3')
            ];
            this.baseParticleCounts = [100, 50, 80]; // 各システムの基本パーティクル数
            this.bassRange = [0, 5]; // 低音域
            this.midRange = [6, 15]; // 中音域
            this.highRange = [16, 31]; // 高音域
        },
        
        tick: function () {
            if (analyser && !audio.paused) {
                const freqByteData = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(freqByteData);
                
                // 音域別の強度を計算
                const bassIntensity = this.getFrequencyRangeIntensity(freqByteData, this.bassRange);
                const midIntensity = this.getFrequencyRangeIntensity(freqByteData, this.midRange);
                const highIntensity = this.getFrequencyRangeIntensity(freqByteData, this.highRange);
                
                // パーティクルシステムを音楽に同期
                this.updateParticleSystem(this.particleSystems[0], bassIntensity, 0);
                this.updateParticleSystem(this.particleSystems[1], midIntensity, 1);
                this.updateParticleSystem(this.particleSystems[2], highIntensity, 2);
            }
        },
        
        getFrequencyRangeIntensity: function (freqData, range) {
            let sum = 0;
            for (let i = range[0]; i <= range[1]; i++) {
                sum += freqData[i];
            }
            return sum / ((range[1] - range[0] + 1) * 255); // 正規化
        },
        
        updateParticleSystem: function (system, intensity, index) {
            if (!system) return;
            
            // パーティクル数を音楽強度に応じて調整
            const newParticleCount = Math.floor(this.baseParticleCounts[index] * (1 + intensity * 2));
            
            // サイズを音楽強度に応じて調整
            const sizeMultiplier = 1 + intensity * 0.8;
            const baseSize = index === 0 ? 0.5 : (index === 1 ? 0.35 : 0.25);
            const newSize = `${baseSize * sizeMultiplier},${baseSize * sizeMultiplier * 1.6}`;
            
            // 速度を音楽強度に応じて調整
            const velocityMultiplier = 1 + intensity * 1.5;
            
            // パーティクルシステムの属性を更新
            system.setAttribute('particle-system', {
                particleCount: newParticleCount,
                size: newSize,
                opacity: 0.6 + intensity * 0.4
            });
            
            // 色の強度も調整
            const colorIntensity = Math.floor(intensity * 255);
            const colors = [
                `rgb(255,${215 + colorIntensity * 0.16},0)`,
                `rgb(255,${107 + colorIntensity * 0.58},${107 + colorIntensity * 0.58})`,
                `rgb(${78 + colorIntensity * 0.69},${236 + colorIntensity * 0.07},${196 + colorIntensity * 0.23})`
            ];
        }
    });

    // DOMContentLoaded以降に実行されるように、initAudioAnalyserの呼び出しをここに移動
    init();
    async function init() {
         // AudioContextはユーザー操作後に初期化するため、ここでは呼ばない
         console.log('AR Music Visualizer with Orbital Planetary System initialized');
         
         // パーティクル制御コンポーネントをシーンに追加
         scene.setAttribute('particle-controller', '');
         
         // 惑星軌道システム制御コンポーネントをシーンに追加
         scene.setAttribute('orbital-system-controller', '');
    }
});
