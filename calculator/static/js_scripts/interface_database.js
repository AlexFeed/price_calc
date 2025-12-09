// Read cookie helper for CSRF token
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

const lettersBtn = document.getElementById('lettersBtn');
if (lettersBtn) lettersBtn.addEventListener('click', () => {
    window.location.href = '/manage/';
});

// Хранилище пользователей (local cache) и текущие данные
let users = JSON.parse(localStorage.getItem('mailUsers')) || [];
// Sanitize stored users: remove any plaintext passwords left from old prototype versions
try {
    let changed = false;
    users = users.map(u => {
        if (u && u.password) {
            delete u.password;
            changed = true;
        }
        return u;
    });
    if (changed) {
        localStorage.setItem('mailUsers', JSON.stringify(users));
    }
} catch (e) {
// if parsing failed, reset to empty list
    users = [];
    localStorage.removeItem('mailUsers');
}

let currentUser = null;

// Records will be loaded from server via paginated API
let records = [];
let currentPage = 1;
const PAGE_SIZE = 10;
let totalRecords = 0;
let numPages = 1;

let editingRecordId = null;
// If opened from another page with ?open_id=123, store here and open after records load
let pendingOpenId = null;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function () {
// Проверяем сессию на сервере — кто залогинен
    fetch('/manage/api/whoami/', {credentials: 'same-origin'})
        .then(r => {
            if (!r.ok) return null;
            return r.json();
        })
        .then(data => {
            if (data && !data.error) {
                currentUser = {id: data.id, email: data.email, name: data.name};
                showDashboard();
// enable calculator button
                const btn = document.getElementById('openCalcBtn');
                if (btn) btn.addEventListener('click', () => {
                    window.location.href = '/calculator/';
                });
            }
        })
        .catch(() => {
            /* ignore */
        });

// Обработчики событий авторизации
    document.getElementById('loginTab').addEventListener('click', function () {
        switchToLogin();
    });

    document.getElementById('registerTab').addEventListener('click', function () {
        switchToRegister();
    });

    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('registerBtn').addEventListener('click', handleRegister);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

// Обработчики событий управления письмами
    document.getElementById('addRecordBtn').addEventListener('click', openAddModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
    document.getElementById('saveRecordBtn').addEventListener('click', saveRecord);

    // Обработчик поиска по строкам
    let searchTimeout = null;
    document.getElementById('searchInput').addEventListener('input', function () {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            loadRecords(1);
        }, 500);
    });
    document.getElementById('statusFilter').addEventListener('change', function () {
        loadRecords(1);
    });

    // Логика переключения валют
    document.querySelectorAll('.currency-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // 1. Убираем активный класс у всех
            document.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('active'));
            // 2. Добавляем текущей
            this.classList.add('active');
            // 3. Пишем значение в скрытый инпут
            document.getElementById('currency').value = this.getAttribute('data-value');
        });
    });

    // --- Логика выбора карточек (Контейнер и Транспорт) ---
    function setupOptionCards(gridId, hiddenInputId) {
        const grid = document.getElementById(gridId);
        const hiddenInput = document.getElementById(hiddenInputId);

        if (!grid || !hiddenInput) return;

        const cards = grid.querySelectorAll('.option-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                // 1. Снимаем выделение со всех в этой группе
                cards.forEach(c => c.classList.remove('selected'));
                // 2. Выделяем текущую
                card.classList.add('selected');
                // 3. Пишем значение в скрытый инпут
                hiddenInput.value = card.getAttribute('data-value');
            });
        });
    }

// Инициализируем обе группы
    setupOptionCards('containerOptionsGrid', 'containerType');
    setupOptionCards('transportOptionsGrid', 'transportType');


// If a request to open a specific record was passed in URL, remember it
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.has('open_id')) {
            const parsed = parseInt(params.get('open_id'), 10);
            if (!isNaN(parsed)) pendingOpenId = parsed;
// remove the param from the URL so reloads don't re-open modal
            try {
                history.replaceState(null, '', window.location.pathname);
            } catch (e) { /* ignore */
            }
        }
    } catch (e) { /* ignore */
    }

// Загрузка записей, если пользователь авторизован
    if (currentUser) {
        loadRecords(1);
    }
});

// Функции авторизации
function switchToLogin() {
    document.getElementById('loginTab').classList.add('active');
    document.getElementById('registerTab').classList.remove('active');
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
}

