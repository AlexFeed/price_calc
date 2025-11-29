// helper to read CSRF cookie
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Функция для выбора опций с toggle-логикой
function selectOption(element, type) {
    const container = document.getElementById(type === 'container' ? 'containerOptions' : 'transportOptions');
    const options = container.querySelectorAll('.option-card');
    const hiddenInput = document.getElementById(type === 'container' ? 'container_type' : 'transport_type');
    const indicator = element.querySelector('.option-indicator');

    // Если элемент уже выбран - снимаем выбор
    if (element.classList.contains('selected')) {
        element.classList.remove('selected');
        indicator.style.display = 'none';
        hiddenInput.value = ''; // Очищаем значение - значит ищем без фильтрации
    } else {
        // Снимаем выбор со всех элементов
        options.forEach(option => {
            option.classList.remove('selected');
            option.querySelector('.option-indicator').style.display = 'none';
        });

        // Выбираем текущий элемент
        element.classList.add('selected');
        indicator.style.display = 'block';
        hiddenInput.value = element.getAttribute('data-value');
    }
}

// fetch notifications count and items
function loadNotifications() {
    fetch('/manage/api/notifications/')
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
            const count = data.count || 0;
            document.getElementById('notificationIndicator').textContent = count;
            document.getElementById('notificationCount').textContent = `${count} новых`;
            const list = document.getElementById('notificationList');
            list.innerHTML = '';
            if (data.items && data.items.length > 0) {
                data.items.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'notification-item';
                    itemDiv.innerHTML = `<h4>Письмо #${item.id} обработано некорректно</h4><p>От: ${item.client || '—'}, Маршрут: ${item.routeFrom} → ${item.routeTo}</p>`;
                    itemDiv.addEventListener('click', () => {
                        window.location.href = `/manage/?open_id=${item.id}`;
                    });
                    list.appendChild(itemDiv);
                });
            } else {
                const noDiv = document.createElement('div');
                noDiv.className = 'no-notifications';
                noDiv.textContent = 'Нет новых уведомлений';
                list.appendChild(noDiv);
            }
        })
        .catch(() => { /* ignore */
        });
}

document.addEventListener('DOMContentLoaded', function () {
    // Инициализация выбора опций
    const containerCards = document.querySelectorAll('#containerOptions .option-card');
    const transportCards = document.querySelectorAll('#transportOptions .option-card');

    containerCards.forEach(card => {
        card.addEventListener('click', function () {
            selectOption(this, 'container');
        });
    });

    transportCards.forEach(card => {
        card.addEventListener('click', function () {
            selectOption(this, 'transport');
        });
    });

    // letters button navigates to manage page
    const lettersBtn = document.getElementById('lettersBtn');
    if (lettersBtn) lettersBtn.addEventListener('click', () => {
        window.location.href = '/manage/';
    });

    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function () {
            notificationDropdown.style.display = notificationDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }

    // load notifications once on page load
    loadNotifications();

    // Intercept calculator form and load results into the in-page container
    const calcForm = document.querySelector('form');
    const resultContainer = document.getElementById('resultContainer');
    const resultsSummary = document.getElementById('resultsSummary');
    const resultsTableContainer = document.getElementById('resultsTableContainer');

    if (calcForm) {
        calcForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const formData = new FormData(calcForm);
            // include checkbox boolean as presence
            if (!formData.get('include_all_dates')) {
                // ensure falsey or absent; backend treats absence as false
            }

            fetch('/calculator/api/calc/', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: formData
            })
                .then(r => r.ok ? r.json() : r.json().then(j => {
                    throw j;
                }))
                .then(data => {
                    // render stats
                    const stats = data.stats;
                    if (stats) {
                        resultsSummary.innerHTML = `<strong>Найдено ставок:</strong> ${stats.count || 0}`;
                    } else {
                        resultsSummary.innerHTML = '<span style="color:var(--dark-gray);">По выбранным критериям ставок не найдено.</span>';
                    }

                    // render table
                    const rates = data.rates || [];
                    if (rates.length === 0) {
                        resultsTableContainer.innerHTML = '<div style="color:var(--dark-gray);">Нет записей для отображения.</div>';
                    } else {
                        let html = '<table style="width:100%; border-collapse:collapse;"><thead><tr style="text-align:left; border-bottom:1px solid #eee;"><th>Дата</th><th>Откуда</th><th>Куда</th><th>Контейнер</th><th>Транспорт</th><th>Email</th><th>Тариф</th></tr></thead><tbody>';
                        rates.forEach(r => {
                            html += `<tr style="border-bottom:1px solid #f5f5f5;"><td style="padding:8px 4px;">${r.input_date}</td><td style="padding:8px 4px;">${r.origin_city}</td><td style="padding:8px 4px;">${r.destination_city}</td><td style="padding:8px 4px;">${r.container_type}</td><td style="padding:8px 4px;">${r.transport_type}</td><td style="padding:8px 4px;">${r.email || '—'}</td><td style="padding:8px 4px; font-weight:600;">${r.rate}</td></tr>`;
                        });
                        html += '</tbody></table>';
                        resultsTableContainer.innerHTML = html;
                    }

                    resultContainer.style.display = 'block';
                    // scroll into view
                    resultContainer.scrollIntoView({behavior: 'smooth'});
                })
                .catch(err => {
                    resultsSummary.innerHTML = '<span style="color:var(--red);">Ошибка при запросе результатов</span>';
                    resultsTableContainer.innerHTML = '';
                    resultContainer.style.display = 'block';
                });
        });
    }
});