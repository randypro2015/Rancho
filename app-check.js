
// --- REGISTRO DEL SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((registration) => {
        console.log('Service Worker registrado:', registration);
      })
      .catch((error) => {
        console.log('Error al registrar Service Worker:', error);
      });
  });
}

// --- DETECTAR CONEXIÓN ---
window.addEventListener('online', () => {
  document.getElementById('offline-banner').classList.remove('show');
  console.log('Conexión restaurada');
});

window.addEventListener('offline', () => {
  document.getElementById('offline-banner').classList.add('show');
  console.log('Sin conexión');
});

// Verificar estado inicial
if (!navigator.onLine) {
  document.getElementById('offline-banner').classList.add('show');
}

// --- ESTADO INICIAL DE LA APP ---
let appData = {
    config: { fecha: '', sopa: '', s1: '', s2: '', s3: '', s4: '', s5: '', seconds: [], extra: null, precio: 15, soloUno: false },
    clientes: [],
    // Lista inicial de zonas
    zonas: ["PIL", "Puente", "Choclos", "Sandía", "Frutas", "Bananas", "Camiones", "Coca", "Abarrotes"],
    inicioDespacho: false 
};

// --- NAVEGACIÓN Y PERSISTENCIA ---
function nav(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');

    if (screenId === 'scr-pedidos') renderClientes();
    if (screenId === 'scr-resumen-tabla') renderTabla();
    if (screenId === 'scr-entrega') renderEntrega();
    if (screenId === 'scr-tapers') renderTapers();
    window.scrollTo(0, 0);
}

function guardarAuto() {
    localStorage.setItem('rancho_vFinal_Zonas', JSON.stringify(appData));
}

// --- GESTIÓN DE ZONAS DINÁMICAS ---
function manejarCambioZona(index, valorSeleccionado) {
    if (valorSeleccionado === "NUEVA_ZONA") {
        const nombreNuevaZona = prompt("Escriba el nombre de la nueva zona:");
        if (nombreNuevaZona && nombreNuevaZona.trim() !== "") {
            const zonaLimpia = nombreNuevaZona.trim();
            // Evitar duplicados
            if (!appData.zonas.includes(zonaLimpia)) {
                appData.zonas.push(zonaLimpia);
                appData.zonas.sort(); // Ordenar alfabéticamente
            }
            appData.clientes[index].seccion = zonaLimpia;
        } else {
            appData.clientes[index].seccion = ""; // Reset si cancela
        }
        guardarAuto();
        renderClientes(); // Recargar para que la nueva zona aparezca en todos los selects
    } else {
        actualizarDato(index, 'seccion', valorSeleccionado);
    }
}

// --- CONFIGURACIÓN DEL DÍA ---
function renderConfigSegundos() {
    const count = Number(document.getElementById('conf-cantidad-segundos')?.value || 2);
    const wrap = document.getElementById('config-segundos');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (let i = 1; i <= count; i++) {
        const old = appData.config.seconds?.[i-1] || { name: appData.config['s'+i] || '', price: appData.config.precio || 15 };
        wrap.innerHTML += `<div class="flex"><div><label>Segundo ${i}</label><input id="conf-s${i}" value="${old.name}" placeholder="Nombre del segundo"></div><div><label>Precio completo (Bs)</label><input id="conf-p${i}" type="number" value="${old.price || 15}"></div></div>`;
    }
}

function manejarTipoAlmuerzo() {}

function iniciarPedidos() {
    const count = Number(document.getElementById('conf-cantidad-segundos').value || 2);
    const seconds = [];
    for (let i = 1; i <= count; i++) seconds.push({ name: document.getElementById('conf-s'+i).value || `Segundo ${i}`, price: Number(document.getElementById('conf-p'+i).value) || 15 });
    const extraNombre = document.getElementById('conf-extra-nombre').value.trim();
    const extraPrecio = Number(document.getElementById('conf-extra-precio').value);
    appData.config = {
        fecha: document.getElementById('conf-fecha').value,
        sopa: document.getElementById('conf-sopa').value,
        seconds,
        s1: seconds[0]?.name || '', s2: seconds[1]?.name || '', s3: seconds[2]?.name || '', s4: seconds[3]?.name || '', s5: seconds[4]?.name || '',
        extra: extraNombre ? { name: extraNombre, price: extraPrecio || 0 } : null,
        precio: seconds[0]?.price || 15,
        soloUno: count === 1
    };

    if (appData.clientes.length === 0) agregarCliente();
    guardarAuto();
    nav('scr-pedidos');
}