function switchToRegister() {
    document.getElementById('registerTab').classList.add('active');
    document.getElementById('loginTab').classList.remove('active');
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showError('loginError', 'Пожалуйста, заполните все поля');
        return;
    }

// Attempt server-side login
    fetch('/manage/api/login/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        credentials: 'same-origin',
        body: JSON.stringify({email: email, password: password})
    })
        .then(response => {
            if (!response.ok) return response.json().then(j => {
                throw j;
            });
            return response.json();
        })
        .then(data => {
            currentUser = {id: data.id, email: data.email, name: data.name};

// keep a local copy for offline UX (do NOT store passwords)
            if (!users.find(u => u.email === currentUser.email)) {
                users.push({
                    id: data.id,
                    email: currentUser.email,
                    registeredAt: new Date().toISOString(),
                    name: data.name
                });
                localStorage.setItem('mailUsers', JSON.stringify(users));
            }

            showDashboard();
            hideError('loginError');
        })
        .catch(err => {
            const msg = err && err.error ? err.error : 'Неверный email или пароль';
            showError('loginError', msg);
        });
}

function handleRegister() {
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (!email || !password || !confirmPassword) {
        showError('registerError', 'Пожалуйста, заполните все поля');
        return;
    }

    if (password !== confirmPassword) {
        showError('registerError', 'Пароли не совпадают');
        return;
    }

    if (password.length < 6) {
        showError('registerError', 'Пароль должен содержать не менее 6 символов');
        return;
    }

// Send registration to server
    fetch('/manage/api/users/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        credentials: 'same-origin',
        body: JSON.stringify({email: email, password: password, name: email.split('@')[0]})
    })
        .then(response => {
            if (!response.ok) return response.json().then(j => {
                throw j;
            });
            return response.json();
        })
        .then(data => {
            const newUser = {id: data.id, email: data.email, registeredAt: new Date().toISOString(), name: data.name};
            users.push(newUser);
            localStorage.setItem('mailUsers', JSON.stringify(users));

            currentUser = {id: data.id, email: data.email, name: data.name};

            showDashboard();
            hideError('registerError');
        })
        .catch(err => {
            const msg = err && err.error ? err.error : 'Ошибка регистрации';
            showError('registerError', msg);
        });
}

