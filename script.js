/**
 * NextMile ERP - Fixed & Persistent
 */

let HOURLY_RATE = 1500;
let editingOrderId = null;
const state = { clients: [], products: [] };

const EMPLOYEES = [
    { id: 1, name: "Олександр (Моторист)", role: 'MENTOR' },
    { id: 2, name: "Дмитро (Ходовик)", role: 'MASTER' },
    { id: 3, name: "Андрій (Електрик)", role: 'MASTER' },
    { id: 4, name: "Учень Сергій", role: 'TRAINEE' }
];

const views = {
    clients: document.getElementById('clientsList'),
    workshop: document.getElementById('kanbanBoard'),
    warehouse: document.getElementById('warehouseView'),
    kasa: document.getElementById('kasaView')
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupNavigation();
});

function setupNavigation() {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const text = item.innerText.toUpperCase();
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
                if(fab) fab.style.display = 'none';
                renderWarehouse();
            } else if (text.includes('КАСА')) {
                views.kasa.style.display = 'block';
                if(fab) fab.style.display = 'none';
                renderKasa(); 
            }
            
        });
    });
}

// --- DATA & PERSISTENCE ---
async function loadData() {
    // 1. Спроба завантажити з Сервера
    try {
        const cRes = await fetch('/clients');
        if (cRes.ok) state.clients = await cRes.json();
        else throw new Error('No Server');
    } catch(e) { 
        // 2. Якщо сервера немає (GitHub Pages) — беремо з пам'яті браузера
        console.log("Local Clients Mode"); 
        const local = localStorage.getItem('erp_clients');
        if(local) state.clients = JSON.parse(local);
    }

    try {
        const pRes = await fetch('/products');
        if (pRes.ok) state.products = await pRes.json();
        else throw new Error('No Server');
    } catch(e) { 
        console.log("Local Products Mode"); 
        const local = localStorage.getItem('erp_products');
        if(local) state.products = JSON.parse(local);
    }
    
    renderClients();
}

function saveDataLocally() {
    // Зберігаємо стан у браузері
    localStorage.setItem('erp_clients', JSON.stringify(state.clients));
    localStorage.setItem('erp_products', JSON.stringify(state.products));
}

