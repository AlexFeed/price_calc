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

    // ПРОВЕРЬТЕ: Добавьте эту строку для отладки
    console.log('Форма найдена:', calcForm);

    if (calcForm) {
        calcForm.addEventListener('submit', function (e) {
            e.preventDefault();

            // Находим элементы ДО их использования
            const resultContainer = document.getElementById('resultContainer');
            const resultsTableContainer = document.getElementById('resultsTableContainer');

            // Проверяем, что элементы существуют
            if (!resultContainer || !resultsTableContainer) {
                console.error('Не найдены элементы:', {
                    resultContainer: !!resultContainer,
                    resultsTableContainer: !!resultsTableContainer
                });
                return;
            }

            // Validate required fields: origin, destination, container and transport
            const origin = document.getElementById('origin').value.trim();
            const destination = document.getElementById('destination').value.trim();
            const container = document.getElementById('container_type').value.trim();
            const transport = document.getElementById('transport_type').value.trim();
            const processing_status = 'correct';

            const missing = [];
            if (!origin) missing.push('Откуда');
            if (!destination) missing.push('Куда');
            if (!container) missing.push('Тип контейнера');
            if (!transport) missing.push('Тип транспорта');

            if (missing.length > 0) {
                resultsTableContainer.innerHTML = `<div style="color:var(--darkyellow); text-align:center;">Пожалуйста, заполните: ${missing.join(', ')}</div>`;
                resultContainer.style.display = 'block';
                resultContainer.scrollIntoView({behavior: 'smooth'});
                return;
            }

            const formData = new FormData(calcForm);

            console.log('Отправляем данные:', {
                origin, destination, container, transport, processing_status,
                formData: Object.fromEntries(formData.entries())
            });

            fetch('/calculator/api/calc/', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: formData
            })
                .then(r => {
                    console.log('Статус ответа:', r.status);
                    if (!r.ok) {
                        return r.json().then(err => { throw err; });
                    }
                    return r.json();
                })
                .then(data => {
                    console.log('Получены данные:', data);

                    // show only the rate and responsible manager
                    const latest = (data.latest && data.latest.processing_status === 'correct') 
                    ? data.latest 
                    : (data.rates && data.rates.length ? data.rates.find(rate => rate.processing_status === 'correct') || null : null);
                    if (!latest) {
                        resultsTableContainer.innerHTML = '<div style="color:#333;">Нет записей для отображения.</div>';
                    } else {
                        resultsTableContainer.innerHTML = `
                            <div style="text-align:center;">
                                <div style="font-size:22px; color:#333; margin-bottom:8px;">
                                    Расчетная стоимость: 
                                    <strong style="font-size:28px; color:#111;">
                                        ${latest.rate} ${latest.currency === 'RUB' ? '₽' : '$'}
                                    </strong>
                                </div>
                                <div style="font-size:18px; color:#333; margin-bottom:15px">
                                    Ответственный менеджер: <strong style="font-size:18px;">${latest.manager || '—'}</strong>
                                </div>
                            </div>
                        `;
                    }

                    resultContainer.style.display = 'block';
                    resultContainer.scrollIntoView({behavior: 'smooth'});
                })
                .catch(err => {
                    console.error('Ошибка при запросе:', err);
                    resultsTableContainer.innerHTML = '<div style="color:var(--red); text-align:center;">Ошибка при запросе результатов</div>';
                    resultContainer.style.display = 'block';
                });
        });
    }
});