function handleLogout() {
    // POST to logout endpoint to clear session cookie
    fetch('/manage/api/logout/', {
        method: 'POST',
        headers: {'X-CSRFToken': getCookie('csrftoken')},
        credentials: 'same-origin'
    }).finally(() => {
        currentUser = null;
        document.body.classList.remove('logged-in');
        document.body.classList.add('not-logged-in');
        switchToLogin();
    });
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function hideError(elementId) {
    document.getElementById(elementId).style.display = 'none';
}

function showDashboard() {
    document.body.classList.remove('not-logged-in');
    document.body.classList.add('logged-in');

// Отображение информации о пользователе
    document.getElementById('userEmailDisplay').textContent = currentUser.email;
    document.getElementById('userAvatar').textContent = currentUser.email.charAt(0).toUpperCase();

// Загрузка данных
    loadRecords(1);
}

// Функции интерфейса управления письмами (server-driven)
function loadRecords(page = 1) {
    const tableBody = document.getElementById('recordsTableBody');
    tableBody.innerHTML = '';

    const status = document.getElementById('statusFilter').value;
    const searchQuery = document.getElementById('searchInput').value.trim(); // Читаем поиск

    currentPage = page || 1;

    // Формируем параметры URL
    const params = new URLSearchParams({
        page: currentPage,
        page_size: PAGE_SIZE
    });

    // Добавляем фильтры, если они есть
    if (status && status !== 'all') {
        params.append('status', status);
    }
    if (searchQuery) {
        params.append('search', searchQuery); // Отправляем поиск на сервер
    }

    fetch(`/manage/api/records/?${params.toString()}`, {credentials: 'same-origin'})
        .then(r => {
            if (!r.ok) throw new Error('Ошибка загрузки');
            return r.json();
        })
        .then(data => {
            records = data.records || [];
// normalize server-side snake_case fields to client-friendly camelCase
            records = records.map(r => {
                return Object.assign({}, r, {
                    clientName: r.client_name || '',
                    clientEmail: r.email || '',
                    routeFrom: r.routeFrom || r.origin_city || '',
                    routeTo: r.routeTo || r.destination_city || '',
                    currency: r.currency || 'USD',
                    containerType: r.container_type || '20ft',
                    transportType: r.transport_type || 'авто',
                    calculationDate: r.calculationDate || (r.input_date ? (r.input_date.length >= 10 ? r.input_date.substr(0, 10) : r.input_date) : ''),
                    processingStatus: r.processingStatus || r.processing_status || 'pending',
                    comments: r.comments || r.note || '',
                    lastEditedBy: r.lastEditedBy || r.last_edited_by || ''
                });
            });
            totalRecords = data.total || 0;
            numPages = data.num_pages || 1;
            renderRecords(records);
            renderPagination();

// If another page asked us to open a specific record, try now
            if (pendingOpenId) {
// Try fetching the record directly from the server (works even if it's not on the current page)
                fetch(`/manage/api/records/${pendingOpenId}/`, {credentials: 'same-origin'})
                    .then(r => {
                        if (!r.ok) throw r;
                        return r.json();
                    })
                    .then(data => {
                        const rec = data && data.record ? data.record : null;
                        if (rec) {
                            try {
// populate modal fields from returned record
                                editingRecordId = rec.id;
                                document.getElementById('modalTitle').textContent = 'Редактировать письмо';
                                document.getElementById('client').value = rec.client || rec.email || '';
                                document.getElementById('routeFrom').value = rec.routeFrom || rec.origin_city || '';
                                document.getElementById('routeTo').value = rec.routeTo || rec.destination_city || '';
                                document.getElementById('rate').value = (rec.rate !== undefined && rec.rate !== null) ? rec.rate : '';
                                let dateVal = rec.calculationDate || rec.input_date || '';
                                if (dateVal && dateVal.indexOf && dateVal.indexOf('T') !== -1) {
                                    dateVal = dateVal.split('T')[0];
                                } else if (dateVal && dateVal.length >= 10) {
                                    dateVal = dateVal.substr(0, 10);
                                }
                                document.getElementById('calculationDate').value = dateVal;
                                document.getElementById('processingStatus').value = rec.processingStatus || rec.processing_status || 'pending';
                                document.getElementById('comments').value = rec.comments || '';
                                document.getElementById('recordModal').style.display = 'flex';
                            } catch (e) {
                                console.warn('Error populating modal from record', e);
                            }
                        } else {
// fallback: try opening from current page if available
                            openEditModal(pendingOpenId);
                        }
                    })
                    .catch(() => {
                        // fallback to trying to open modal if the record happened to be on the current page
                        try {
                            openEditModal(pendingOpenId);
                        } catch (e) { /* ignore */
                        }
                    })
                    .finally(() => {
                        pendingOpenId = null;
                    });
            }
        })
        .catch(err => {
            tableBody.innerHTML = `
                          <tr>
                          <td colspan="7">
                                      <div class="empty-state">
<i class="fas fa-exclamation-triangle"></i>
<h3>Не удалось загрузить письма</h3>
<p>Проверьте соединение с сервером</p>
</div>
</td>
</tr>
`;
        });
}

function renderRecords(recordsToRender) {
    const tableBody = document.getElementById('recordsTableBody');
    tableBody.innerHTML = '';

    // Управляем видимостью пагинации
    const paginationContainer = document.querySelector('.pagination');
    if (paginationContainer) {
        // Скрываем, если страниц <= 1
        paginationContainer.style.display = (numPages > 1) ? 'flex' : 'none';
    }

    // Проверка на пустоту
    if (!recordsToRender || recordsToRender.length === 0) {
        // ... вывод "ничего не найдено" ...
        return;
    }

    // Отрисовка строк
    recordsToRender.forEach(record => {
        const statusClass = getStatusClass(record.processingStatus);
        const statusText = getStatusText(record.processingStatus);
        const currencySymbol = (record.currency === 'RUB') ? '₽' : '$';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="important-column">${record.clientName || '-'}</td>
            <td>
                ${record.clientEmail || '-'}
                ${record.lastEditedBy ? `<div class="last-edited">Изменено: ${record.lastEditedBy}</div>` : ''}
            </td>
            <td>${record.routeFrom} → ${record.routeTo}</td>
            
            <td>${record.containerType || '20ft'}</td>
            <td><span class="transport-badge">${record.transportType || 'авто'}</span></td>
            
            <td class="important-column">${record.rate} ${currencySymbol}</td>
            <td>${formatDate(record.calculationDate)}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    <button type="button" class="edit-btn" data-id="${record.id}"><i class="fas fa-edit"></i></button>
                    <button type="button" class="delete-btn" data-id="${record.id}"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Навешивание обработчиков (как было)
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            openEditModal(parseInt(this.getAttribute('data-id')));
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            deleteRecord(parseInt(this.getAttribute('data-id')));
        });
    });
}



