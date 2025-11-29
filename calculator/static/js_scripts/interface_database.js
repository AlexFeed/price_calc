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
    document.getElementById('searchInput').addEventListener('input', function () {
        renderRecords(records);
    });
    document.getElementById('statusFilter').addEventListener('change', function () {
        loadRecords(1);
    });

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
    currentPage = page || 1;

    const statusParam = status && status !== 'all' ? `&status=${encodeURIComponent(status)}` : '';
    fetch(`/manage/api/records/?page=${currentPage}&page_size=${PAGE_SIZE}${statusParam}`, {credentials: 'same-origin'})
        .then(r => {
            if (!r.ok) throw new Error('Ошибка загрузки');
            return r.json();
        })
        .then(data => {
            records = data.records || [];
// normalize server-side snake_case fields to client-friendly camelCase
            records = records.map(r => {
                return Object.assign({}, r, {
                    client: r.client || r.email || '',
                    routeFrom: r.routeFrom || r.origin_city || '',
                    routeTo: r.routeTo || r.destination_city || '',
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

    if (!recordsToRender || recordsToRender.length === 0) {
        tableBody.innerHTML = `
                          <tr>
                          <td colspan="7">
                                      <div class="empty-state">
<i class="fas fa-envelope"></i>
<h3>Писем пока нет</h3>
<p>Добавьте первое письмо, нажав на кнопку "Добавить письмо"</p>
</div>
</td>
</tr>
`;
        return;
    }

    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    recordsToRender.forEach(record => {
// apply simple on-page search filtering
        const client = (record.client || record.email || '').toLowerCase();
        const routeFrom = (record.origin_city || record.routeFrom || '').toLowerCase();
        const routeTo = (record.destination_city || record.routeTo || '').toLowerCase();
        if (searchTerm) {
            if (!(client.includes(searchTerm) || routeFrom.includes(searchTerm) || routeTo.includes(searchTerm))) {
                return; // skip non-matching on this page
            }
        }

        const statusClass = getStatusClass(record.processing_status || record.processingStatus);
        const statusText = getStatusText(record.processing_status || record.processingStatus);
        const row = document.createElement('tr');
        row.innerHTML = `
                <td>${record.id}</td>
                                  <td>
${record.client || record.email || ''}
${record.last_edited_by || record.lastEditedBy ? `<div class="last-edited">Изменено: ${record.last_edited_by || record.lastEditedBy}</div>` : ''}
</td>
  <td>${record.origin_city || record.routeFrom || ''} → ${record.destination_city || record.routeTo || ''}</td>
                                                                                                            <td>${record.rate} $</td>
                                                                                                                                  <td>${formatDate(record.input_date || record.calculationDate)}</td>
                                                                                                                                                                                                  <td><span class="${statusClass}">${statusText}</span></td>
<td>
<div class="action-buttons">
<button class="edit-btn" data-id="${record.id}">
<i class="fas fa-edit"></i>
</button>
<button class="delete-btn" data-id="${record.id}">
<i class="fas fa-trash"></i>
</button>
</div>
</td>
`;
        tableBody.appendChild(row);
    });

// Добавляем обработчики для кнопок
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = parseInt(this.getAttribute('data-id'));
            openEditModal(id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = parseInt(this.getAttribute('data-id'));
            deleteRecord(id);
        });
    });

    document.querySelectorAll('.process-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = parseInt(this.getAttribute('data-id'));
            processRecord(id);
        });
    });
}

function renderPagination() {
    const pageInfo = document.querySelector('.pagination .page-info');
    const pageControls = document.querySelector('.pagination .page-controls');
    if (!pageInfo || !pageControls) return;

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

// page numbers (show up to 5 pages centered around current)
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
        btn.addEventListener('click', (() => {
            const pageNum = p;
            return function () {
                loadRecords(pageNum);
            };
        })());
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
    document.getElementById('client').value = record.client || '';
    document.getElementById('routeFrom').value = record.routeFrom || '';
    document.getElementById('routeTo').value = record.routeTo || '';
    document.getElementById('rate').value = (record.rate !== undefined && record.rate !== null) ? record.rate : '';

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
    document.getElementById('client').value = '';
    document.getElementById('routeFrom').value = '';
    document.getElementById('routeTo').value = '';
    document.getElementById('rate').value = '';
    document.getElementById('calculationDate').value = '';
    document.getElementById('processingStatus').value = 'pending';
    document.getElementById('comments').value = '';
}

