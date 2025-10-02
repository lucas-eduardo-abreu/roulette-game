/********** Constantes & Persistência **********/
const TAU = Math.PI * 2;
const POINTER_OFFSET = -Math.PI / 2;
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const norm = x => ((x % TAU) + TAU) % TAU;

// mínimo de voltas completas antes de parar
const MIN_TURNS = 10;  // no mínimo 10 voltas
const MAX_TURNS = 13;  // e no máximo 13 (aleatoriza um pouco)

const LS_SEGMENTS = "roleta_segments_v3";
const LS_SEGMENTS_BASE = "roleta_segments_base_v3";
const LS_SETTINGS = "roleta_settings_v3";
const LS_LOG = "roleta_winners_v3";
const LS_ONBOARDED = "roleta_onboarded_v1";

/********** Estado **********/
let segments = [];
let baseSegments = [];
let winnersLog = [];
let images = new Map();

let currentAngle = 0;       // IMPORTANTE: mantemos este valor acumulado (não normalizado)
let spinning = false;
let highlightIndex = null;
let lastTickIndex = null;

/********** Elementos comuns **********/
const app = document.getElementById("app");
const screenSetup = document.getElementById("screen-setup");
const screenPlay  = document.getElementById("screen-play");

/* Tela Setup */
const form = document.getElementById("formPrize");
const inputIndex = document.getElementById("prizeIndex");
const inputLabel = document.getElementById("label");
const inputColor = document.getElementById("color");
const inputWeight = document.getElementById("weight");
const inputImg = document.getElementById("imgSrc");
const inputStock = document.getElementById("stock");
const btnAdd = document.getElementById("btnAdd");
const btnUpd = document.getElementById("btnUpdate");
const btnClear = document.getElementById("btnClear");
const btnResetEstoque = document.getElementById("btnResetEstoque");
const btnResetTudo = document.getElementById("btnResetTudo");
const chkSkipDepleted = document.getElementById("chkSkipDepleted");
const chkRemoveOnZero = document.getElementById("chkRemoveOnZero");
const tblBody = document.querySelector("#tblEstoque tbody");
const btnStart = document.getElementById("btnStart");

/* Tela Play */
const canvas = document.getElementById("roleta");
const ctx = canvas.getContext("2d");
const center = { x: canvas.width / 2, y: canvas.height / 2 };
const radius = canvas.width / 2;
const confettiCanvas = document.getElementById("confetti");
const cctx = confettiCanvas.getContext("2d");
const btnGirar = document.getElementById("girar");
const btnFullscreen = document.getElementById("btnFullscreen");
const resultadoBox = document.getElementById("resultado");
const resultadoImg = document.getElementById("resultado-img");
const resultadoLabel = document.getElementById("resultado-label");
const resultadoMsg = document.getElementById("resultado-msg");
const resultadoStock = document.getElementById("resultado-stock");
const historicoUl = document.getElementById("historico");

const sfxTick = document.getElementById("sfxTick");
const sfxWin  = document.getElementById("sfxWin");

/********** Defaults **********/
const DEFAULT_SEGMENTS = [
  { label: "Camiseta", color: "#f59e0b", imgSrc: "assets/camisa.png",  weight: 1, stock: 5 },
  { label: "Caneca",   color: "#3b82f6", imgSrc: "assets/caneca.png",  weight: 1, stock: 5 },
  { label: "Chaveiro", color: "#22c55e", imgSrc: "assets/chaveiro.png",weight: 1, stock: 8 },
  { label: "Adesivo",  color: "#ef4444", imgSrc: "assets/adesivo.png", weight: 1, stock: 12 },
  { label: "Copo",     color: "#a855f7", imgSrc: "assets/copo.png",    weight: 1, stock: 6 },
  { label: "Mistério", color: "#f43f5e", imgSrc: "assets/mystery.png", weight: 1, stock: 2 },
];