function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    // Додаємо іконку та текст
    toast.innerHTML = `<i class="fa-solid fa-check-circle" style="color:#27ae60; margin-right:10px;"></i> ${message}`;
    
    container.appendChild(toast);
    
    // Видаляємо через 5 секунди
    setTimeout(() => {
        toast.style.opacity = '0'; // Плавне зникнення
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// --- RENDER CLIENTS ---
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
                <i class="fa-solid fa-pen edit-icon" onclick="editOrder(${order.id})"></i>
                <i class="fa-solid fa-trash delete-order-icon" onclick="deleteOrder(${order.id})"></i>
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

// --- WAREHOUSE ---

function renderWarehouse() {
    // Шукаємо таблицю
    const tbody = document.getElementById('productsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    // Якщо пусто
    if (state.products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:#999; font-style:italic;">Склад порожній. Додайте перший товар!</td></tr>';
        return;
    }

    state.products.forEach(prod => {
        // Валюта
        let curr = '₴';
        if(prod.currency === 'USD') curr = '$';
        if(prod.currency === 'EUR') curr = '€';
        
        // Категорія (якщо немає - пишемо "Загальне")
        const categoryLabel = prod.category || 'Загальне';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="sku-text">${prod.sku || '-'}</span></td>
            <td style="font-weight: 600; font-size: 15px;">${prod.name}</td>
            <td><span class="badge-category">${categoryLabel}</span></td>
            <td><span class="badge-stock">${prod.quantity} шт</span></td>
            <td style="color: #666;">${prod.buyPrice} ${curr}</td>
            <td><span class="price-sell">${prod.sellPrice} ₴</span></td>
            <td style="text-align:right;">
                <div style="display:flex; justify-content:flex-end;">
                    <div class="action-btn" onclick="deleteProduct(${prod.id})" title="Видалити">
                        <i class="fa-solid fa-trash"></i>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- ACTIONS ---
document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // FIX: Використовуємо quantity, щоб збігалося з БД
    const newProduct = {
        id: Date.now(),
        sku: document.getElementById('prodSku').value,
        name: document.getElementById('prodName').value,
        category: document.getElementById('prodCategory').value,
        quantity: parseInt(document.getElementById('prodQty').value) || 0, // БУЛО qty
        buyPrice: parseFloat(document.getElementById('prodBuy').value) || 0,
        sellPrice: parseFloat(document.getElementById('prodSell').value) || 0
    };
    
    state.products.push(newProduct);
    saveDataLocally(); // Зберігаємо в браузері
    renderWarehouse();
    
    document.getElementById('productModal').close();
    document.getElementById('addProductForm').reset();
    showToast('Товар успішно додано!');

    try { 
        await fetch('/products', { 
            method: 'POST', 
            headers:{'Content-Type':'application/json'}, 
            body:JSON.stringify(newProduct)
        }); 
    } catch(err){}
});

window.deleteProduct = async (id) => {
    if(!confirm("Видалити товар зі складу?")) return;
    state.products = state.products.filter(p => p.id !== id);
    saveDataLocally();
    renderWarehouse();
    showToast('Товар видалено');
    try { await fetch(`/products/${id}`, { method: 'DELETE' }); } catch(err){}
};

// --- ORDERS ---
document.getElementById('addOrderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const clientId = document.getElementById('modalClientId').value;
    const client = state.clients.find(c => c.id == clientId);
    if (!client) return;

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

    // Збираємо всі дані для збереження
    const orderData = {
        clientId: parseInt(clientId),
        
        // 👇 НОВІ ПОЛЯ (Додали ці 4 рядки)
        carModel: document.getElementById('carModel').value,
        carPlate: document.getElementById('carPlate').value, 
        carVin: document.getElementById('carVin').value,
        carMileage: document.getElementById('carMileage').value,
        // 👆 ----------------

        services: services,
        partsCost: document.getElementById('partsCost').value,
        advance: document.getElementById('advance').value,
        status: 'ЧЕРГА'
    };

    if (editingOrderId) {
        const orderIndex = client.orders.findIndex(o => o.id === editingOrderId);
        if (orderIndex !== -1) {
            orderData.id = editingOrderId;
            orderData.status = client.orders[orderIndex].status;
            client.orders[orderIndex] = orderData;
        }
    } else {
        if(!client.orders) client.orders = [];
        orderData.id = Date.now();
        client.orders.push(orderData);
    }

    saveDataLocally();
    document.getElementById('orderModal').close();
    document.getElementById('addOrderForm').reset();
    renderClients();
    renderKanban();
    showToast('Замовлення збережено!');

    try {
        const url = editingOrderId ? `/orders/${editingOrderId}` : '/orders';
        const method = editingOrderId ? 'PUT' : 'POST';
        await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(orderData) });
    } catch(err) {}
});

window.deleteOrder = async (orderId) => {
    if(!confirm("Видалити це замовлення?")) return;
    state.clients.forEach(c => { if(c.orders) c.orders = c.orders.filter(o => o.id !== orderId); });
    saveDataLocally();
    renderClients();
    renderKanban();
    showToast('Замовлення видалено');
    try { await fetch(`/orders/${orderId}`, { method: 'DELETE' }); } catch(err) {}
};

// --- MODAL HELPERS ---
window.openOrderModal = (clientId) => {
    editingOrderId = null;
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
    editingOrderId = id;
    let targetOrder, targetClient;
    state.clients.forEach(c => { if(c.orders) { const found = c.orders.find(ord => ord.id === id); if(found) { targetOrder = found; targetClient = c; } } });
    if(!targetOrder) return;
    document.getElementById('modalClientId').value = targetClient.id;
    document.getElementById('carModel').value = targetOrder.carModel;
    document.getElementById('carPlate').value = targetOrder.carPlate || ''; 
    document.getElementById('carVin').value = targetOrder.carVin || '';     
    document.getElementById('carMileage').value = targetOrder.carMileage || '';
    document.getElementById('partsCost').value = targetOrder.partsCost || 0;
    document.getElementById('advance').value = targetOrder.advance || 0;
    document.getElementById('services-container').innerHTML = '';
    if(targetOrder.services && targetOrder.services.length > 0) targetOrder.services.forEach(s => addServiceRow(s));
    else addServiceRow({ name: targetOrder.description, hours: targetOrder.hours, price: targetOrder.pricePerHour });
    document.getElementById('orderModal').showModal();
    calc();
};

// --- KANBAN ---
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
window.drop = async (e, statusKey) => { e.preventDefault(); const orderId = parseInt(e.dataTransfer.getData("text")); const statusMap = { 'queue': 'ЧЕРГА', 'work': 'В РОБОТІ', 'done': 'ГОТОВО' }; const newStatusText = statusMap[statusKey]; let found = false; state.clients.forEach(c => { if(c.orders) { const o = c.orders.find(ord => ord.id === orderId); if(o) { o.status = newStatusText; found = true; } } }); if(found) { saveDataLocally(); renderKanban(); } try { await fetch(`/orders/${orderId}/status`, { method: 'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status: newStatusText}) }); } catch(err){} };

// --- HELPERS ---
window.addServiceRow = (d=null) => {
    const container = document.getElementById('services-container');
    const id = Date.now() + Math.random().toString().slice(2);
    const div = document.createElement('div');
    div.className = 'service-row';
    div.innerHTML = `<div class="service-inputs-row"><div class="col-name"><label>Послуга</label><input class="form-control service-name" placeholder="Назва..." value="${d?d.name:''}"></div><div class="col-qty"><label>Год</label><input type="number" class="form-control service-hours" step="0.5" value="${d?d.hours:'1'}" oninput="calc()"></div><div class="col-price"><label>Ціна</label><input type="number" class="form-control service-price" value="${d?d.price:HOURLY_RATE}" oninput="calc()"></div><div class="col-del"><i class="fa-solid fa-trash btn-delete-row" onclick="this.closest('.service-row').remove(); calc()"></i></div></div><div class="service-masters-list" id="m-${id}"></div><div style="margin-top:5px;"><button type="button" class="btn-small" onclick="addMaster('${id}')">+ Майстер</button></div>`;
    container.appendChild(div);
    if(d && d.masters) d.masters.forEach(m => addMaster(id, m));
    calc();
};
window.addMaster = (rowId, m=null) => { const list = document.getElementById(`m-${rowId}`); const opts = EMPLOYEES.map(e => `<option value="${e.id}" ${m && m.id==e.id?'selected':''}>${e.name}</option>`).join(''); const div = document.createElement('div'); div.className = 'master-row'; div.innerHTML = `<select class="form-control master-select" style="margin:0; width:auto; flex:1;">${opts}</select><input type="number" class="form-control participation-input" style="margin:0; width:70px;" value="${m?m.share:'100'}"> %<i class="fa-solid fa-times" style="cursor:pointer; color:#999;" onclick="this.parentElement.remove()"></i>`; list.appendChild(div); };
window.calc = () => { let tot = 0; document.querySelectorAll('.service-row').forEach(r => { const h = parseFloat(r.querySelector('.service-hours').value) || 0; const p = parseFloat(r.querySelector('.service-price').value) || 0; tot += h * p; }); tot += parseFloat(document.getElementById('partsCost').value)||0; document.getElementById('liveTotal').innerText = `РАЗОМ: ${tot} грн`; };
window.deleteClient = async (id) => {
    if(confirm('Видалити клієнта та всю його історію замовлень?')) {
        // 1. Видаляємо візуально (щоб було швидко)
        state.clients = state.clients.filter(c => c.id !== id);
        saveDataLocally();
        renderClients();
        
        // 2. Відправляємо запит на сервер (щоб видалити з Бази)
        try {
            await fetch(`/clients/${id}`, { method: 'DELETE' });
            showToast('Клієнта видалено остаточно');
        } catch(err) {
            console.error(err);
            alert('Помилка: Не вдалося видалити з бази даних');
            // Якщо помилка - краще перезавантажити дані, щоб повернути клієнта
            loadData(); 
        }
    }
};
/* --- СТВОРЕННЯ КЛІЄНТА (+ АВТО АВТОМАТИЧНО) --- */
document.getElementById('addClientForm').addEventListener('submit', async (e) => { 
    e.preventDefault(); 
    
    // 1. Збираємо дані
    const name = document.getElementById('newClientName').value; 
    const phone = document.getElementById('newClientPhone').value; 
    const carModel = document.getElementById('newClientCar').value;
    const carPlate = document.getElementById('newClientPlate').value;
    const carVin = document.getElementById('newClientVin').value;

    try {
        // КРОК А: Створюємо клієнта
        const res = await fetch('/clients', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ name, phone }) 
        });

        if (!res.ok) throw new Error("Помилка сервера");
        
        // Отримуємо створеного клієнта (з ID) від сервера
        const newClient = await res.json();

        // КРОК Б: Якщо ввели машину -> Створюємо замовлення
        if (carModel.trim() !== "") {
            const orderData = {
                clientId: newClient.id, // Використовуємо ID нового клієнта
                carModel: carModel,
                carPlate: carPlate || "",
                carVin: carVin || "",
                carMileage: 0,
                description: "Перший візит",
                services: [],
                partsCost: 0,
                advance: 0,
                status: 'ЧЕРГА'
            };

            await fetch('/orders', { 
                method: 'POST', 
                headers:{'Content-Type':'application/json'}, 
                body:JSON.stringify(orderData) 
            });
            
            showToast('Клієнт + Авто додані!');
        } else {
            showToast('Клієнт успішно створений'); 
        }

        // Оновлюємо таблицю і чистимо форму
        await loadData();
        document.getElementById('addClientForm').reset();
        document.getElementById('clientModal').close(); 

    } catch(err) {
        console.error(err);
        showToast('Помилка: ' + err.message);
    } 
});

const cancelBtn = document.querySelector('.btn-cancel'); if(cancelBtn) cancelBtn.onclick = () => document.getElementById('orderModal').close();

// --- KASA LOGIC ---
/* --- KASA LOGIC (FIXED) --- */
function renderKasa() {
    const tableBody = document.getElementById('salaryTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    // Скидаємо статистику
    let stats = {};
    EMPLOYEES.forEach(emp => {
        stats[emp.id] = { name: emp.name, role: emp.role, ordersCount: 0, hours: 0, workRevenue: 0, salary: 0 };
    });

    let totalRevenue = 0;
    let totalPartsCost = 0;

    state.clients.forEach(client => {
        if(!client.orders) return;
        client.orders.forEach(order => {
            
            // 1. Рахуємо витрати на запчастини (вони рахуються завжди, бо ми їх купили)
            totalPartsCost += (parseFloat(order.partsCost) || 0);

            // ⚠️ ВАЖЛИВО: Перевіряємо статус замовлення
            // Зарплату і дохід рахуємо ТІЛЬКИ якщо робота зроблена
            const isDone = order.status === 'done' || order.status === 'ГОТОВО';

            if (order.services) {
                order.services.forEach(service => {
                    const sPrice = parseFloat(service.price) || 0;
                    const sHours = parseFloat(service.hours) || 0;
                    const sTotal = sPrice * sHours;

                    // Якщо замовлення готове - додаємо в загальний оборот
                    if (isDone) {
                        totalRevenue += sTotal;
                    }

                    // Рахуємо зарплату майстрам
                    if (service.masters && service.masters.length > 0) {
                        // Визначаємо тип робіт для комісії
                        const hasMentor = service.masters.some(m => getMasterRole(m) === 'MENTOR');
                        const hasTrainee = service.masters.some(m => getMasterRole(m) === 'TRAINEE');
                        const isTrainingCase = hasMentor && hasTrainee;

                        service.masters.forEach(m => {
                            // 🔥 ФІКС ПРОБЛЕМИ ЗНИКНЕННЯ:
                            // Якщо дані з сервера -> беремо employeeId
                            // Якщо дані локальні -> беремо id
                            const empId = m.employeeId ? m.employeeId : parseInt(m.id);
                            
                            if (stats[empId]) {
                                // Статистику (години) додаємо завжди, або тільки коли готово?
                                // Зазвичай гроші нараховують тільки коли "ГОТОВО".
                                
                                if (isDone) { 
                                    stats[empId].ordersCount += 1;
                                    stats[empId].hours += (sHours * (m.share / 100));
                                    stats[empId].workRevenue += (sTotal * (m.share / 100));

                                    let commission = 0;
                                    const role = stats[empId].role;

                                    if (isTrainingCase) {
                                        if (role === 'MENTOR') commission = 0.20;
                                        else if (role === 'TRAINEE') commission = 0.30;
                                        else commission = 0.50; // Інші
                                    } else {
                                        if (role === 'TRAINEE') commission = 0.30;
                                        else commission = 0.50; // Стандарт 50%
                                    }
                                    
                                    stats[empId].salary += (sTotal * (m.share / 100)) * commission;
                                }
                            }
                        });
                    }
                });
            }
        });
    });

    // Загальний оборот включає і запчастини (якщо замовлення готове? 
    // Зазвичай запчастини рахують одразу, але для чистоти додамо їх в оборот теж тільки по факту)
    // Тут логіка проста: Revenue = Роботи (Done) + Запчастини (All). 
    // Можна змінити, щоб запчастини теж додавалися тільки Done, але поки залишимо так.
    
    totalRevenue += totalPartsCost; 
    
    let totalSalaryFund = 0;

    // Малюємо таблицю
    Object.values(stats).forEach(s => {
        totalSalaryFund += s.salary;
        let salaryDisplay = `${s.salary.toFixed(0)} ₴`;
        
        // Підсвітка, якщо велика ЗП
        if (s.salary > 40000 && (s.role === 'MASTER' || s.role === 'MENTOR')) {
            salaryDisplay = `<span style="color:#d32f2f; font-weight:bold;">${s.salary.toFixed(0)} ₴</span> <small>(>40к)</small>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${s.name}</b><br><small style="color:#888">${s.role}</small></td>
            <td>${s.ordersCount}</td>
            <td>${s.hours.toFixed(1)} год</td>
            <td>${s.workRevenue.toFixed(0)} ₴</td>
            <td style="font-weight:bold; color:#27ae60;">${salaryDisplay}</td>
        `;
        tableBody.appendChild(tr);
    });

    document.getElementById('totalRevenue').innerText = `${totalRevenue.toFixed(0)} ₴`;
    document.getElementById('totalPartsCost').innerText = `${totalPartsCost.toFixed(0)} ₴`;
    document.getElementById('totalSalaryFund').innerText = `${totalSalaryFund.toFixed(0)} ₴`;
    document.getElementById('grossProfit').innerText = `${(totalRevenue - totalPartsCost - totalSalaryFund).toFixed(0)} ₴`;
}

// Допоміжна функція для отримання ролі (враховує різницю ID)
function getMasterRole(m) {
    const empId = m.employeeId ? m.employeeId : parseInt(m.id);
    const emp = EMPLOYEES.find(e => e.id === empId);
    return emp ? emp.role : 'MASTER';
}

/* --- ДРУК АКТУ --- */
function printAcceptanceAct() {
    const clientId = document.getElementById('modalClientId').value;
    let clientName = "Гість";
    let clientPhone = "---";

    // Знаходимо клієнта в базі (state.clients завантажується при старті)
    if (typeof state !== 'undefined' && state.clients) {
        const client = state.clients.find(c => c.id == clientId);
        if (client) {
            clientName = client.name;
            clientPhone = client.phone;
        }
    }

    // Збираємо дані
    const printData = {
        orderId: "ORD-" + Math.floor(Date.now() / 1000).toString().slice(-4),
        clientName: clientName,
        clientPhone: clientPhone,
        carModel: document.getElementById('carModel').value || '',
        // Якщо цих полів ще немає в HTML, будуть пусті рядки
        carPlate: document.getElementById('carPlate')?.value || '', 
        carVin: document.getElementById('carVin')?.value || '',
        carMileage: document.getElementById('carMileage')?.value || ''
    };

    // Зберігаємо і відкриваємо
    localStorage.setItem('print_data_act', JSON.stringify(printData));
    window.open('docs/act_reception/print.html', '_blank');
}

/* --- ДРУК ПРЯМО З МОДАЛКИ (ШВИДКИЙ ПРИЙОМ) --- */
function printModalAct() {
    const clientId = document.getElementById('modalClientId').value;
    let clientName = "Клієнт";
    let clientPhone = "";

    // Шукаємо клієнта в базі (бо ID у нас є)
    if (typeof state !== 'undefined' && state.clients) {
        const client = state.clients.find(c => c.id == clientId);
        if (client) {
            clientName = client.name;
            clientPhone = client.phone;
        }
    }

    // Збираємо дані для друку (VIN, Номер, Пробіг)
    const printData = {
        orderId: "NEW", // Пишемо NEW, бо замовлення ще не створене
        clientName: clientName,
        clientPhone: clientPhone,
        carModel: document.getElementById('carModel').value || '',
        carPlate: document.getElementById('carPlate').value || '',
        carVin: document.getElementById('carVin').value || '',
        carMileage: document.getElementById('carMileage').value || ''
    };

    // Зберігаємо і відкриваємо
    localStorage.setItem('print_data_act', JSON.stringify(printData));
    window.open('docs/act_reception/print.html', '_blank');
}