// --- REGISTRO DE CLIENTES ---
function agregarCliente() {
    const nuevo = {
        id: "id-" + Date.now(), nombre: '', seccion: '', cant1: 0, cant2: 0,
        orders: { complete: [{item:'s1', qty:0}, {item:'s2', qty:0}], loose: [{item:'s1', qty:0}, {item:'s2', qty:0}] },
        entregado: false, taperEstado: 0, pago: 0, notaTaper: '',
        esReciente: appData.inicioDespacho 
    };
    appData.clientes.unshift(nuevo);
    renderClientes();
    guardarAuto();
}

function ensureClientOrders(c) {
    if (!c.orders) c.orders = { complete: [], loose: [] };
    ['complete','loose'].forEach(k => { if (!Array.isArray(c.orders[k])) c.orders[k] = []; });
    if (!Array.isArray(c.orderRows)) {
        c.orderRows = [];
        c.orders.complete.forEach(o => { if (Number(o.qty) > 0) c.orderRows.push({ kind:'complete', quantities:{ [o.item]: Number(o.qty) } }); });
        c.orders.loose.forEach(o => { if (Number(o.qty) > 0) c.orderRows.push({ kind:'loose', quantities:{ [o.item]: Number(o.qty) } }); });
        if (c.orderRows.length === 0) c.orderRows = [{ kind:'', quantities:{} }];
    }
    return c.orderRows;
}
function menuOptions(selected, includeExtra=true) {
    const seconds = appData.config.seconds?.length ? appData.config.seconds : [1,2].map((_,i)=>({name:appData.config['s'+(i+1)] || `Segundo ${i+1}`, price:appData.config.precio||15}));
    let html = seconds.map((x,i)=>`<option value="s${i+1}" ${selected === 's'+(i+1) ? 'selected':''}>${i+1}. ${x.name}</option>`).join('');
    if (includeExtra && appData.config.extra) html += `<option value="extra" ${selected === 'extra' ? 'selected':''}>Extra: ${appData.config.extra.name}</option>`;
    return html;
}
function qtyOptions(value) { return `<option value="0">0</option>` + Array.from({length:10},(_,i)=>`<option value="${i+1}" ${Number(value)===i+1?'selected':''}>${i+1}</option>`).join(''); }
function rowKindLabel(kind) { return kind === 'complete' ? '🍛 Almuerzo completo · incluye sopa' : (kind === 'loose' ? '🥡 Segundo suelto · sin sopa' : 'Seleccione el pedido'); }
function renderPedidoRow(c, row, rowIndex) {
    const kind = row.kind || '';
    const options = kind === 'complete' || kind === 'loose'
        ? `<div class="pedido-options">${(appData.config.seconds || []).map((sec,i)=>`<label>${i+1}. ${sec.name}<select onchange="setRowQty('${c.id}',${rowIndex},'s${i+1}',this.value)">${qtyOptions(row.quantities?.['s'+(i+1)] || 0)}</select></label>`).join('')}</div>`
        : (kind === 'extra' ? `<label>🍽️ ${appData.config.extra?.name || 'Extra'}<select onchange="setRowQty('${c.id}',${rowIndex},'extra',this.value)">${qtyOptions(row.quantities?.extra || 0)}</select></label>` : '<div style="font-size:12px;color:#777;margin-top:5px;">Primero elige el tipo de pedido.</div>');
    return `<div class="pedido-row ${kind}"><div class="flex" style="align-items:center;"><select onchange="setRowKind('${c.id}',${rowIndex},this.value)"><option value="" ${!kind?'selected':''}>Seleccione el pedido</option><option value="complete" ${kind==='complete'?'selected':''}>Almuerzo completo</option><option value="loose" ${kind==='loose'?'selected':''}>Segundo suelto</option><option value="extra" ${kind==='extra'?'selected':''}>Extra</option></select><button class="btn-del" style="position:static;flex:0 0 28px;" onclick="removeOrderRow('${c.id}',${rowIndex})">×</button></div><div>${rowKindLabel(kind)}</div>${options}</div>`;
}
function renderClientes() {
    const contenedor = document.getElementById('lista-clientes');
    if (!contenedor) return;
    contenedor.innerHTML = `<div class="menu-summary"><b>🍲 Sopa: ${appData.config.sopa || 'Sin sopa configurada'}</b><div style="font-size:12px; margin-top:4px;">Selecciona el tipo de pedido. Luego elige las cantidades de cada segundo.</div></div>`;
    appData.clientes.forEach((c, index) => {
        const rows = ensureClientOrders(c);
        let opcionesZonas = appData.zonas.map(z => `<option value="${z}" ${c.seccion === z ? 'selected' : ''}>${z}</option>`).join('');
        contenedor.innerHTML += `<div class="card" id="${c.id}">
            <button class="btn-del" onclick="eliminarCliente('${c.id}')">X</button>
            <div class="flex"><div><select onchange="manejarCambioZona(${index}, this.value)"><option value="">Zona...</option>${opcionesZonas}<option value="NUEVA_ZONA">➕ Añadir nueva zona...</option></select></div><div><input type="text" placeholder="Nombre" value="${c.nombre}" oninput="actualizarDato(${index}, 'nombre', this.value)"></div></div>
            <div>${rows.map((row,ri)=>renderPedidoRow(c,row,ri)).join('')}</div>
            <button class="btn btn-sec btn-mini" onclick="addOrderRow('${c.id}')">＋ Agregar otro tipo de pedido</button>
            <div class="flex" style="margin-top:10px; align-items:center;"><span style="font-size:12px;">Pago Bs:</span><input type="number" style="width:80px; margin:0;" value="${c.pago}" oninput="actualizarDato(${index}, 'pago', this.value)"></div>
        </div>`;
    });
}
function syncLegacyOrders(c) {
    c.orders = { complete: [], loose: [] };
    (c.orderRows || []).forEach(row => {
        const kind = row.kind === 'complete' ? 'complete' : (row.kind === 'loose' ? 'loose' : 'complete');
        Object.entries(row.quantities || {}).forEach(([item, qty]) => { if (Number(qty) > 0) c.orders[kind].push({item, qty:Number(qty)}); });
    });
    c.cant1 = c.orders.complete.find(o=>o.item==='s1')?.qty || 0;
    c.cant2 = c.orders.complete.find(o=>o.item==='s2')?.qty || 0;
}
function setRowKind(id, rowIndex, kind) {
    const c = appData.clientes.find(c => c.id === id); ensureClientOrders(c);
    c.orderRows[rowIndex] = { kind, quantities: {} };
    if (kind === 'extra') c.orderRows[rowIndex].quantities.extra = 0;
    guardarAuto(); renderClientes();
}
function setRowQty(id, rowIndex, item, value) {
    const c = appData.clientes.find(c => c.id === id); ensureClientOrders(c);
    c.orderRows[rowIndex].quantities[item] = Number(value);
    syncLegacyOrders(c); guardarAuto(); renderClientes();
}
function addOrderRow(id) {
    const c = appData.clientes.find(c => c.id === id); ensureClientOrders(c);
    c.orderRows.push({ kind:'', quantities:{} }); guardarAuto(); renderClientes();
}
function removeOrderRow(id, rowIndex) {
    const c = appData.clientes.find(c => c.id === id); ensureClientOrders(c);
    if (c.orderRows.length > 1) c.orderRows.splice(rowIndex,1); else c.orderRows[0] = { kind:'', quantities:{} };
    syncLegacyOrders(c); guardarAuto(); renderClientes();
}