function renderPagination() {
    const pageInfo = document.querySelector('.pagination .page-info');
    const pageControls = document.querySelector('.pagination .page-controls');

    // Находим сам контейнер пагинации (обычно это div с классом .pagination)
    const paginationContainer = document.querySelector('.pagination');

    if (!pageInfo || !pageControls || !paginationContainer) return;

    // Если страниц всего 1 (или 0), скрываем всю панель пагинации
    if (numPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    } else {
        // Иначе показываем (важно вернуть display, если ранее скрыли)
        paginationContainer.style.display = 'flex'; // или 'block', в зависимости от вашего CSS
    }

    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, totalRecords);
    pageInfo.textContent = `Показано ${start}-${end} из ${totalRecords} писем`;

    pageControls.innerHTML = '';

    // prev
    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevBtn.disabled = currentPage <= 1;
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) loadRecords(currentPage - 1);
    });
    pageControls.appendChild(prevBtn);

    // page numbers
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(numPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', () => loadRecords(p));
        pageControls.appendChild(btn);
    }

    // next
    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextBtn.disabled = currentPage >= numPages;
    nextBtn.addEventListener('click', () => {
        if (currentPage < numPages) loadRecords(currentPage + 1);
    });
    pageControls.appendChild(nextBtn);
}


function getStatusClass(status) {
    switch (status) {
        case 'correct':
            return 'status-correct';
        case 'incorrect':
            return 'status-incorrect';
        case 'pending':
            return 'status-pending';
        default:
            return 'status-pending';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'correct':
            return 'Корректно';
        case 'incorrect':
            return 'Некорректно';
        case 'pending':
            return 'В обработке';
        default:
            return 'В обработке';
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

function openAddModal() {
    editingRecordId = null;
    document.getElementById('modalTitle').textContent = 'Добавить письмо';
    clearModalForm();
    document.getElementById('recordModal').style.display = 'flex';
}

function openEditModal(id) {
    const record = records.find(r => r.id === id);
    if (!record) return;

    editingRecordId = id;
    document.getElementById('modalTitle').textContent = 'Редактировать письмо';


// Заполняем форму данными записи (берём camelCase поля, уже нормализованные при загрузке)
    document.getElementById('clientName').value = record.client_name || '';
    document.getElementById('clientEmail').value = record.email || '';
    document.getElementById('routeFrom').value = record.routeFrom || '';
    document.getElementById('routeTo').value = record.routeTo || '';
    document.getElementById('rate').value = (record.rate !== undefined && record.rate !== null) ? record.rate : '';
    document.getElementById('containerType').value = record.containerType || '20ft';
    document.getElementById('transportType').value = record.transportType || 'авто';

    // Сброс кнопок
    document.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('active'));

    // Визуально выделяем нужные карточки
    highlightCard('containerOptionsGrid', record.containerType || '20ft');
    highlightCard('transportOptionsGrid', record.transportType || 'авто');

    // Установка валюты
    const cur = record.currency || 'USD'; // Дефолт
    document.getElementById('currency').value = cur;

    // Подсветка нужной кнопки
    const activeBtn = document.querySelector(`.currency-btn[data-value="${cur}"]`);
    if (activeBtn) activeBtn.classList.add('active');

// calculationDate may be ISO datetime; ensure YYYY-MM-DD for <input type=date>
    let dateVal = record.calculationDate || record.input_date || '';
    if (dateVal && dateVal.indexOf('T') !== -1) {
        dateVal = dateVal.split('T')[0];
    } else if (dateVal && dateVal.length >= 10) {
        dateVal = dateVal.substr(0, 10);
    }
    document.getElementById('calculationDate').value = dateVal;

    document.getElementById('processingStatus').value = record.processingStatus || 'pending';
    document.getElementById('comments').value = record.comments || '';

    document.getElementById('recordModal').style.display = 'flex';
}

function clearModalForm() {
    document.getElementById('clientName').value = '';
    document.getElementById('clientEmail').value = '';
    document.getElementById('routeFrom').value = '';
    document.getElementById('routeTo').value = '';

    document.getElementById('containerType').value = '20ft';
    document.getElementById('transportType').value = 'ж/д';
    highlightCard('containerOptionsGrid', '20ft');
    highlightCard('transportOptionsGrid', 'авто');

    document.getElementById('rate').value = '';
    document.getElementById('currency').value = '';
    document.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('active'))
    document.getElementById('calculationDate').value = '';
    document.getElementById('processingStatus').value = 'pending';
    document.getElementById('comments').value = '';
}

