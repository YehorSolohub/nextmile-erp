/**
 * NextMile ERP - STABLE SAVE & DELETE
 */

let HOURLY_RATE = 1500;
let editingOrderId = null; // ID замовлення, яке редагуємо
const state = { clients: [] };

const EMPLOYEES = [
    { id: 1, name: "Олександр (Моторист)" },
    { id: 2, name: "Дмитро (Ходовик)" },
    { id: 3, name: "Андрій (Електрик)" },
    { id: 4, name: "Учень Сергій" }
];

const views = {
    clients: document.getElementById('clientsList'),
    workshop: document.getElementById('kanbanBoard'),
    warehouse: document.getElementById('warehouseView')
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const text = item.innerText.toUpperCase();
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            Object.values(views).forEach(el => { if(el) el.style.display = 'none'; });
            const fab = document.querySelector('.fab');

            if (text.includes('КЛІЄНТИ')) {
                views.clients.style.display = 'grid';
                if(fab) fab.style.display = 'flex';
            } else if (text.includes('МАЙСТЕРНЯ')) {
                views.workshop.style.display = 'flex';
                if(fab) fab.style.display = 'none';
                renderKanban();
            } else if (text.includes('СКЛАД')) {
                views.warehouse.style.display = 'block';
            }
        });
    });
});

async function loadData() {
    try {
        const res = await fetch('/clients');
        if (res.ok) state.clients = await res.json();
        renderClients();
    } catch(e) { 
        console.log("Local Mode");
        renderClients(); 
    }
}