function itemName(item) {
    if (item === 'extra') return appData.config.extra?.name || 'Extra';
    const i = Number(String(item).replace('s','')) - 1;
    return appData.config.seconds?.[i]?.name || appData.config['s'+(i+1)] || `Segundo ${i+1}`;
}
function itemPrice(item) {
    if (item === 'extra') return Number(appData.config.extra?.price || 0);
    const i = Number(String(item).replace('s','')) - 1;
    return Number(appData.config.seconds?.[i]?.price || appData.config.precio || 15);
}
function clientItems(c) {
    const rows = ensureClientOrders(c), out=[];
    rows.forEach(row => { Object.entries(row.quantities || {}).forEach(([item, qty]) => { if (Number(qty)>0) out.push({kind: row.kind === 'complete' ? 'complete' : (row.kind === 'loose' ? 'loose' : 'extra'), item, qty:Number(qty)}); }); });
    return out;
}
function clientTotal(c) { return clientItems(c).reduce((sum,o)=>sum + o.qty * itemPrice(o.item), 0); }
function clientOrderText(c) { return clientItems(c).map(o => { const type = o.item === 'extra' ? 'Extra' : (o.kind === 'complete' ? 'Almuerzo completo' : 'Segundo suelto'); const cls = o.item === 'extra' ? 'badge-extra' : (o.kind === 'complete' ? 'badge-complete' : 'badge-loose'); return `<span class="type-badge ${cls}">${type}</span> ${itemName(o.item)} x${o.qty}`; }).join('<br>') || 'Sin pedido'; }

