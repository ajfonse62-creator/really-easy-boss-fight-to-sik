function loadImg(el, name, fb) {
    const ex = ['.png', '.jpg', '.jpeg', '.webp', '.PNG', '.JPG'];
    let i = 0;
    function next() {
        if (i >= ex.length) { el.removeAttribute('src'); if (fb) el.classList.add(fb); return; }
        el.src = name + ex[i++];
    }
    el.onerror = next; next();
}
loadImg(document.getElementById('boss-img'), 'boss', null);
loadImg(document.getElementById('soul'), 'soul', null);

// WebGL-шейдер Deltarune
const bg = document.getElementById('shader-bg');
const gl = bg.getContext('webgl');
function resize() { bg.width = innerWidth; bg.height = innerHeight; if (gl) gl.viewport(0, 0, bg.width, bg.height); }
window.addEventListener('resize', resize); resize();

const vs = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(vs, 'attribute vec2 p; void main(){ gl_Position=vec4(p,0.0,1.0); }');
gl.compileShader(vs);

const fs = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(fs, `
precision mediump float;
uniform float u_t;
uniform vec2 u_r;
void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_r) / u_r.y;
    vec2 p1 = uv * 5.5;
    p1.x += sin(p1.y * 1.8 + u_t * 1.8) * 0.22 + u_t * 0.35;
    p1.y += cos(p1.x * 1.8 + u_t * 1.4) * 0.22 - u_t * 0.25;
    vec2 f1 = abs(fract(p1) - 0.5);
    float l1 = smoothstep(0.45, 0.485, max(f1.x, f1.y));
    
    vec2 p2 = uv * 3.0;
    p2.x -= sin(p2.y * 1.2 - u_t) * 0.15 + u_t * 0.15;
    p2.y += u_t * 0.15;
    vec2 f2 = abs(fract(p2) - 0.5);
    float l2 = smoothstep(0.46, 0.49, max(f2.x, f2.y));
    
    vec3 col = vec3(0.03, 0.01, 0.07);
    col += vec3(0.28, 0.06, 0.48) * l2 * 0.65;
    col += vec3(0.62, 0.18, 0.92) * l1 * 0.9;
    col *= 1.15 - length(uv) * 0.65;
    gl_FragColor = vec4(col, 1.0);
}`);
gl.compileShader(fs);

const prog = gl.createProgram();
gl.attachShader(prog, vs); gl.attachShader(prog, fs);
gl.linkProgram(prog); gl.useProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p');
gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

const uT = gl.getUniformLocation(prog, 'u_t'), uR = gl.getUniformLocation(prog, 'u_r');
function drawBg(ms) {
    gl.uniform1f(uT, ms * 0.001);
    gl.uniform2f(uR, bg.width, bg.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(drawBg);
}
requestAnimationFrame(drawBg);

// Переменные боя (лёгкий режим + бесконечная еда)
const box = document.getElementById('battle-box'), soul = document.getElementById('soul'),
      diag = document.getElementById('dialogue-box'), sub = document.getElementById('submenu'),
      fg = document.getElementById('fight-minigame'), cur = document.getElementById('cursor-bar');

let hp = 20, bHp = 100, sX = 128, sY = 85, state = 'menu', mult = 1, rage = 1;
let keys = {}, bul = [], haz = [], curX = 0, fInt = null;
const items = [
    { n: "Бесконечная кукуруза (+15 HP)", h: 15 },
    { n: "Бесконечный пирог (FULL HP)", h: 20 }
];

window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyZ' || e.code === 'Enter') handleActionPress();
});
window.addEventListener('keyup', e => keys[e.code] = false);

function handleActionPress() {
    if (state === 'aim') hitConfirm();
    else if (state === 'def') shoot();
}

function openMenu(type) {
    if (state !== 'menu') return;
    sub.style.display = 'none'; fg.style.display = 'none';
    if (type === 'fight') {
        state = 'aim'; fg.style.display = 'flex'; curX = 0;
        diag.textContent = "* Жми ОГОНЬ в жёлтой зоне!";
        fInt = setInterval(() => {
            curX += 5; cur.style.left = curX + 'px';
            if (curX >= 274) hitConfirm();
        }, 16);
    } else if (type === 'act') {
        sub.style.display = 'flex';
        sub.innerHTML = `<button onclick="doAct('chk')">* Осмотреть</button><button onclick="doAct('foc')">* Фокус (x1.5 урон)</button><button onclick="doAct('tnt')">* Дразнить</button>`;
    } else if (type === 'item') {
        sub.style.display = 'flex';
        sub.innerHTML = items.map((it, i) => `<button onclick="useItem(${i})">* ${it.n} [∞]</button>`).join('');
    } else if (type === 'mercy') {
        diag.textContent = "* Цветок не принимает пощаду!"; enemyTurn();
    }
}

