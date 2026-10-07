import fs from "node:fs";
import path from "node:path";

const [checkpointArg, outputArg] = process.argv.slice(2);
if (!checkpointArg || !outputArg) {
  throw new Error("Uso: node scripts/render-status-map.mjs <checkpoint.json> <reporte.html>");
}

const checkpoint = path.resolve(checkpointArg);
const output = path.resolve(outputArg);
const sourceDir = path.dirname(checkpoint);
const outputDir = path.dirname(output);
const data = JSON.parse(fs.readFileSync(checkpoint, "utf8"));

const states = new Set(["cerrado", "en_validacion", "integrado", "bloqueado", "pendiente", "diferido", "sin_datos"]);
for (const key of ["project", "as_of", "scope", "baseline", "source_paths", "decision_log", "next_checkpoint", "categories"]) {
  if (!(key in data)) throw new Error(`Falta campo raíz: ${key}`);
}
if (!Array.isArray(data.categories) || data.categories.length === 0) throw new Error("categories debe contener elementos");
const ids = new Set();
for (const category of data.categories) {
  for (const key of ["id", "name", "description", "state", "hitos", "implementation_pct", "validation_pct", "closure_criterion", "evidence", "next_action", "blocker", "owner", "verified_at", "dependencies"]) {
    if (!(key in category)) throw new Error(`${category.id ?? "?"}: falta ${key}`);
  }
  if (ids.has(category.id)) throw new Error(`ID duplicado: ${category.id}`);
  ids.add(category.id);
  if (!states.has(category.state)) throw new Error(`${category.id}: estado inválido`);
  if (!Array.isArray(category.hitos)) throw new Error(`${category.id}: hitos inválidos`);
  if (category.state === "cerrado" && (!category.hitos.length || category.hitos.some((hit) => !hit.hecho))) {
    throw new Error(`${category.id}: cerrado exige todos los hitos`);
  }
  if (category.state === "bloqueado" && !category.blocker) throw new Error(`${category.id}: bloqueado exige blocker`);
  for (const evidence of category.evidence) {
    const parsed = new URL(evidence.path, "file:///");
    if (!["file:", "http:", "https:"].includes(parsed.protocol)) throw new Error(`Ruta insegura: ${evidence.path}`);
    if (!/^https?:/.test(evidence.path)) {
      const target = path.resolve(sourceDir, evidence.path);
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error(`Evidencia inexistente: ${target}`);
      evidence.href = encodeURI(path.relative(outputDir, target).replaceAll(path.sep, "/"));
    } else {
      evidence.href = evidence.path;
    }
  }
}
for (const category of data.categories) {
  if (category.dependencies.some((dependency) => !ids.has(dependency) || dependency === category.id)) {
    throw new Error(`${category.id}: dependencia inválida`);
  }
}