function closeModal() {
    document.getElementById('recordModal').style.display = 'none';
}

function saveRecord() {
    const client = document.getElementById('client').value;
    const routeFrom = document.getElementById('routeFrom').value;
    const routeTo = document.getElementById('routeTo').value;
    const rate = document.getElementById('rate').value;
    const calculationDate = document.getElementById('calculationDate').value;

    if (!client || !routeFrom || !routeTo || !rate || !calculationDate) {
        alert('Пожалуйста, заполните все обязательные поля');
        return;
    }

    const recordData = {
        client,
        routeFrom,
        routeTo,
        rate,
        calculationDate,
        processingStatus: document.getElementById('processingStatus').value,
        comments: document.getElementById('comments').value,
        lastEditedBy: currentUser.email,
        lastEditedAt: new Date().toLocaleString('ru-RU')
    };

    if (editingRecordId) {
// Update existing record on server
        const payload = {
            origin_city: routeFrom,
            destination_city: routeTo,
            rate: rate,
            input_date: calculationDate,
            processing_status: document.getElementById('processingStatus').value,
            comments: document.getElementById('comments').value,
            email: client
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
        // Добавление новой записи локально (создание на сервере не реализовано)
        const newRecord = {
            id: records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1,
            ...recordData
        };
        records.push(newRecord);
        localStorage.setItem('mailRecords', JSON.stringify(records));
        closeModal();
        loadRecords(currentPage);
    }
}

function deleteRecord(id) {
    if (confirm('Вы уверены, что хотите удалить это письмо?')) {
        records = records.filter(r => r.id !== id);
        localStorage.setItem('mailRecords', JSON.stringify(records));
        loadRecords(currentPage);
    }
}

function processRecord(id) {
    alert(`Переход к обработке письма с ID: ${id}`);
// В реальном приложении здесь будет переход на страницу обработки письма
}

function filterRecords() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    let filteredRecords = records.filter(record =>
        record.client.toLowerCase().includes(searchTerm) ||
        record.routeFrom.toLowerCase().includes(searchTerm) ||
        record.routeTo.toLowerCase().includes(searchTerm)
    );

    if (statusFilter !== 'all') {
        filteredRecords = filteredRecords.filter(record => record.processingStatus === statusFilter);
    }

    const tableBody = document.getElementById('recordsTableBody');
    tableBody.innerHTML = '';

    if (filteredRecords.length === 0) {
        tableBody.innerHTML = `
<tr>
<td colspan="7">
<div class="empty-state">
<i class="fas fa-search"></i>
<h3>Письма не найдены</h3>
<p>Попробуйте изменить условия поиска</p>
</div>
</td>
</tr>
`;
        return;
    }

    filteredRecords.forEach(record => {
        const statusClass = getStatusClass(record.processingStatus);
        const statusText = getStatusText(record.processingStatus);
        const row = document.createElement('tr');
        row.innerHTML = `
                <td>${record.id}</td>
                                  <td>
${record.client}
${record.lastEditedBy ? `<div class="last-edited">Изменено: ${record.lastEditedBy}</div>` : ''}
</td>
  <td>${record.routeFrom} → ${record.routeTo}</td>
                                               <td>${record.rate} $</td>
                                                                     <td>${formatDate(record.calculationDate)}</td>
                                                                                                                <td><span class="${statusClass}">${statusText}</span></td>
<td>
<div class="action-buttons">
<button class="edit-btn" data-id="${record.id}">
<i class="fas fa-edit"></i>
</button>
<button class="process-btn" data-id="${record.id}">
<i class="fas fa-cog"></i>
</button>
<button class="delete-btn" data-id="${record.id}">
<i class="fas fa-trash"></i>
</button>
</div>
</td>
`;
        tableBody.appendChild(row);
    });

// Добавляем обработчики для кнопок
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = parseInt(this.getAttribute('data-id'));
            openEditModal(id);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = parseInt(this.getAttribute('data-id'));
            deleteRecord(id);
        });
    });

    document.querySelectorAll('.process-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = parseInt(this.getAttribute('data-id'));
            processRecord(id);
        });
    });
}