// --- RENDER ---
function renderClients() {
    const list = document.getElementById('clientsList');
    if(!list) return;
    list.innerHTML = '';
    
    state.clients.forEach(client => {
        const ordersHtml = client.orders?.map(o => createOrderHtml(o)).join('') || '';
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div class="card-body">
                <div class="client-header">
                    <div class="client-info">
                        <div class="avatar-initials">${client.name.substring(0,2).toUpperCase()}</div>
                        <div><h3>${client.name}</h3><small>${client.phone}</small></div>
                    </div>
                    <div class="client-actions">
                        <div class="btn-icon" onclick="openOrderModal(${client.id})"><i class="fa-solid fa-plus"></i></div>
                        <div class="btn-icon delete-btn" onclick="deleteClient(${client.id})"><i class="fa-solid fa-trash"></i></div>
                    </div>
                </div>
                <div class="order-list">${ordersHtml}</div>
            </div>`;
        list.appendChild(div);
    });
}

function createOrderHtml(order) {
    let workSum = 0;
    if(order.services && order.services.length) {
        workSum = order.services.reduce((acc, s) => acc + (parseFloat(s.hours)*parseFloat(s.price)), 0);
    } else {
        workSum = (order.hours || 0) * (order.pricePerHour || 0);
    }
    const total = workSum + (parseFloat(order.partsCost)||0);
    const debt = total - (parseFloat(order.advance)||0);
    
    const statusMap = { 'queue': 'ЧЕРГА', 'work': 'В РОБОТІ', 'done': 'ГОТОВО', 'ЧЕРГА': 'ЧЕРГА', 'В РОБОТІ': 'В РОБОТІ', 'ГОТОВО': 'ГОТОВО' };
    const displayStatus = statusMap[order.status] || 'ЧЕРГА';

    return `
    <div class="order-item">
        <div class="order-header">
            <div>
                <div class="car-title">🚗 ${order.carModel}</div>
                <span class="status-badge">${displayStatus}</span>
            </div>
            <div class="order-actions">
                <i class="fa-solid fa-pen edit-icon" title="Редагувати" onclick="editOrder(${order.id})"></i>
                <i class="fa-solid fa-trash delete-order-icon" title="Видалити замовлення" onclick="deleteOrder(${order.id})"></i>
            </div>
        </div>
        <div style="font-size:13px; color:#555; margin-bottom:10px;">
            ${order.services ? order.services.map(s => `• ${s.name}`).join('<br>') : order.description || ''}
        </div>
        <div class="order-footer">
            <span>${total} грн</span>
            <span class="${debt<=0?'text-success':'text-danger'}">${debt<=0?'Оплачено':`Борг: ${debt}`}</span>
        </div>
    </div>`;
}

// --- ВИДАЛЕННЯ ЗАМОВЛЕННЯ (Щоб прибрати дублі) ---
window.deleteOrder = async (orderId) => {
    if(!confirm("Ви впевнені, що хочете видалити цей заказ-наряд?")) return;

    // Шукаємо і видаляємо локально
    state.clients.forEach(client => {
        if(client.orders) {
            client.orders = client.orders.filter(o => o.id !== orderId);
        }
    });

    renderClients();
    renderKanban();

    // Видаляємо на сервері
    try {
        await fetch(`/orders/${orderId}`, { method: 'DELETE' });
    } catch(err) { console.log('Deleted locally'); }
};

// --- MODALS ---
window.openOrderModal = (clientId) => {
    editingOrderId = null; // Це НОВЕ
    document.getElementById('modalClientId').value = clientId;
    document.getElementById('carModel').value = '';
    document.getElementById('partsCost').value = 0;
    document.getElementById('advance').value = 0;
    document.getElementById('services-container').innerHTML = '';
    
    addServiceRow(); 
    document.getElementById('orderModal').showModal();
    calc();
};

window.editOrder = (id) => {
    editingOrderId = id; // Це РЕДАГУВАННЯ
    
    let targetOrder, targetClient;
    state.clients.forEach(c => {
        if(c.orders) {
            const found = c.orders.find(ord => ord.id === id);
            if(found) { targetOrder = found; targetClient = c; }
        }
    });

    if(!targetOrder) return;
    
    document.getElementById('modalClientId').value = targetClient.id;
    document.getElementById('carModel').value = targetOrder.carModel;
    document.getElementById('partsCost').value = targetOrder.partsCost || 0;
    document.getElementById('advance').value = targetOrder.advance || 0;

    const container = document.getElementById('services-container');
    container.innerHTML = '';
    
    if(targetOrder.services && targetOrder.services.length > 0) {
        targetOrder.services.forEach(s => addServiceRow(s));
    } else {
        addServiceRow({ name: targetOrder.description, hours: targetOrder.hours, price: targetOrder.pricePerHour });
    }
    
    document.getElementById('orderModal').showModal();
    calc();
};

// --- ЗБЕРЕЖЕННЯ (Fix: Спочатку закриваємо, потім думаємо) ---
document.getElementById('addOrderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const clientId = document.getElementById('modalClientId').value;
    const client = state.clients.find(c => c.id == clientId);
    
    if (!client) return;

    // Збір даних
    const services = [];
    document.querySelectorAll('.service-row').forEach(r => {
        const masters = [];
        r.querySelectorAll('.master-row').forEach(m => {
            masters.push({ id: m.querySelector('.master-select').value, share: m.querySelector('.participation-input').value });
        });
        services.push({
            name: r.querySelector('.service-name').value,
            hours: r.querySelector('.service-hours').value,
            price: r.querySelector('.service-price').value,
            masters: masters
        });
    });

    const orderData = {
        clientId: parseInt(clientId),
        carModel: document.getElementById('carModel').value,
        services: services,
        partsCost: document.getElementById('partsCost').value,
        advance: document.getElementById('advance').value,
        status: 'ЧЕРГА'
    };

    // Оновлення стану
    if (editingOrderId) {
        const orderIndex = client.orders.findIndex(o => o.id === editingOrderId);
        if (orderIndex !== -1) {
            orderData.id = editingOrderId;
            orderData.status = client.orders[orderIndex].status; // Зберігаємо старий статус
            client.orders[orderIndex] = orderData; // ПЕРЕЗАПИСУЄМО, А НЕ ДОДАЄМО
        }
    } else {
        if(!client.orders) client.orders = [];
        orderData.id = Date.now();
        client.orders.push(orderData);
    }

    // 1. СПОЧАТКУ ЗАКРИВАЄМО МОДАЛКУ!
    document.getElementById('orderModal').close();
    document.getElementById('addOrderForm').reset();

    // 2. ПОТІМ ОНОВЛЮЄМО ЕКРАН
    try {
        renderClients();
        renderKanban();
    } catch(err) { console.error("Render error", err); }

    // 3. ПОТІМ ВІДПРАВЛЯЄМО НА СЕРВЕР
    try {
        const url = editingOrderId ? `/orders/${editingOrderId}` : '/orders';
        const method = editingOrderId ? 'PUT' : 'POST';
        await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(orderData) });
    } catch(err) {}
});

// --- СЕРВІСНІ РЯДКИ ---
window.addServiceRow = (d=null) => {
    const container = document.getElementById('services-container');
    const id = Date.now() + Math.random().toString().slice(2);
    const div = document.createElement('div');
    div.className = 'service-row';
    
    div.innerHTML = `
        <div class="service-inputs-row">
            <div class="col-name"><label>Послуга</label><input class="form-control service-name" placeholder="Назва..." value="${d?d.name:''}"></div>
            <div class="col-qty"><label>Год</label><input type="number" class="form-control service-hours" step="0.5" value="${d?d.hours:'1'}" oninput="calc()"></div>
            <div class="col-price"><label>Ціна</label><input type="number" class="form-control service-price" value="${d?d.price:HOURLY_RATE}" oninput="calc()"></div>
            <div class="col-del"><i class="fa-solid fa-trash btn-delete-row" title="Видалити послугу" onclick="this.closest('.service-row').remove(); calc()"></i></div>
        </div>
        <div class="service-masters-list" id="m-${id}"></div>
        <div style="margin-top:5px;"><button type="button" class="btn-small" onclick="addMaster('${id}')">+ Майстер</button></div>
    `;
    container.appendChild(div);
    if(d && d.masters) d.masters.forEach(m => addMaster(id, m));
    calc();
};

window.addMaster = (rowId, m=null) => {
    const list = document.getElementById(`m-${rowId}`);
    const opts = EMPLOYEES.map(e => `<option value="${e.id}" ${m && m.id==e.id?'selected':''}>${e.name}</option>`).join('');
    const div = document.createElement('div');
    div.className = 'master-row';
    div.innerHTML = `
        <select class="form-control master-select" style="margin:0; width:auto; flex:1;">${opts}</select>
        <input type="number" class="form-control participation-input" style="margin:0; width:70px;" value="${m?m.share:'100'}"> %
        <i class="fa-solid fa-times" style="cursor:pointer; color:#999;" onclick="this.parentElement.remove()"></i>
    `;
    list.appendChild(div);
};

window.calc = () => {
    let tot = 0;
    document.querySelectorAll('.service-row').forEach(r => {
        const h = parseFloat(r.querySelector('.service-hours').value) || 0;
        const p = parseFloat(r.querySelector('.service-price').value) || 0;
        tot += h * p;
    });
    tot += parseFloat(document.getElementById('partsCost').value)||0;
    document.getElementById('liveTotal').innerText = `РАЗОМ: ${tot} грн`;
};

// ... Kanban and Client logic same as before ...
window.deleteClient = (id) => { if(confirm('Видалити клієнта?')) { state.clients = state.clients.filter(c => c.id !== id); renderClients(); } };
document.getElementById('addClientForm').addEventListener('submit', async (e) => { e.preventDefault(); const name = document.getElementById('newClientName').value; const phone = document.getElementById('newClientPhone').value; state.clients.push({id:Date.now(), name, phone, orders:[]}); renderClients(); document.getElementById('clientModal').close(); });
const cancelBtn = document.querySelector('.btn-cancel'); if(cancelBtn) cancelBtn.onclick = () => document.getElementById('orderModal').close();

// --- KANBAN RENDER ---
function renderKanban() {
    const board = document.getElementById('kanbanBoard');
    if(!board) return;
    board.innerHTML = '';
    const columns = [{ id: 'queue', title: 'Черга', cls: 'queue' }, { id: 'work', title: 'В роботі', cls: 'work' }, { id: 'done', title: 'Готово', cls: 'done' }];
    const data = { queue: [], work: [], done: [] };
    const statusMap = { 'queue': 'queue', 'work': 'work', 'done': 'done', 'ЧЕРГА': 'queue', 'В РОБОТІ': 'work', 'ГОТОВО': 'done' };
    state.clients.forEach(c => { if(c.orders) { c.orders.forEach(o => { let key = statusMap[o.status] || 'queue'; if(data[key]) data[key].push({...o, clientName: c.name}); }); } });
    columns.forEach(col => {
        const colDiv = document.createElement('div'); colDiv.className = 'kanban-col';
        colDiv.innerHTML = `<div class="k-header ${col.cls}"><span>${col.title}</span><span>${data[col.id].length}</span></div><div class="k-body" ondrop="drop(event, '${col.id}')" ondragover="allowDrop(event)">${data[col.id].map(o => `<div class="kanban-card status-${col.cls}" draggable="true" ondragstart="drag(event, ${o.id})"><div style="font-weight:bold">${o.carModel}</div><div style="font-size:12px; color:#666">${o.clientName}</div></div>`).join('')}</div>`;
        board.appendChild(colDiv);
    });
}
window.allowDrop = (e) => e.preventDefault();
window.drag = (e, id) => e.dataTransfer.setData("text", id);
window.drop = async (e, statusKey) => { e.preventDefault(); const orderId = parseInt(e.dataTransfer.getData("text")); const statusMap = { 'queue': 'ЧЕРГА', 'work': 'В РОБОТІ', 'done': 'ГОТОВО' }; const newStatusText = statusMap[statusKey]; let found = false; state.clients.forEach(c => { if(c.orders) { const o = c.orders.find(ord => ord.id === orderId); if(o) { o.status = newStatusText; found = true; } } }); if(found) renderKanban(); try { await fetch(`/orders/${orderId}/status`, { method: 'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status: newStatusText}) }); } catch(err){} };