// --- TABLAS CON LÍNEA NEGRA ---
function renderTabla() {
    const headerRow = document.getElementById('header-row-resumen');
    headerRow.innerHTML = `<th>Zona</th><th>Cliente</th><th>Pedido</th><th>Pago</th>`;
    const body = document.getElementById('body-tabla'); body.innerHTML = '';
    const ordered = [...appData.clientes].filter(c=>c.nombre).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
    ordered.forEach(c => body.innerHTML += `<tr onclick="irACliente('${c.id}')"><td>${c.seccion}</td><td>${c.nombre}</td><td style="text-align:left;">${clientOrderText(c)}</td><td>${c.pago || clientTotal(c)} Bs</td></tr>`);
}
function renderEntrega() {
    const body = document.getElementById('body-entrega'); body.innerHTML = '';
    const ordered = [...appData.clientes].filter(c=>c.nombre).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
    ordered.forEach(c => {
        const deuda = clientTotal(c), clase = (c.pago >= deuda && deuda > 0) ? 'fila-pagada' : (c.entregado ? 'fila-entregada' : '');
        body.innerHTML += `<tr class="${clase}"><td>${c.seccion}</td><td onclick="toggleEntrega('${c.id}')" style="cursor:pointer;font-weight:bold;">${c.nombre}<br><small>${c.entregado?'✅ Entregado':'⭕ Pendiente'}</small></td><td style="text-align:left;">${clientOrderText(c)}</td><td onclick="togglePago('${c.id}', ${deuda})" style="cursor:pointer;">${c.pago || deuda} Bs</td></tr>`;
    });
}
// --- TÁPERS ---
function renderTapers() {
    const body = document.getElementById('body-tapers'); body.innerHTML = '';
    [...appData.clientes].filter(c=>c.nombre).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')).forEach(c => {
        const total = clientItems(c).reduce((n,o)=>n+o.qty,0);
        let clase = c.taperEstado === 1 ? 'fila-taper-ok' : (c.taperEstado === 2 ? 'fila-taper-incompleto' : '');
        let texto = c.taperEstado === 1 ? '✅ REC.' : (c.taperEstado === 2 ? '❌ INC.' : '⚠️ PEND.');
        const selected = String(c.notaTaper||'').split(',').map(x=>x.trim());
        const nota = `<select multiple style="width:100%;font-size:10px;" onchange="updateNota('${c.id}', Array.from(this.selectedOptions).map(o=>o.value).join(', '))"><option ${selected.includes('Segundero')?'selected':''}>Segundero</option><option ${selected.includes('Sopero')?'selected':''}>Sopero</option><option ${selected.includes('Postrero')?'selected':''}>Postrero</option><option ${selected.includes('Capibara')?'selected':''}>Capibara</option></select>`;
        body.innerHTML += `<tr class="${clase}"><td>${c.seccion}</td><td>${c.nombre}</td><td>${total}</td><td onclick="toggleTaperEstado('${c.id}')" style="cursor:pointer;font-weight:bold;">${texto}</td><td>${nota}</td></tr>`;
    });
}
// --- AUXILIARES ---
function toggleEntrega(id) {
    const i = appData.clientes.findIndex(c => c.id === id);
    appData.clientes[i].entregado = !appData.clientes[i].entregado;
    appData.inicioDespacho = true;
    guardarAuto(); renderEntrega();
}