/********** Helpers **********/
function saveAll() {
  localStorage.setItem(LS_SEGMENTS, JSON.stringify(segments));
  localStorage.setItem(LS_SEGMENTS_BASE, JSON.stringify(baseSegments));
  localStorage.setItem(LS_SETTINGS, JSON.stringify({
    skipDepleted: chkSkipDepleted.checked,
    removeOnZero: chkRemoveOnZero.checked,
  }));
  localStorage.setItem(LS_LOG, JSON.stringify(winnersLog));
}
function loadAll() {
  try {
    const seg = JSON.parse(localStorage.getItem(LS_SEGMENTS) || "null");
    const base = JSON.parse(localStorage.getItem(LS_SEGMENTS_BASE) || "null");
    const set = JSON.parse(localStorage.getItem(LS_SETTINGS) || "null");
    const log = JSON.parse(localStorage.getItem(LS_LOG) || "null");
    if (Array.isArray(seg)) segments = seg;
    if (Array.isArray(base)) baseSegments = base;
    if (set && typeof set === "object") {
      chkSkipDepleted.checked = !!set.skipDepleted;
      chkRemoveOnZero.checked = !!set.removeOnZero;
    }
    if (Array.isArray(log)) winnersLog = log;
  } catch {}
}
function playTick(){ try{sfxTick.currentTime=0;sfxTick.play();}catch{} }
function playWin(){ try{sfxWin.currentTime=0;sfxWin.play();}catch{} }

function weightedRandomIndexWithStock(items, skipDepleted=true) {
  const pool = items.map((s,i)=>({...s,i}))
                    .filter(s => skipDepleted ? (s.stock ?? 0) > 0 : true);
  if (pool.length === 0) return -1;
  const total = pool.reduce((acc,s)=> acc + (s.weight || 1), 0);
  let r = Math.random() * total;
  for (const s of pool) { r -= (s.weight || 1); if (r <= 0) return s.i; }
  return pool[pool.length-1].i;
}

/********** Imagens **********/
function loadImages() {
  const unique = [...new Set(segments.map(s => s.imgSrc).filter(Boolean))];
  const promises = unique.map(src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => { images.set(src, img); resolve(); };
    img.onerror = () => { images.set(src, null); resolve(); };
    img.src = src;
  }));
  return Promise.all(promises);
}

/********** Desenho da Roleta **********/
function drawWheel(angle=0, highlightIdx=null) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const n = segments.length; if (!n) return;
  const slice = TAU / n;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);

  for (let i=0;i<n;i++){
    const s = segments[i];
    const start = i*slice, end = start + slice;

    // base
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.arc(0,0,radius-6,start,end); ctx.closePath();
    ctx.fillStyle = s.color; ctx.fill();

    // imagem
    const img = images.get(s.imgSrc);
    if (img){
      ctx.save();
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.arc(0,0,radius-18,start,end); ctx.closePath(); ctx.clip();
      const mid = start + slice/2;
      ctx.rotate(mid);
      const targetW = radius-90, targetH = targetW;
      ctx.drawImage(img, -targetW/2, -(radius - targetH - 36), targetW, targetH);
      ctx.rotate(-mid);
      ctx.restore();
    }

    // separador
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.lineWidth=2; ctx.strokeStyle="rgba(15,18,34,.8)";
    ctx.arc(0,0,radius-6,start,end); ctx.stroke();

    // texto + estoque
    ctx.save();
    ctx.rotate(start + slice/2);
    ctx.textAlign="right"; ctx.fillStyle="#0b0e1e";
    ctx.font="bold 15px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const stockTxt = (s.stock ?? 0) <= 0 ? " (0)" : ` (${s.stock})`;
    ctx.fillText(`${s.label}${stockTxt}`, radius-24, 8);
    ctx.restore();
  }

  // destaque
  if (highlightIdx !== null){
    const start = highlightIdx*slice, end = start+slice;
    ctx.save(); ctx.globalAlpha=.22; ctx.fillStyle="#ffffff";
    ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,radius-10,start,end);
    ctx.closePath(); ctx.fill(); ctx.restore();

    ctx.save(); ctx.lineWidth=6; ctx.strokeStyle="#ffd166";
    ctx.beginPath(); ctx.arc(0,0,radius-6,start,end); ctx.stroke(); ctx.restore();
  }

  // hub
  ctx.beginPath(); ctx.arc(0,0,58,0,TAU);
  ctx.fillStyle="#111427"; ctx.fill();
  ctx.lineWidth=4; ctx.strokeStyle="#2a2f57"; ctx.stroke();

  // glow
  const grad = ctx.createRadialGradient(0,0,0,0,0,58);
  grad.addColorStop(0,"rgba(255,255,255,.18)");
  grad.addColorStop(0.7,"rgba(255,255,255,.04)");
  grad.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(0,0,58,0,TAU); ctx.fill();

  ctx.restore();
}
function indexAtPointer(angle){
  const n = segments.length; if (!n) return -1;
  const slice = TAU / n;
  const rel = norm(POINTER_OFFSET - angle);
  return Math.floor(rel / slice) % n;
}

