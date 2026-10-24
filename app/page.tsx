'use client';

import React, { useState, useEffect, useRef } from 'react';

// Доступные бесплатные скины
const SKINS = [
  { id: 'cyan', name: 'Синий', color: '#00f3ff', trail: '#00f3ff' },
  { id: 'pink', name: 'Розовый', color: '#ec4899', trail: '#ec4899' },
  { id: 'purple', name: 'Фиолетовый', color: '#a855f7', trail: '#a855f7' },
  { id: 'green', name: 'Зеленый', color: '#22c55e', trail: '#22c55e' },
  { id: 'white', name: 'Белый', color: '#f8fafc', trail: '#e2e8f0' },
  { id: 'orange', name: 'Оранжевый', color: '#f97316', trail: '#f97316' },
];

export default function CyberDash() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'>('START');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [totalCoins, setTotalCoins] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(60);
  const [boost, setBoost] = useState<number>(100);

  // Реф для монет (чтобы не сбрасывать скорость при подборе)
  const totalCoinsRef = useRef<number>(0);

  // Выбранный скин
  const [selectedSkin, setSelectedSkin] = useState<string>('cyan');

  // Способности
  const [activeMagnet, setActiveMagnet] = useState<boolean>(false);
  const [activeSlowmo, setActiveSlowmo] = useState<boolean>(false);
  const [laserAmmo, setLaserAmmo] = useState<number>(0);
  const [comboText, setComboText] = useState<string>('');

  // Состояние нажимаемых мобильных кнопок
  const mobileKeysRef = useRef({ left: false, right: false, up: false, shoot: false });

  // Уровни прокачки
  const [upgrades, setUpgrades] = useState({
    nitro: 1,
    magnet: 1,
    slowmo: 1,
    laser: 1,
  });

  const audioCtxRef = useRef<AudioContext | null>(null);

  const CANVAS_WIDTH = 750;
  const CANVAS_HEIGHT = 650;

  // Звуковой синтезатор
  const playSound = (type: 'coin' | 'crash' | 'shield' | 'magnet' | 'slowmo' | 'laser' | 'boss') => {
    if (!audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'crash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'laser') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(900, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'shield' || type === 'magnet' || type === 'slowmo') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'boss') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {}
  };

  // Загрузка сохранений
  useEffect(() => {
    const savedHi = localStorage.getItem('cyber_dash_hi');
    if (savedHi) setHighScore(parseInt(savedHi, 10));

    const savedCoins = localStorage.getItem('cyber_dash_coins');
    if (savedCoins) {
      const val = parseInt(savedCoins, 10);
      setTotalCoins(val);
      totalCoinsRef.current = val;
    }

    const savedUpgrades = localStorage.getItem('cyber_dash_upgrades');
    if (savedUpgrades) {
      try {
        setUpgrades(JSON.parse(savedUpgrades));
      } catch (e) {}
    }

    const savedSkin = localStorage.getItem('cyber_dash_skin');
    if (savedSkin) setSelectedSkin(savedSkin);
  }, []);

  // Покупка улучшений
  const buyUpgrade = (key: 'nitro' | 'magnet' | 'slowmo' | 'laser') => {
    const cost = upgrades[key] * 100;
    if (totalCoins >= cost && upgrades[key] < 5) {
      const nextCoins = totalCoins - cost;
      const nextUpgrades = { ...upgrades, [key]: upgrades[key] + 1 };

      setTotalCoins(nextCoins);
      totalCoinsRef.current = nextCoins;
      setUpgrades(nextUpgrades);

      localStorage.setItem('cyber_dash_coins', nextCoins.toString());
      localStorage.setItem('cyber_dash_upgrades', JSON.stringify(nextUpgrades));
    }
  };

  // Выбор скина
  const selectSkin = (id: string) => {
    setSelectedSkin(id);
    localStorage.setItem('cyber_dash_skin', id);
  };

  // Переключение паузы
  const togglePause = () => {
    setGameState((prev) => (prev === 'PLAYING' ? 'PAUSED' : prev === 'PAUSED' ? 'PLAYING' : prev));
  };

  // Игровой цикл
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let localScore = 0;
    let localSpeed = 0.5;
    let localBoost = 100;
    let gridOffset = 0;
    let shakeTime = 0;
    let comboMultiplier = 1;
    let comboResetTimer = 0;

    let magnetTimer = 0;
    let slowmoTimer = 0;
    let currentLaserAmmo = upgrades.laser > 1 ? upgrades.laser - 1 : 0;
    let hasShield = upgrades.laser >= 3;

    setLaserAmmo(currentLaserAmmo);

    const playerSkin = SKINS.find((s) => s.id === selectedSkin) || SKINS[0];

    const player = {
      x: CANVAS_WIDTH / 2 - 18,
      y: CANVAS_HEIGHT - 100,
      w: 36,
      h: 56,
      vx: 0,
    };

    const keys = { left: false, right: false, up: false, shoot: false };

    interface Obstacle {
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      vx: number;
      speedYRatio?: number;
      isTruck?: boolean;
      isGhost?: boolean;
    }
    interface Coin { x: number; y: number; r: number; pulse: number; }
    interface Powerup { x: number; y: number; size: number; type: 'SHIELD' | 'MAGNET' | 'SLOWMO' | 'LASER'; }
    interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }
    interface LaserBeam { x: number; y: number; w: number; h: number; }

    const obstacles: Obstacle[] = [];
    const coins: Coin[] = [];
    const powerups: Powerup[] = [];
    const particles: Particle[] = [];
    const lasers: LaserBeam[] = [];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        togglePause();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = true;
      if ((e.key === ' ' || e.key === 'k' || e.key === 'K') && !keys.shoot) {
        keys.shoot = true;
        shootLaser();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
      if (e.key === ' ' || e.key === 'k' || e.key === 'K') keys.shoot = false;
    };

    const shootLaser = () => {
      if (currentLaserAmmo > 0) {
        currentLaserAmmo--;
        setLaserAmmo(currentLaserAmmo);
        playSound('laser');
        lasers.push({
          x: player.x + player.w / 2 - 4,
          y: player.y - 10,
          w: 8,
          h: 30,
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let spawnTimer = 0;

    const triggerShake = (intensity = 10) => {
      shakeTime = intensity;
    };

    const spawnParticles = (x: number, y: number, count: number, color: string, speedMax = 3) => {
      for (let i = 0; i < count; i++) {
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * speedMax,
          vy: Math.random() * speedMax + 1,
          life: 1.0,
          color,
          size: Math.random() * 3 + 2,
        });
      }
    };

    const loop = () => {
      ctx.save();

      // Объединяем физические клавиши и сенсорное нажатие на телефоне
      const isLeft = keys.left || mobileKeysRef.current.left;
      const isRight = keys.right || mobileKeysRef.current.right;
      const isUp = keys.up || mobileKeysRef.current.up;

      // Обработка выстрела лазера с сенсора
      if (mobileKeysRef.current.shoot) {
        mobileKeysRef.current.shoot = false; // Сбрасываем триггер выстрела
        shootLaser();
      }

      if (shakeTime > 0) {
        const dx = (Math.random() - 0.5) * shakeTime;
        const dy = (Math.random() - 0.5) * shakeTime;
        ctx.translate(dx, dy);
        shakeTime *= 0.9;
        if (shakeTime < 0.5) shakeTime = 0;
      }

      ctx.fillStyle = '#050512';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (magnetTimer > 0) {
        magnetTimer--;
        if (magnetTimer === 0) setActiveMagnet(false);
      }
      if (slowmoTimer > 0) {
        slowmoTimer--;
        if (slowmoTimer === 0) setActiveSlowmo(false);
      }

      const slowFactor = slowmoTimer > 0 ? 0.55 : 1.0;

      let speedMult = 1;
      const nitroBurnRate = 0.7 / (upgrades.nitro * 0.4 + 0.6);
      const nitroRechargeRate = 0.18 * (upgrades.nitro * 0.3 + 0.7);

      if (isUp && localBoost > 0) {
        speedMult = 1.8;
        localBoost = Math.max(0, localBoost - nitroBurnRate);
        if (Math.random() < 0.5) triggerShake(1.2);
      } else {
        localBoost = Math.min(100, localBoost + nitroRechargeRate);
      }
      setBoost(Math.floor(localBoost));

      localSpeed += 0.00017;
      const currentSpeed = localSpeed * speedMult * slowFactor;
      const displayKmH = Math.floor(120 * localSpeed * speedMult);

      if (comboResetTimer > 0) {
        comboResetTimer--;
        if (comboResetTimer === 0) {
          comboMultiplier = 1;
          setComboText('');
        }
      }

      localScore += 0.2 * currentSpeed * comboMultiplier;
      setScore(Math.floor(localScore));
      setSpeed(displayKmH);

      gridOffset = (gridOffset + 4 * currentSpeed) % 40;

      // Отрисовка дороги
      ctx.strokeStyle = slowmoTimer > 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 243, 255, 0.2)';
      ctx.lineWidth = 1;
      for (let y = gridOffset; y < CANVAS_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(CANVAS_WIDTH - 50, y);
        ctx.stroke();
      }

      ctx.setLineDash([15, 15]);
      ctx.lineDashOffset = -gridOffset * 1.5;
      ctx.strokeStyle = slowmoTimer > 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(0, 243, 255, 0.25)';
      ctx.lineWidth = 2;

      const laneStep = (CANVAS_WIDTH - 100) / 6;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(50 + laneStep * i, 0);
        ctx.lineTo(50 + laneStep * i, CANVAS_HEIGHT);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      ctx.strokeStyle = slowmoTimer > 0 ? '#10b981' : playerSkin.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 15;

      ctx.beginPath();
      ctx.moveTo(50, 0);
      ctx.lineTo(50, CANVAS_HEIGHT);
      ctx.moveTo(CANVAS_WIDTH - 50, 0);
      ctx.lineTo(CANVAS_WIDTH - 50, CANVAS_HEIGHT);
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (isLeft) player.vx = -7.5;
      else if (isRight) player.vx = 7.5;
      else player.vx *= 0.8;

      player.x += player.vx;
      player.x = Math.max(55, Math.min(CANVAS_WIDTH - 55 - player.w, player.x));

      if (isUp && localBoost > 0) {
        spawnParticles(player.x + player.w / 2, player.y + player.h, 3, '#ff0055', 6);
        spawnParticles(player.x + player.w / 2, player.y + player.h, 2, '#ffcc00', 4);
      } else {
        spawnParticles(player.x + player.w / 2, player.y + player.h, 1, playerSkin.trail, 2);
      }

      for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i];
        l.y -= 14;

        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 12;
        ctx.fillRect(l.x, l.y, l.w, l.h);
        ctx.shadowBlur = 0;

        if (l.y < -50) lasers.splice(i, 1);
      }

      spawnTimer++;
      if (spawnTimer > 70 / currentSpeed) {
        spawnTimer = 0;
        const roadWidth = CANVAS_WIDTH - 160;
        const laneX = 65 + Math.random() * roadWidth;
        const rand = Math.random();

        if (rand < 0.45) {
          const enemyRand = Math.random();

          if (displayKmH >= 250 && enemyRand < 0.25) {
            obstacles.push({
              x: laneX,
              y: -90,
              w: 36,
              h: 56,
              color: '#c084fc',
              vx: (Math.random() - 0.5) * 2,
              speedYRatio: 1.5,
              isGhost: true,
            });
            playSound('boss');
          } else if (displayKmH >= 200 && enemyRand < 0.45) {
            obstacles.push({
              x: laneX,
              y: -120,
              w: 70,
              h: 110,
              color: '#dc2626',
              vx: 0,
              speedYRatio: 0.9,
              isTruck: true,
            });
          } else {
            const isDrifter = Math.random() < 0.25;
            obstacles.push({
              x: laneX,
              y: -90,
              w: 36,
              h: 56,
              color: '#ff0055',
              vx: isDrifter ? (Math.random() - 0.5) * 1.5 : 0,
            });
          }
        } else if (rand < 0.78) {
          coins.push({ x: laneX + 15, y: -40, r: 14, pulse: 0 });
        } else {
          const types: ('SHIELD' | 'MAGNET' | 'SLOWMO' | 'LASER')[] = ['SHIELD', 'MAGNET', 'SLOWMO', 'LASER'];
          const chosenType = types[Math.floor(Math.random() * types.length)];
          powerups.push({ x: laneX + 15, y: -40, size: 26, type: chosenType });
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillRect(p.x, p.y, p.size, p.size);

        if (p.life <= 0) particles.splice(i, 1);
      }
      ctx.globalAlpha = 1.0;

      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        const speedRatio = obs.speedYRatio || 1.0;
        obs.y += 3.5 * currentSpeed * speedRatio;
        obs.x += obs.vx;

        if (obs.x < 55 || obs.x + obs.w > CANVAS_WIDTH - 55) {
          obs.vx *= -1;
        }

        for (let j = lasers.length - 1; j >= 0; j--) {
          const l = lasers[j];
          if (
            l.x < obs.x + obs.w &&
            l.x + l.w > obs.x &&
            l.y < obs.y + obs.h &&
            l.y + l.h > obs.y
          ) {
            spawnParticles(obs.x + obs.w / 2, obs.y + obs.h / 2, 20, obs.color, 6);
            playSound('crash');
            triggerShake(8);
            obstacles.splice(i, 1);
            lasers.splice(j, 1);
            break;
          }
        }

        if (!obstacles[i]) continue;

        ctx.fillStyle = obs.color;
        ctx.shadowColor = obs.color;
        ctx.shadowBlur = obs.isGhost ? 20 : 12;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

        if (obs.isTruck) {
          ctx.fillStyle = '#18181b';
          ctx.fillRect(obs.x + 6, obs.y + 20, obs.w - 12, obs.h - 30);
        } else {
          ctx.fillStyle = '#111';
          ctx.fillRect(obs.x + 4, obs.y + 12, obs.w - 8, 18);
        }
        ctx.shadowBlur = 0;

        const distToPlayer = Math.hypot(
          player.x + player.w / 2 - (obs.x + obs.w / 2),
          player.y + player.h / 2 - (obs.y + obs.h / 2)
        );

        if (distToPlayer < 65 && distToPlayer > 35 && comboResetTimer === 0) {
          comboMultiplier = Math.min(5, comboMultiplier + 1);
          comboResetTimer = 120;
          setComboText(`NEAR MISS! x${comboMultiplier}`);
          spawnParticles(player.x + player.w / 2, player.y, 8, '#f59e0b', 3);
        }

        if (
          player.x < obs.x + obs.w &&
          player.x + player.w > obs.x &&
          player.y < obs.y + obs.h &&
          player.y + player.h > obs.y
        ) {
          if (hasShield) {
            hasShield = false;
            playSound('crash');
            triggerShake(12);
            spawnParticles(obs.x + obs.w / 2, obs.y + obs.h / 2, 20, playerSkin.color, 8);
            obstacles.splice(i, 1);
          } else {
            playSound('crash');
            triggerShake(25);
            spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 35, '#ff0055', 10);

            const finalScore = Math.floor(localScore);
            if (finalScore > highScore) {
              setHighScore(finalScore);
              localStorage.setItem('cyber_dash_hi', finalScore.toString());
            }

            setGameState('GAMEOVER');
            ctx.restore();
            return;
          }
        }

        if (obs.y > CANVAS_HEIGHT + 150) obstacles.splice(i, 1);
      }

      // Монетки
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        c.y += 3.5 * currentSpeed;
        c.pulse += 0.1;

        if (magnetTimer > 0) {
          const pullSpeed = 0.08 + upgrades.magnet * 0.03;
          const dx = player.x + player.w / 2 - c.x;
          const dy = player.y + player.h / 2 - c.y;
          c.x += dx * pullSpeed;
          c.y += dy * pullSpeed;
        }

        const rPulse = c.r + Math.sin(c.pulse) * 2;

        ctx.fillStyle = '#ffcc00';
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(c.x, c.y, rPulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (Math.hypot(player.x + player.w / 2 - c.x, player.y + player.h / 2 - c.y) < player.w / 2 + c.r) {
          localScore += 60;

          totalCoinsRef.current += 1;
          setTotalCoins(totalCoinsRef.current);
          localStorage.setItem('cyber_dash_coins', totalCoinsRef.current.toString());

          playSound('coin');
          spawnParticles(c.x, c.y, 10, '#ffcc00', 4);
          coins.splice(i, 1);
        }

        if (c.y > CANVAS_HEIGHT + 50) coins.splice(i, 1);
      }

      for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.y += 3.5 * currentSpeed;

        let pColor = '#00f3ff';
        if (p.type === 'MAGNET') pColor = '#a855f7';
        if (p.type === 'SLOWMO') pColor = '#10b981';
        if (p.type === 'LASER') pColor = '#f59e0b';

        ctx.fillStyle = pColor;
        ctx.shadowColor = pColor;
        ctx.shadowBlur = 15;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.shadowBlur = 0;

        if (Math.hypot(player.x + player.w / 2 - p.x, player.y + player.h / 2 - p.y) < player.w / 2 + p.size) {
          if (p.type === 'SHIELD') {
            hasShield = true;
            playSound('shield');
          } else if (p.type === 'MAGNET') {
            magnetTimer = 250 + upgrades.magnet * 100;
            setActiveMagnet(true);
            playSound('magnet');
          } else if (p.type === 'SLOWMO') {
            slowmoTimer = 200 + upgrades.slowmo * 100;
            setActiveSlowmo(true);
            playSound('slowmo');
          } else if (p.type === 'LASER') {
            currentLaserAmmo += 3;
            setLaserAmmo(currentLaserAmmo);
            playSound('laser');
          }

          spawnParticles(p.x, p.y, 15, pColor, 5);
          powerups.splice(i, 1);
        }

        if (p.y > CANVAS_HEIGHT + 50) powerups.splice(i, 1);
      }

      // Машина игрока
      ctx.fillStyle = playerSkin.color;
      ctx.shadowColor = playerSkin.color;
      ctx.shadowBlur = hasShield ? 22 : 12;
      ctx.fillRect(player.x, player.y, player.w, player.h);

      ctx.fillStyle = '#0a0a20';
      ctx.fillRect(player.x + 4, player.y + 12, player.w - 8, 20);

      ctx.fillStyle = '#ff0055';
      ctx.fillRect(player.x + 3, player.y + player.h - 5, 8, 3);
      ctx.fillRect(player.x + player.w - 11, player.y + player.h - 5, 8, 3);

      if (hasShield) {
        ctx.strokeStyle = playerSkin.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x + player.w / 2, player.y + player.h / 2, player.w * 0.8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      ctx.restore();
      animId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, selectedSkin, upgrades]);

  const startGame = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    setScore(0);
    setActiveMagnet(false);
    setActiveSlowmo(false);
    setBoost(100);
    setGameState('PLAYING');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white font-mono p-2 sm:p-4 select-none touch-none">
      {/* HUD Панель */}
      <div className="w-full max-w-[750px] flex justify-between items-center mb-2 text-[10px] sm:text-xs gap-1 sm:gap-2">
        <div className="bg-slate-900 border border-cyan-500/40 px-2 sm:px-3 py-1 rounded flex gap-1">
          <span className="text-slate-400">СЧЕТ:</span>
          <span className="text-cyan-400 font-bold">{score}</span>
        </div>
        <div className="bg-slate-900 border border-yellow-500/40 px-2 sm:px-3 py-1 rounded flex gap-1">
          <span className="text-slate-400">МОНЕТЫ:</span>
          <span className="text-yellow-400 font-bold">🪙 {totalCoins}</span>
        </div>
        <div className="bg-slate-900 border border-yellow-500/40 px-2 sm:px-3 py-1 rounded flex gap-1">
          <span className="text-slate-400">РЕКОРД:</span>
          <span className="text-yellow-400 font-bold">{highScore}</span>
        </div>
        <div className="bg-slate-900 border border-pink-500/40 px-2 sm:px-3 py-1 rounded flex gap-1">
          <span className="text-slate-400">СКОРОСТЬ:</span>
          <span className="text-pink-500 font-bold">{speed} KM/H</span>
        </div>

        {gameState === 'PLAYING' && (
          <button
            onClick={togglePause}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-2.5 py-1 rounded text-white font-bold transition active:scale-95"
          >
            ⏸️
          </button>
        )}
      </div>

      {/* Индикаторы бонусов */}
      <div className="w-full max-w-[750px] flex gap-2 mb-2 text-[10px] sm:text-xs">
        {activeMagnet && (
          <div className="bg-purple-900/60 border border-purple-500 px-2 py-0.5 rounded text-purple-300 animate-pulse">
            🧲 МАГНИТ
          </div>
        )}
        {activeSlowmo && (
          <div className="bg-emerald-900/60 border border-emerald-500 px-2 py-0.5 rounded text-emerald-300 animate-pulse">
            ⏱️ SLOW-MO
          </div>
        )}
        {laserAmmo > 0 && (
          <div className="bg-amber-900/60 border border-amber-500 px-2 py-0.5 rounded text-amber-300">
            🔫 ЛАЗЕР: {laserAmmo}
          </div>
        )}
      </div>

      {/* Игровой Холст */}
      <div className="relative w-full max-w-[750px] border-2 border-cyan-500/30 rounded-2xl overflow-hidden shadow-2xl bg-slate-900">
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block w-full h-auto" />

        {comboText && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-amber-400 font-extrabold text-xs sm:text-sm tracking-widest bg-slate-950/80 px-3 py-1 rounded-full border border-amber-500/40 animate-bounce">
            {comboText}
          </div>
        )}

        {/* Шкала Нитро */}
        {gameState === 'PLAYING' && (
          <div className="absolute top-3 left-4 right-4 h-1.5 bg-slate-950/80 rounded-full border border-cyan-500/30 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 transition-all duration-75"
              style={{ width: `${boost}%` }}
            />
          </div>
        )}

        {/* НАЭКРАННЫЕ КНОПКИ ДЛЯ МОБИЛЬНЫХ УСТРОЙСТВ */}
{gameState === 'PLAYING' && (
  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center pointer-events-none">
    {/* Кнопки поворотов влево/вправо в нижне-левом углу */}
    <div className="flex gap-2 pointer-events-auto">
      <button
        onTouchStart={(e) => { e.preventDefault(); mobileKeysRef.current.left = true; }}
        onTouchEnd={(e) => { e.preventDefault(); mobileKeysRef.current.left = false; }}
        onMouseDown={() => (mobileKeysRef.current.left = true)}
        onMouseUp={() => (mobileKeysRef.current.left = false)}
        className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-950/80 border-2 border-cyan-500/80 rounded-full text-cyan-400 flex items-center justify-center active:bg-cyan-500/40 active:scale-95 shadow-lg backdrop-blur-sm"
      >
        <span className="text-lg">◀</span>
      </button>
      <button
        onTouchStart={(e) => { e.preventDefault(); mobileKeysRef.current.right = true; }}
        onTouchEnd={(e) => { e.preventDefault(); mobileKeysRef.current.right = false; }}
        onMouseDown={() => (mobileKeysRef.current.right = true)}
        onMouseUp={() => (mobileKeysRef.current.right = false)}
        className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-950/80 border-2 border-cyan-500/80 rounded-full text-cyan-400 flex items-center justify-center active:bg-cyan-500/40 active:scale-95 shadow-lg backdrop-blur-sm"
      >
        <span className="text-lg">▶</span>
      </button>
    </div>

    {/* Кнопки действий (Лазер и Нитро) справа */}
    <div className="flex gap-2 pointer-events-auto">
      {laserAmmo > 0 && (
        <button
          onTouchStart={(e) => { e.preventDefault(); mobileKeysRef.current.shoot = true; }}
          onClick={() => (mobileKeysRef.current.shoot = true)}
          className="w-12 h-12 sm:w-14 sm:h-14 bg-amber-950/80 border-2 border-amber-500/80 rounded-full text-lg flex items-center justify-center active:bg-amber-500/40 active:scale-95 text-amber-300 font-bold backdrop-blur-sm shadow-lg"
        >
          🔫
        </button>
      )}
      <button
        onTouchStart={(e) => { e.preventDefault(); mobileKeysRef.current.up = true; }}
        onTouchEnd={(e) => { e.preventDefault(); mobileKeysRef.current.up = false; }}
        onMouseDown={() => (mobileKeysRef.current.up = true)}
        onMouseUp={() => (mobileKeysRef.current.up = false)}
        className="w-12 h-12 sm:w-14 sm:h-14 bg-pink-950/80 border-2 border-pink-500/80 rounded-full text-xs flex items-center justify-center active:bg-pink-500/40 active:scale-95 text-pink-400 font-extrabold backdrop-blur-sm shadow-lg uppercase"
      >
        ⚡
      </button>
    </div>
  </div>
)}

        {/* Экран Паузы */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
            <h2 className="text-3xl font-black italic tracking-wider text-yellow-400 mb-6">ПАУЗА</h2>
            <div className="flex flex-col gap-3 w-48">
              <button
                onClick={togglePause}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 rounded-full shadow-lg transition transform active:scale-95 text-xs uppercase tracking-wider"
              >
                ПРОДОЛЖИТЬ
              </button>
              <button
                onClick={() => setGameState('START')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-full border border-slate-600 transition transform active:scale-95 text-xs uppercase tracking-wider"
              >
                В МЕНЮ / ГАРАЖ
              </button>
            </div>
          </div>
        )}

        {/* Главное Меню / Гараж */}
        {(gameState === 'START' || gameState === 'GAMEOVER') && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 text-center overflow-y-auto">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black italic tracking-wider text-cyan-400 mb-1">CYBER DASH</h1>
              <p className="text-slate-400 text-[10px] sm:text-xs mb-3">
                Управляйте сенсорными кнопками на смартфоне или клавишами A/D на ПК
              </p>
            </div>

            {/* Выбор 6 бесплатных скинов */}
            <div className="w-full max-w-lg mb-3">
              <h2 className="text-[10px] sm:text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                Выбор скина машины (Бесплатно)
              </h2>
              <div className="grid grid-cols-6 gap-1.5">
                {SKINS.map((skin) => (
                  <button
                    key={skin.id}
                    onClick={() => selectSkin(skin.id)}
                    className={`flex flex-col items-center justify-center p-1.5 rounded-lg border transition ${
                      selectedSkin === skin.id
                        ? 'border-cyan-400 bg-cyan-950/60 scale-105 shadow-lg'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'
                    }`}
                  >
                    <div
                      className="w-4 h-7 rounded mb-1 border border-slate-700 shadow-md"
                      style={{ backgroundColor: skin.color }}
                    />
                    <span className="text-[9px] font-bold text-slate-300">{skin.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Магазин Прокачки */}
            <div className="w-full max-w-lg grid grid-cols-2 gap-2 mb-4 text-left">
              <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold text-cyan-400">🔋 Нитро Бак</div>
                  <div className="text-[9px] text-slate-400 mb-1">Уровень {upgrades.nitro}/5</div>
                </div>
                <button
                  onClick={() => buyUpgrade('nitro')}
                  disabled={upgrades.nitro >= 5 || totalCoins < upgrades.nitro * 100}
                  className="w-full py-1 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[9px] font-bold rounded transition"
                >
                  {upgrades.nitro >= 5 ? 'MAX' : `Улучшить: 🪙 ${upgrades.nitro * 100}`}
                </button>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold text-purple-400">🧲 Магнит</div>
                  <div className="text-[9px] text-slate-400 mb-1">Уровень {upgrades.magnet}/5</div>
                </div>
                <button
                  onClick={() => buyUpgrade('magnet')}
                  disabled={upgrades.magnet >= 5 || totalCoins < upgrades.magnet * 100}
                  className="w-full py-1 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[9px] font-bold rounded transition"
                >
                  {upgrades.magnet >= 5 ? 'MAX' : `Улучшить: 🪙 ${upgrades.magnet * 100}`}
                </button>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold text-emerald-400">⏱️ Slow-Mo</div>
                  <div className="text-[9px] text-slate-400 mb-1">Уровень {upgrades.slowmo}/5</div>
                </div>
                <button
                  onClick={() => buyUpgrade('slowmo')}
                  disabled={upgrades.slowmo >= 5 || totalCoins < upgrades.slowmo * 100}
                  className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[9px] font-bold rounded transition"
                >
                  {upgrades.slowmo >= 5 ? 'MAX' : `Улучшить: 🪙 ${upgrades.slowmo * 100}`}
                </button>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold text-amber-400">🛡️ Лазер & Щит</div>
                  <div className="text-[9px] text-slate-400 mb-1">Уровень {upgrades.laser}/5</div>
                </div>
                <button
                  onClick={() => buyUpgrade('laser')}
                  disabled={upgrades.laser >= 5 || totalCoins < upgrades.laser * 100}
                  className="w-full py-1 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-[9px] font-bold rounded transition"
                >
                  {upgrades.laser >= 5 ? 'MAX' : `Улучшить: 🪙 ${upgrades.laser * 100}`}
                </button>
              </div>
            </div>

            <button
              onClick={startGame}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-10 py-3 rounded-full shadow-lg transition transform active:scale-95 text-xs uppercase tracking-wider mb-1"
            >
              {gameState === 'START' ? 'ПОЕХАЛИ!' : 'ИГРАТЬ СНОВА'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}