function closeModal() {
    document.getElementById('recordModal').style.display = 'none';
}

function saveRecord() {
    const clientName = document.getElementById('clientName').value;
    const clientEmail = document.getElementById('clientEmail').value;
    const routeFrom = document.getElementById('routeFrom').value;
    const routeTo = document.getElementById('routeTo').value;
    const containerType = document.getElementById('containerType').value;
    const transportType = document.getElementById('transportType').value;
    const rate = document.getElementById('rate').value;
    const currency = document.getElementById('currency').value;
    const calculationDate = document.getElementById('calculationDate').value;

    if (!clientName || !clientEmail || !routeFrom || !routeTo || !rate || !calculationDate) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
    }
    if (!currency) {
        alert('Пожалуйста, выберите валюту (₽ или $)')
        return;
    }

    if (editingRecordId) {
        // Update existing record on server
        const payload = {
            origin_city: routeFrom,
            destination_city: routeTo,
            container_type: document.getElementById('containerType').value,
            transport_type: document.getElementById('transportType').value,
            rate: rate,
            currency: currency,
            input_date: calculationDate,
            processing_status: document.getElementById('processingStatus').value,
            comments: document.getElementById('comments').value,
            client_name: clientName,
            email: clientEmail,
        };

        fetch(`/manage/api/records/${editingRecordId}/`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(payload)
        })
            .then(r => {
                if (!r.ok) return r.json().then(j => {
                    throw j;
                });
                return r.json();
            })
            .then(data => {
                // refresh the list from server to reflect saved changes
                closeModal();
                loadRecords(currentPage);
            })
            .catch(err => {
                alert('Не удалось сохранить изменения на сервере');
            });
    } else {
        // Создание НОВОЙ записи в бд

        // Готовим данные для сервера (в snake_case, как в базе)
        const payload = {
            client_name: clientName,
            email: clientEmail,
            origin_city: routeFrom,
            destination_city: routeTo,
            container_type: containerType,  // НОВОЕ
            transport_type: transportType,
            rate: rate,
            currency: currency,
            input_date: calculationDate,
            processing_status: document.getElementById('processingStatus').value,
            comments: document.getElementById('comments').value
        };

        // Отправляем POST запрос на создание
        fetch('/manage/api/records/', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(payload)
        })
            .then(r => {
                if (!r.ok) return r.json().then(j => { throw j; });
                return r.json();
            })
            .then(data => {
                // Успех!
                closeModal();
                // Загружаем данные с сервера заново (чтобы увидеть новую запись с её реальным ID)
                loadRecords(1);
            })
            .catch(err => {
                console.error(err);
                alert('Ошибка при создании записи');
            });
    }
}

function deleteRecord(id) {
    if (!confirm('Вы уверены, что хотите удалить это письмо?')) return;

    fetch(`/manage/api/records/${id}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        },
        credentials: 'same-origin'
    })
        .then(r => {
            if (r.ok) {
                loadRecords(currentPage);
                if (records.length === 1 && currentPage > 1) {
                    loadRecords(currentPage - 1);
                }
            } else {
                alert('Не удалось удалить запись');
            }
        })
        .catch(err => {
            console.error(err);
            alert('Ошибка сети');
        });
}

function highlightCard(gridId, value) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    // Сброс
    grid.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));

    // Поиск и выделение
    const target = grid.querySelector(`.option-card[data-value="${value}"]`);
    if (target) target.classList.add('selected');
}