function hitConfirm() {
    clearInterval(fInt); fg.style.display = 'none';
    let dist = Math.abs(137 - curX);
    let base = curX >= 274 ? 0 : (dist < 22 ? 40 : (dist < 55 ? 25 : 15));
    let dmg = Math.round(base * mult); mult = 1;
    if (dmg > 0) {
        bHp = Math.max(0, bHp - dmg);
        document.getElementById('boss-hp-fill').style.width = (bHp / 100 * 100) + '%';
        let bi = document.getElementById('boss-img');
        bi.classList.remove('shake'); void bi.offsetWidth; bi.classList.add('shake');
        diag.textContent = `* Нанесено ${dmg} урона!`;
    } else diag.textContent = "* ПРОМАХ!";

    // Концовка игры при победе
    if (bHp <= 0) {
        state = 'win';
        setTimeout(() => {
            document.getElementById('game-ui').style.display = 'none';
            document.getElementById('win-screen').style.display = 'block';
        }, 700);
        return;
    }
    setTimeout(enemyTurn, 800);
}

function doAct(a) {
    sub.style.display = 'none';
    if (a === 'chk') diag.textContent = `* ЦВЕТОК - HP ${bHp}/100. Сбивай полосы!`;
    if (a === 'foc') { mult = 1.5; diag.textContent = "* Урон следующей атаки x1.5!"; }
    if (a === 'tnt') { rage = 1.25; diag.textContent = "* Босс злится!"; }
    setTimeout(enemyTurn, 1000);
}

function useItem(i) {
    sub.style.display = 'none';
    let it = items[i]; // Предмет не удаляется из списка (бесконечный)
    hp = Math.min(20, hp + it.h); updHp();
    diag.textContent = `* Съедено: ${it.n}. Запас не иссяк!`;
    setTimeout(enemyTurn, 900);
}

function enemyTurn() {
    state = 'def'; let step = 0;
    let iv = setInterval(() => {
        step++;
        if (step % 4 === 0) {
            let b = document.createElement('img'); b.className = 'enemy-bar'; loadImg(b, 'bar', 'bar-fallback');
            let sx = Math.random() > 0.5 ? 0 : 150;
            b.style.width = '130px'; b.style.left = sx + 'px'; b.style.top = '0px';
            box.appendChild(b); haz.push({ el: b, x: sx, y: 0, w: 130, h: 18, vy: 2.0 * rage, brk: true });
        } else {
            let p = document.createElement('div'); p.className = 'enemy-proj';
            let sx = Math.random() * 265;
            p.style.left = sx + 'px'; p.style.top = '0px';
            box.appendChild(p); haz.push({ el: p, x: sx, y: 0, w: 12, h: 12, vy: 2.5 * rage, brk: false });
        }
        if (step >= 12) {
            clearInterval(iv);
            setTimeout(() => {
                if (state === 'win') return;
                state = 'menu'; diag.textContent = "* Ваш ход!";
                haz.forEach(h => h.el.remove()); haz = [];
                bul.forEach(b => b.el.remove()); bul = [];
            }, 1400);
        }
    }, Math.round(650 / rage));
}

function shoot() {
    if (state !== 'def' || bul.length > 3) return;
    let b = document.createElement('img'); b.className = 'bullet'; loadImg(b, 'bullet', 'bullet-fallback');
    b.style.left = (sX + 6) + 'px'; b.style.top = (sY - 18) + 'px';
    box.appendChild(b); bul.push({ el: b, x: sX + 6, y: sY - 18 });
}

function updHp() {
    document.getElementById('hp-fill').style.width = (hp / 20 * 100) + '%';
    document.getElementById('hp-text').textContent = `${hp}/20`;
    if (hp <= 0) { alert("GAME OVER!"); location.reload(); }
}

function bind(id, k) {
    let b = document.getElementById(id); if (!b) return;
    b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = true; });
    b.addEventListener('pointerup', e => { e.preventDefault(); keys[k] = false; });
    b.addEventListener('pointerleave', () => keys[k] = false);
}
bind('btn-up', 'ArrowUp'); bind('btn-down', 'ArrowDown');
bind('btn-left', 'ArrowLeft'); bind('btn-right', 'ArrowRight');

function loop() {
    if (state === 'def') {
        let sp = keys['ShiftLeft'] ? 2 : 3.5;
        if (keys['ArrowLeft'] && sX > 0) sX -= sp;
        if (keys['ArrowRight'] && sX < 248) sX += sp;
        if (keys['ArrowUp'] && sY > 0) sY -= sp;
        if (keys['ArrowDown'] && sY < 168) sY += sp;
        soul.style.left = sX + 'px'; soul.style.top = sY + 'px';

        for (let i = bul.length - 1; i >= 0; i--) {
            bul[i].y -= 7; bul[i].el.style.top = bul[i].y + 'px';
            if (bul[i].y < -25) { bul[i].el.remove(); bul.splice(i, 1); }
        }
        for (let i = haz.length - 1; i >= 0; i--) {
            let h = haz[i]; h.y += h.vy; h.el.style.top = h.y + 'px';
            if (h.brk) {
                for (let j = bul.length - 1; j >= 0; j--) {
                    let b = bul[j];
                    if (b.x < h.x + h.w && b.x + 12 > h.x && b.y < h.y + h.h && b.y + 24 > h.y) {
                        h.el.remove(); haz.splice(i, 1); b.el.remove(); bul.splice(j, 1); break;
                    }
                }
            }
            if (sX < h.x + h.w && sX + 20 > h.x && sY < h.y + h.h && sY + 20 > h.y) {
                hp = Math.max(0, hp - 2); updHp(); h.el.remove(); haz.splice(i, 1);
            } else if (h.y > 210) { h.el.remove(); haz.splice(i, 1); }
        }
    }
    requestAnimationFrame(loop);
}
loop();