/********** Confetes **********/
let confettiParticles=[], confettiRunning=false;
function spawnConfetti(count=180){
  confettiParticles=[];
  for(let i=0;i<count;i++){
    confettiParticles.push({
      x: confettiCanvas.width/2 + (Math.random()*60-30),
      y: 40 + Math.random()*30,
      vx:(Math.random()-0.5)*6, vy: Math.random()*3+2,
      size: Math.random()*4+3, rot: Math.random()*TAU, vr:(Math.random()-0.5)*0.3,
      life: 120+Math.random()*60,
      color:`hsl(${Math.floor(Math.random()*360)},90%,60%)`,
    });
  }
}
function drawConfetti(){
  cctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
  confettiParticles.forEach(p=>{
    cctx.save(); cctx.translate(p.x,p.y); cctx.rotate(p.rot);
    cctx.fillStyle=p.color; cctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);
    cctx.restore();
  });
}
function updateConfetti(){
  confettiParticles.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; p.vy+=0.08; p.rot+=p.vr; p.life-=1; });
  confettiParticles = confettiParticles.filter(p=> p.life>0 && p.y<confettiCanvas.height+20);
}
function confettiLoop(){ if(!confettiRunning) return; updateConfetti(); drawConfetti(); requestAnimationFrame(confettiLoop); }

/********** Giro (garante 10+ voltas reais) **********/
function spinToIndex(targetIndex){
  if (spinning || segments.length===0 || targetIndex<0) return;
  spinning = true; 
  btnGirar.disabled = true; 
  resultadoBox.hidden = true;
  highlightIndex = null; 
  lastTickIndex = null;

  const n = segments.length;
  const slice = TAU / n;

  // centro da fatia que vai parar no ponteiro (topo)
  const targetMid = targetIndex * slice + slice / 2;

  // Ângulo atual ABSOLUTO (não normalizado!)
  const a0 = currentAngle;

  // Escolhe um nº de voltas inteiro entre MIN_TURNS e MAX_TURNS
  const chosenTurns = MIN_TURNS + Math.floor(Math.random() * (MAX_TURNS - MIN_TURNS + 1));

  // Precisamos de um ângulo final que satisfaça:
  // finalAngle ≡ POINTER_OFFSET - targetMid (mod TAU)
  // e também finalAngle >= a0 + chosenTurns*TAU   (para garantir as voltas)
  const base = POINTER_OFFSET - targetMid; // representante da classe módulo TAU
  const k = Math.floor((a0 - base) / TAU) + chosenTurns; // mínimo k que empurra além de a0 + chosenTurns*TAU
  const finalAngle = base + k * TAU;

  // delta total (positivo) a percorrer
  const delta = finalAngle - a0;

  // duração proporcional às voltas escolhidas
  const baseMs = 3500;
  const perTurnMs = 450;
  const jitter = Math.floor(Math.random() * 400);
  const duration = baseMs + perTurnMs * chosenTurns + jitter;

  const start = performance.now();

  function frame(now){
    const t = Math.min(1, (now - start) / duration);
    const eased = easeOutCubic(t);
    const angle = a0 + delta * eased;

    // tick por fatia atravessada
    const idx = indexAtPointer(angle);
    if (lastTickIndex === null) lastTickIndex = idx;
    if (idx !== lastTickIndex) { playTick(); lastTickIndex = idx; }

    currentAngle = angle;
    drawWheel(currentAngle, null);

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      // SNAP: meio da fatia exatamente no ponteiro (topo)
      currentAngle = finalAngle; // já é POINTER_OFFSET - targetMid + k*TAU
      drawWheel(currentAngle, targetIndex);

      spinning = false;
      btnGirar.disabled = false;
      announceResult(targetIndex);
    }
  }

  requestAnimationFrame(frame);
}