const payload = JSON.stringify(data).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${data.project.replaceAll("&", "&amp;").replaceAll("<", "&lt;")} · status map</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#163044;background:#f3f7f9}
    *{box-sizing:border-box}body{margin:0}.wrap{max-width:1180px;margin:auto;padding:28px}
    .hero{background:linear-gradient(130deg,#12334a,#167b75);color:white;border-radius:20px;padding:30px}
    .eyebrow{font-size:12px;letter-spacing:.15em;color:#b9f0e5;font-weight:750}.hero h1{font-size:clamp(26px,4vw,42px);margin:8px 0}.hero p{max-width:850px;color:#e7f4f2}.meta{display:flex;gap:10px;flex-wrap:wrap}.meta span{font-size:12px;border-left:2px solid #75d4c7;padding-left:9px}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.metric,.panel{background:white;border:1px solid #dbe6eb;border-radius:14px}.metric{padding:16px}.metric strong{display:block;font-size:28px}.metric span{font-size:12px;color:#526b7b}
    .grid{display:grid;grid-template-columns:1.4fr 1fr;gap:14px}.panel{padding:18px;margin-bottom:14px}.panel h2{margin:0 0 14px;font-size:19px}
    .bar-row{display:grid;grid-template-columns:minmax(120px,1fr) 2fr 44px;gap:10px;align-items:center;margin:9px 0;font-size:13px}.track{height:12px;border-radius:8px;background:#e8eff2;overflow:hidden}.fill{height:100%;background:#238e86}.fill.low{background:#d2795d}.fill.mid{background:#d1a448}
    .charts{min-height:280px}.chart-wrap{height:260px}.fallback-note{font-size:12px;color:#5b7180}
    .alerts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.alert{border-left:4px solid #d2795d;background:#fff7f3;padding:12px;border-radius:8px}.alert strong{display:block}.alert span{font-size:12px;color:#6d554b}
    .flow{display:flex;align-items:center;gap:8px;overflow-x:auto;padding-bottom:4px}.node{min-width:190px;padding:14px;background:#eaf4f4;border:1px solid #9cc9c5;border-radius:12px}.arrow{font-size:24px;color:#7895a1}.node small{display:block;color:#516b79;margin-top:4px}
    .catalog-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}select{padding:8px;border:1px solid #9fb4bf;border-radius:8px;background:white}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:780px}th,td{padding:11px 8px;border-bottom:1px solid #e2eaee;text-align:left;vertical-align:top}th{font-size:12px;color:#526b7b}td button{border:0;background:none;color:#07677c;text-align:left;padding:0;font-weight:700;text-decoration:underline;cursor:pointer}.badge{display:inline-block;padding:3px 8px;border-radius:99px;background:#e7f0f3;font-size:12px}.badge.pendiente,.badge.bloqueado{background:#fae6df;color:#89381f}.badge.cerrado{background:#d9f2e8;color:#11664a}.detail{border-left:3px solid #238e86;padding-left:15px;margin-top:18px}.detail h3{margin:4px 0}.detail ul{padding-left:20px}.detail p{margin:7px 0}a{color:#07677c}
    footer{font-size:13px}.muted{color:#5b7180}@media(max-width:760px){.wrap{padding:12px}.summary{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.alerts{grid-template-columns:1fr}.hero{padding:22px}.bar-row{grid-template-columns:100px 1fr 40px}.flow{align-items:stretch}.arrow{align-self:center}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}@media print{body{background:white}.panel{break-inside:avoid}.wrap{padding:0}}
  </style>
</head>
<body>
<main class="wrap">
  <header class="hero"><div class="eyebrow">CHECKPOINT · ${data.as_of}</div><h1>${data.project}</h1><p>${data.scope}</p><div class="meta"><span>${data.baseline}</span><span>Próximo corte: ${data.next_checkpoint}</span></div></header>
  <section class="summary" aria-label="Resumen"><div class="metric"><strong id="total"></strong><span>Categorías en alcance</span></div><div class="metric"><strong id="closed"></strong><span>Cerradas</span></div><div class="metric"><strong id="pending"></strong><span>Pendientes/bloqueadas</span></div><div class="metric"><strong id="deferred"></strong><span>Diferidas</span></div></section>
  <section class="grid"><div class="panel"><h2>Cierre por categoría</h2><div id="bars"></div></div><div class="panel charts"><h2>Distribución de estados</h2><div class="chart-wrap"><canvas id="state-chart" aria-label="Distribución de estados" role="img"></canvas></div><p class="fallback-note">La tabla y las barras permanecen disponibles si Chart.js no carga.</p></div></section>
  <section class="panel"><h2>Alertas prioritarias</h2><div class="alerts" id="alerts"></div></section>
  <section class="panel"><h2>Ruta de cierre</h2><div class="flow" id="flow"></div></section>
  <section class="panel"><div class="catalog-head"><h2>Catálogo operativo</h2><label>Filtrar estado <select id="filter"><option value="all">Todos</option></select></label></div><div class="table-wrap"><table><thead><tr><th>Categoría</th><th>Cierre</th><th>Estado</th><th>Implementado</th><th>Validado</th><th>Siguiente acción</th></tr></thead><tbody id="rows"></tbody></table></div><div class="detail" id="detail"><p>Selecciona una categoría para ver criterio, hitos y evidencia.</p></div></section>
  <footer class="panel"><h2>Decisiones vigentes</h2><ul id="decisions"></ul><p><strong>Siguiente checkpoint:</strong> ${data.next_checkpoint}</p></footer>
</main>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js"></script>
<script>const DATA=${payload};
const labels={cerrado:'Cerrado',en_validacion:'En validación',integrado:'Integrado',bloqueado:'Bloqueado',pendiente:'Pendiente',diferido:'Diferido',sin_datos:'Sin datos'};
const rate=c=>c.hitos.length?Math.round(c.hitos.filter(h=>h.hecho).length*100/c.hitos.length):null;const active=DATA.categories.filter(c=>c.state!=='diferido');const byId=id=>document.getElementById(id);
byId('total').textContent=active.length;byId('closed').textContent=active.filter(c=>c.state==='cerrado').length;byId('pending').textContent=active.filter(c=>['pendiente','bloqueado'].includes(c.state)).length;byId('deferred').textContent=DATA.categories.length-active.length;
for(const c of active){const value=rate(c)??0;const row=document.createElement('div');row.className='bar-row';row.innerHTML='<span></span><div class="track"><div class="fill '+(value<35?'low':value<70?'mid':'')+'" style="width:'+value+'%"></div></div><strong>'+value+'%</strong>';row.firstElementChild.textContent=c.name;byId('bars').append(row)}
const priorities=active.filter(c=>rate(c)<40).sort((a,b)=>rate(a)-rate(b)).slice(0,3);for(const c of priorities){const item=document.createElement('div');item.className='alert';const strong=document.createElement('strong');strong.textContent=c.name+' · '+rate(c)+'%';const span=document.createElement('span');span.textContent=c.next_action;item.append(strong,span);byId('alerts').append(item)}
for(const [title,sub] of [['Base verificada',active.filter(c=>rate(c)>=50).length+' categorías ≥50%'],['Bloqueantes',active.filter(c=>rate(c)<25).length+' categorías <25%'],['Validación',active.filter(c=>c.state==='en_validacion').length+' en validación'],['Gate',DATA.next_checkpoint]]){const n=document.createElement('div');n.className='node';const b=document.createElement('strong');b.textContent=title;const s=document.createElement('small');s.textContent=sub;n.append(b,s);if(byId('flow').children.length){const a=document.createElement('span');a.className='arrow';a.textContent='→';byId('flow').append(a)}byId('flow').append(n)}
const stateList=[...new Set(DATA.categories.map(c=>c.state))];for(const state of stateList){const o=document.createElement('option');o.value=state;o.textContent=labels[state];byId('filter').append(o)}
function show(c){const d=byId('detail');d.replaceChildren();const h=document.createElement('h3');h.textContent=c.name+' · '+rate(c)+'% de cierre';d.append(h);for(const [k,v] of [['Criterio',c.closure_criterion],['Próxima acción',c.next_action],['Bloqueo',c.blocker||'Ninguno documentado'],['Responsable',c.owner],['Verificado',c.verified_at],['Dependencias',c.dependencies.join(', ')||'Ninguna']]){const p=document.createElement('p');const b=document.createElement('strong');b.textContent=k+': ';p.append(b,document.createTextNode(v));d.append(p)}const ul=document.createElement('ul');for(const hit of c.hitos){const li=document.createElement('li');li.textContent=(hit.hecho?'✓ ':'○ ')+hit.name;ul.append(li)}d.append(ul);const ev=document.createElement('ul');for(const item of c.evidence){const li=document.createElement('li');const a=document.createElement('a');a.href=item.href;a.textContent=item.label;li.append(a);ev.append(li)}d.append(ev)}
function render(){const body=byId('rows');body.replaceChildren();for(const c of DATA.categories.filter(c=>byId('filter').value==='all'||c.state===byId('filter').value)){const tr=document.createElement('tr');const name=document.createElement('td');const button=document.createElement('button');button.type='button';button.textContent=c.name;button.onclick=()=>show(c);const small=document.createElement('small');small.className='muted';small.textContent=c.description;name.append(button,document.createElement('br'),small);const closure=document.createElement('td');closure.textContent=rate(c)+'% ('+c.hitos.filter(h=>h.hecho).length+'/'+c.hitos.length+')';const state=document.createElement('td');state.innerHTML='<span class="badge '+c.state+'">'+labels[c.state]+'</span>';for(const cell of [name,closure,state,c.implementation_pct===null?'—':c.implementation_pct+'%',c.validation_pct===null?'—':c.validation_pct+'%',c.next_action]){if(cell instanceof Node)tr.append(cell);else{const td=document.createElement('td');td.textContent=cell;tr.append(td)}}body.append(tr)}}byId('filter').onchange=render;render();
for(const decision of DATA.decision_log){const li=document.createElement('li');li.textContent=decision;byId('decisions').append(li)}
if(window.Chart){new Chart(byId('state-chart'),{type:'doughnut',data:{labels:stateList.map(s=>labels[s]),datasets:[{data:stateList.map(s=>DATA.categories.filter(c=>c.state===s).length),backgroundColor:['#248d7d','#3b84a0','#768b98','#d0785f','#bd6d54','#aeb8bf','#bac7cc']}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}}}})}else{byId('state-chart').style.display='none'}
</script>
</body></html>`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(output, html, "utf8");
console.log(`Status map generado: ${path.relative(process.cwd(), output)} (${data.categories.length} categorías)`);

