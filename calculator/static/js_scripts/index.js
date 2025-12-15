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

// Функция для показа кнопки "Сделать запись" после расчета
function showRecordButton() {
    const resultActions = document.getElementById('resultActions');
    if (resultActions) {
        resultActions.style.display = 'block';
    }
}

// Функция для скрытия кнопки "Сделать запись"
function hideRecordButton() {
    const resultActions = document.getElementById('resultActions');
    if (resultActions) {
        resultActions.style.display = 'none';
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

    // Функционал уведомлений
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationDropdown = document.getElementById('notificationDropdown');
    
    if (notificationBtn && notificationDropdown) {
        // Открытие/закрытие по клику на кнопку
        notificationBtn.addEventListener('click', function (e) {
            e.stopPropagation(); // Предотвращаем всплытие события
            notificationDropdown.style.display = notificationDropdown.style.display === 'block' ? 'none' : 'block';
        });
        
        // Закрытие при клике в любом месте страницы
        document.addEventListener('click', function (e) {
            // Проверяем, был ли клик вне выпадающего меню и кнопки
            if (notificationDropdown && notificationBtn && 
                !notificationDropdown.contains(e.target) && 
                !notificationBtn.contains(e.target)) {
                notificationDropdown.style.display = 'none';
            }
        });
        
        // Предотвращаем закрытие при клике внутри самого выпадающего списка
        notificationDropdown.addEventListener('click', function (e) {
            e.stopPropagation();
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

            // Скрываем кнопку "Сделать запись" перед новым расчетом
            hideRecordButton();

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
                    
                    // ПОКАЗЫВАЕМ КНОПКУ "СДЕЛАТЬ ЗАПИСЬ" ПОСЛЕ УСПЕШНОГО РАСЧЕТА
                    showRecordButton();
                })
                .catch(err => {
                    console.error('Ошибка при запросе:', err);
                    resultsTableContainer.innerHTML = '<div style="color:var(--red); text-align:center;">Ошибка при запросе результатов</div>';
                    resultContainer.style.display = 'block';
                });
        });
    }

    // Функционал для модального окна "Сделать запись"
    const makeRecordBtn = document.getElementById('makeRecordBtn');
    const recordModal = document.getElementById('recordModal');
    const closeRecordModalBtn = document.getElementById('closeRecordModalBtn');
    const copyRecordBtn = document.getElementById('copyRecordBtn');
    const clearRecordBtn = document.getElementById('clearRecordBtn');
    const recordNotesTextarea = document.getElementById('recordNotesTextarea');
    const recordStatus = document.getElementById('recordStatus');
    const recordInfo = document.getElementById('recordInfo');
    const saveRecordBtn = document.getElementById('saveRecordBtn');

    // Открытие модального окна
    if (makeRecordBtn) {
        makeRecordBtn.addEventListener('click', function() {
            // Заполняем информацию из текущего расчета
            const origin = document.getElementById('origin').value;
            const destination = document.getElementById('destination').value;
            const containerType = document.getElementById('container_type').value;
            const transportType = document.getElementById('transport_type').value;
            
            // Получаем информацию из результатов расчета
            const resultsText = document.getElementById('resultsTableContainer').innerText;
            
            // Собираем информацию для отображения
            const calculationDate = new Date().toLocaleString('ru-RU');
            
            recordInfo.innerHTML = `
                <div><strong>Откуда:</strong> ${origin || '—'}</div>
                <div><strong>Куда:</strong> ${destination || '—'}</div>
                <div><strong>Тип контейнера:</strong> ${containerType || '—'}</div>
                <div><strong>Тип транспорта:</strong> ${transportType || '—'}</div>
                <div><strong>Результат расчета:</strong> ${resultsText}</div>
                <div><strong>Дата расчета:</strong> ${calculationDate}</div>
            `;
            
            // Показываем модальное окно
            recordModal.style.display = 'flex';
            document.body.classList.add('modal-open');
        });
    }

    // Закрытие модального окна
    if (closeRecordModalBtn) {
        closeRecordModalBtn.addEventListener('click', function() {
            recordModal.style.display = 'none';
            document.body.classList.remove('modal-open');
            recordStatus.textContent = '';
        });
    }

    // Закрытие по клику вне модального окна
    if (recordModal) {
        recordModal.addEventListener('click', function(e) {
            if (e.target === recordModal) {
                recordModal.style.display = 'none';
                document.body.classList.remove('modal-open');
                recordStatus.textContent = '';
            }
        });
    }

    // Копирование записи в буфер обмена
    if (copyRecordBtn) {
        copyRecordBtn.addEventListener('click', function() {
            const infoText = recordInfo.innerText;
            const notesText = recordNotesTextarea.value;
            const fullText = `ИНФОРМАЦИЯ О РАСЧЕТЕ\n${infoText}\n\nКОММЕНТАРИЙ:\n${notesText}`;
            
            navigator.clipboard.writeText(fullText).then(() => {
                recordStatus.textContent = 'Запись скопирована в буфер обмена!';
                recordStatus.style.color = 'var(--primary-yellow)';
                
                // Сбрасываем статус через 3 секунды
                setTimeout(() => {
                    recordStatus.textContent = '';
                }, 3000);
            }).catch(err => {
                recordStatus.textContent = 'Ошибка при копировании: ' + err;
                recordStatus.style.color = 'var(--red)';
            });
        });
    }

    // Очистка комментария
    if (clearRecordBtn) {
        clearRecordBtn.addEventListener('click', function() {
            if (confirm('Вы уверены, что хотите очистить комментарий?')) {
                recordNotesTextarea.value = '';
                recordStatus.textContent = 'Комментарий очищен';
                recordStatus.style.color = 'var(--primary-yellow)';
                
                setTimeout(() => {
                    recordStatus.textContent = '';
                }, 2000);
            }
        });
    }

    // Кнопка "Сохранить"
    if (saveRecordBtn) {
        saveRecordBtn.addEventListener('click', function() {
            const notesText = recordNotesTextarea.value;
            
            if (notesText.trim() === '') {
                recordStatus.textContent = 'Добавьте комментарий перед сохранением';
                recordStatus.style.color = 'var(--red)';
                return;
            }
            
            recordStatus.textContent = 'Запись сохранена локально';
            recordStatus.style.color = 'var(--primary-yellow)';
            
            setTimeout(() => {
                recordStatus.textContent = '';
            }, 3000);
        });
    }
});