function announceResult(index){
  const seg = segments[index];
  if (typeof seg.stock === "number" && seg.stock > 0) seg.stock -= 1;

  playWin(); spawnConfetti(200);
  if(!confettiRunning){ confettiRunning=true; confettiLoop(); }
  setTimeout(()=>{ confettiRunning=false; }, 2500);

  resultadoImg.src = seg.imgSrc || "";
  resultadoImg.alt = seg.label || "Prêmio";
  resultadoLabel.textContent = `🎉 Prêmio: ${seg.label}`;
  resultadoMsg.textContent = "Parabéns! Retire seu prêmio no balcão.";
  resultadoStock.textContent = `Estoque restante: ${seg.stock ?? 0}`;
  resultadoBox.hidden=false;

  const nowIso = new Date().toISOString();
  winnersLog.push({ ts: nowIso, label: seg.label });
  if (winnersLog.length > 2500) winnersLog.shift();
  renderHistorico();

  if ((seg.stock ?? 0) <= 0 && chkRemoveOnZero.checked) {
    segments.splice(index,1);
  }

  saveAll();
  drawWheel(currentAngle);
}

/********** CSV & Fullscreen **********/
function exportCSV(){
  const header = "timestamp,label\n";
  const rows = winnersLog.map(w => `${w.ts},${JSON.stringify(w.label)}`).join("\n");
  const blob = new Blob([header + rows + "\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `roleta_vencedores_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}
function goFullscreen(){
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  else app.requestFullscreen?.();
}

/********** Setup UI **********/
function clearForm(){
  inputIndex.value = "";
  inputLabel.value = "";
  inputColor.value = "#f59e0b";
  inputWeight.value = "1";
  inputImg.value = "";
  inputStock.value = "1";
  btnUpd.disabled = true; btnAdd.disabled = false;
}
function renderEstoque(){
  tblBody.innerHTML = "";
  segments.forEach((s,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${s.label}</td>
      <td>${s.stock ?? 0}</td>
      <td>${s.weight ?? 1}</td>
      <td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;background:${s.color};border:1px solid #0003;vertical-align:middle;margin-right:6px;"></span>${s.color}</td>
      <td>${s.imgSrc ? `<img src="${s.imgSrc}" alt="" />` : "-"}</td>
      <td>
        <div class="actions">
          <span class="linkish" data-edit="${i}">✎</span>
          <span class="linkish danger" data-del="${i}">🗑</span>
        </div>
      </td>
    `;
    tblBody.appendChild(tr);
  });
  tblBody.querySelectorAll("[data-edit]").forEach(el=>{
    el.onclick = () => {
      const i = Number(el.getAttribute("data-edit"));
      const s = segments[i];
      inputIndex.value = String(i);
      inputLabel.value = s.label || "";
      inputColor.value = s.color || "#ffffff";
      inputWeight.value = s.weight ?? 1;
      inputImg.value = s.imgSrc || "";
      inputStock.value = s.stock ?? 0;
      btnUpd.disabled = false; btnAdd.disabled = true;
    };
  });
  tblBody.querySelectorAll("[data-del]").forEach(el=>{
    el.onclick = () => {
      const i = Number(el.getAttribute("data-del"));
      segments.splice(i,1);
      baseSegments.splice(i,1);
      saveAll(); renderEstoque();
    };
  });
}
function renderHistorico(){
  const last10 = winnersLog.slice(-10).reverse();
  historicoUl.innerHTML = last10.map(w=>{
    const d=new Date(w.ts);
    const hh=String(d.getHours()).padStart(2,"0");
    const mm=String(d.getMinutes()).padStart(2,"0");
    return `<li><strong>${w.label}</strong> <em style="opacity:.8">— ${hh}:${mm}</em></li>`;
  }).join("");
}

/********** Navegação entre telas **********/
function showSetup(){ screenSetup.classList.remove("hidden"); screenPlay.classList.add("hidden"); }
function showPlay(){
  screenPlay.classList.remove("hidden"); screenSetup.classList.add("hidden");
  confettiCanvas.width = canvas.width; confettiCanvas.height = canvas.height;
  loadImages().then(()=> drawWheel(currentAngle));
}

/********** Eventos — Setup **********/
form.addEventListener("submit", (e)=>{
  e.preventDefault();
  const s = {
    label: inputLabel.value.trim(),
    color: inputColor.value || "#cccccc",
    imgSrc: inputImg.value.trim(),
    weight: Math.max(0, parseFloat(inputWeight.value || "1")) || 1,
    stock: Math.max(0, parseInt(inputStock.value || "0", 10)) || 0,
  };
  segments.push(s);
  baseSegments.push({...s});
  saveAll(); clearForm(); renderEstoque();
});
btnUpd.addEventListener("click", ()=>{
  const i = inputIndex.value ? parseInt(inputIndex.value,10) : -1;
  if (i < 0 || i >= segments.length) return;
  const s = segments[i];
  s.label = inputLabel.value.trim();
  s.color = inputColor.value || "#cccccc";
  s.imgSrc = inputImg.value.trim();
  s.weight = Math.max(0, parseFloat(inputWeight.value || "1")) || 1;
  s.stock = Math.max(0, parseInt(inputStock.value || "0", 10)) || 0;
  baseSegments[i] = {...s};
  saveAll(); clearForm(); renderEstoque();
});
btnClear.addEventListener("click", clearForm);

btnResetEstoque.addEventListener("click", ()=>{
  if (!baseSegments.length) return;
  segments = baseSegments.map(s=>({...s}));
  saveAll(); renderEstoque();
});
btnResetTudo.addEventListener("click", ()=>{
  if (!confirm("Limpar tudo (pool, base, histórico)?")) return;
  segments=[]; baseSegments=[]; winnersLog=[];
  saveAll(); renderEstoque(); historicoUl.innerHTML="";
});

btnStart.addEventListener("click", ()=>{
  const hasAvailable = segments.some(s => (s.stock ?? 0) > 0);
  if (!segments.length || !hasAvailable) {
    alert("Cadastre ao menos um prêmio com estoque > 0 para começar.");
    return;
  }
  localStorage.setItem(LS_ONBOARDED, "1");
  showPlay();
});

/********** Eventos — Play **********/
btnGirar.addEventListener("click", ()=>{
  if (spinning || segments.length===0) return;
  const idx = weightedRandomIndexWithStock(segments, chkSkipDepleted.checked);
  if (idx < 0) { alert("Sem prêmios disponíveis."); return; }
  spinToIndex(idx);
});
btnFullscreen.addEventListener("click", ()=>{
  if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
  else app.requestFullscreen?.();
});
document.addEventListener("keydown", (ev)=>{
  // F2 alterna telas
  if (ev.key === "F2") {
    if (screenPlay.classList.contains("hidden")) showPlay(); else showSetup();
  }
  // E exporta CSV (na tela de jogo)
  if (ev.key.toLowerCase() === "e" && !screenPlay.classList.contains("hidden")) exportCSV();
});

/********** Inicialização **********/
function boot(){
  // carregar estado
  try {
    const seg = JSON.parse(localStorage.getItem(LS_SEGMENTS) || "null");
    const base = JSON.parse(localStorage.getItem(LS_SEGMENTS_BASE) || "null");
    const set = JSON.parse(localStorage.getItem(LS_SETTINGS) || "null");
    const log = JSON.parse(localStorage.getItem(LS_LOG) || "null");
    if (Array.isArray(seg)) segments = seg;
    if (Array.isArray(base)) baseSegments = base;
    if (set && typeof set === "object") {
      chkSkipDepleted.checked = !!set.skipDepleted;
      chkRemoveOnZero.checked = !!set.removeOnZero;
    }
    if (Array.isArray(log)) winnersLog = log;
  } catch {}

  // defaults na primeira vez
  if (!segments.length){
    segments    = DEFAULT_SEGMENTS.map(s=>({...s}));
    baseSegments= DEFAULT_SEGMENTS.map(s=>({...s}));
  }

  renderEstoque();
  renderHistorico();

  const onboarded = localStorage.getItem(LS_ONBOARDED) === "1";
  if (onboarded) showPlay(); else showSetup();
}
boot();