function togglePago(id, monto) {
    const i = appData.clientes.findIndex(c => c.id === id);
    appData.clientes[i].pago = (appData.clientes[i].pago === monto) ? 0 : monto;
    guardarAuto(); renderEntrega();
}

function toggleTaperEstado(id) {
    const i = appData.clientes.findIndex(c => c.id === id);
    appData.clientes[i].taperEstado = (appData.clientes[i].taperEstado + 1) % 3;
    guardarAuto(); renderTapers();
}

function updateNota(id, val) {
    const i = appData.clientes.findIndex(c => c.id === id);
    appData.clientes[i].notaTaper = val;
    if (val) appData.clientes[i].taperEstado = 2;
    guardarAuto(); renderTapers();
}

function actualizarDato(index, campo, valor) {
    if (campo === 'pago') valor = Number(valor);
    appData.clientes[index][campo] = valor;
    guardarAuto();
}

function eliminarCliente(id) {
    if (confirm("¿Eliminar?")) {
        appData.clientes = appData.clientes.filter(c => c.id !== id);
        renderClientes(); guardarAuto();
    }
}

function irACliente(id) {
    nav('scr-pedidos');
    setTimeout(() => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }, 150);
}

// --- CIERRE FINAL ---
function mostrarCierreFinal() {
    const counts = {}, kinds = {}, soups = { value: 0 }, totalPlates = { value: 0 }, totalMoney = { value: 0 }, faltanT = [];
    appData.clientes.forEach(c => {
        clientItems(c).forEach(o => {
            const key = o.item === 'extra' ? 'extra' : o.item;
            counts[key] = (counts[key] || 0) + o.qty;
            totalPlates.value += o.qty;
            if (o.kind === 'complete') soups.value += o.qty;
        });
        totalMoney.value += clientTotal(c);
        if (c.nombre && c.taperEstado !== 1) faltanT.push(c.nombre);
    });
    const seconds = appData.config.seconds || [];
    const lines = seconds.map((sec,i) => `<div style="margin:8px 0;"><b>Nombre del ${i+1}er segundo:</b> ${sec.name}<br><span class="highlight">${counts['s'+(i+1)] || 0}</span> platos</div>`);
    if (appData.config.extra) lines.push(`<div style="margin:8px 0;"><b>Extras:</b> ${appData.config.extra.name}<br><span class="highlight">${counts.extra || 0}</span> platos extra</div>`);
    document.getElementById('res-s1').innerHTML = lines.join('') || 'Sin pedidos';
    document.getElementById('res-total-sopas').innerText = soups.value;
    document.getElementById('res-total-platos').innerText = totalPlates.value;
    document.getElementById('res-total-dinero').innerText = totalMoney.value.toFixed(2);
    document.getElementById('lista-deben-taper').innerText = "Pendientes táper: " + (faltanT.join(", ") || "Ninguno");
    nav('scr-final');
}

function guardarYSalir() {
    if (confirm("¿Finalizar el día?")) {
        localStorage.removeItem('rancho_vFinal_Zonas');
        location.reload();
    }
}

// --- CARGA ---
window.onload = function() {
    const data = localStorage.getItem('rancho_vFinal_Zonas');
    if (data) {
        appData = JSON.parse(data);
        if (!appData.config.seconds) appData.config.seconds = [1,2].map((_,i)=>({name:appData.config['s'+(i+1)] || `Segundo ${i+1}`, price:appData.config.precio || 15}));
        appData.clientes.forEach(ensureClientOrders);
        if (appData.clientes.length > 0) nav('scr-pedidos');
    }
    document.getElementById('conf-fecha').valueAsDate = new Date();
    renderConfigSegundos();
};

  