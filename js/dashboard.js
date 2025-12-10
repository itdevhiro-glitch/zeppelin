import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue, set, push, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const mainContent = document.getElementById('main-content');
const loadingScreen = document.getElementById('loading-screen');
const userGreeting = document.getElementById('user-greeting');
const logoutBtn = document.getElementById('logout-btn');
const manageCard = document.getElementById('manage-content-card');
const hrQuickLink = document.getElementById('hr-quick-link');
const mobileHrLink = document.getElementById('mobile-hr-link');
const menuToggleBtn = document.getElementById('menu-toggle');
const mobileMenu = document.getElementById('mobile-menu');
const logoutBtnMobile = document.getElementById('logout-btn-mobile');
const toast = document.getElementById('toast-notification');

let nationalHolidays = {};
let calendarNotes = {};
let currentSelectedDate = null;
let loggedInUserName = "Tamu";

menuToggleBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
});

function showToast(message) {
    if (toast) {
        toast.querySelector('p').textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}

const handleLogout = () => {
    signOut(auth).then(() => window.location.href = 'login.html');
};

logoutBtn.addEventListener('click', handleLogout);
logoutBtnMobile.addEventListener('click', handleLogout);

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (match) => {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match];
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        const userRef = ref(db, 'users/' + user.uid);
        get(userRef).then((snapshot) => {
            let isHRD = false;
            if (user.email === 'root@zeppelin.center') {
                userGreeting.innerHTML = `Halo, <span>ADMIN (Root)</span>`;
                loggedInUserName = "Admin";
                isHRD = true;
            } else if (snapshot.exists()) {
                const userData = snapshot.val();
                if (userData.status === 'approved') {
                    const nama = userData.nama || user.email;
                    userGreeting.innerHTML = `Halo, <span>${nama}</span>`;
                    loggedInUserName = nama;
                    if (userData.departemen === 'HRD' || userData.departemen === 'Human Resources') {
                        isHRD = true;
                    }
                } else {
                    signOut(auth).then(() => window.location.href = `login.html?reason=${userData.status}`);
                    return;
                }
            } else {
                signOut(auth).then(() => window.location.href = 'login.html?reason=no_data');
                return;
            }

            const accessDeniedHandler = (e) => {
                e.preventDefault();
                mobileMenu.classList.remove('active');
                showToast("Akses Ditolak. Menu ini khusus untuk Departemen HRD.");
            };

            if (!isHRD) {
                if (manageCard) {
                    manageCard.classList.add('hidden-non-hrd');
                    manageCard.addEventListener('click', accessDeniedHandler);
                }
                if (hrQuickLink) {
                    hrQuickLink.classList.add('hidden-non-hrd');
                    hrQuickLink.addEventListener('click', accessDeniedHandler);
                }
                if (mobileHrLink) {
                    mobileHrLink.classList.add('hidden-non-hrd');
                    mobileHrLink.addEventListener('click', accessDeniedHandler);
                }
            } else {
                if (manageCard) manageCard.href = "content-management.html";
                if (hrQuickLink) hrQuickLink.href = "content-management.html";
                if (mobileHrLink) mobileHrLink.href = "content-management.html";
            }

            mainContent.style.display = 'block';
            loadingScreen.style.display = 'none';

            runClock();
            initCalendar();
            initTodoWidget();
            initAnnouncementWidget();
            fetchHolidays();
            fetchCalendarNotes();
            initIntersectionObserver();
        });
    } else {
        window.location.href = 'login.html';
    }
});

function runClock() {
    const clockEl = document.querySelector('.digital-clock');
    const dateEl = document.querySelector('.digital-date');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    function updateTime() {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
        dateEl.textContent = now.toLocaleDateString('id-ID', options);
    }
    updateTime();
    setInterval(updateTime, 1000);
}

function initAnnouncementWidget() {
    const listEl = document.getElementById('announcement-list');
    onValue(ref(db, 'announcements'), (snapshot) => {
        listEl.innerHTML = '';
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        let postsArray = [];

        if (snapshot.exists()) {
            const data = snapshot.val();
            for (let key in data) {
                const post = data[key];
                if (post.expiresAt && post.expiresAt < todayStr) continue;
                postsArray.push({ key, ...post });
            }
        }

        if (postsArray.length > 0) {
            postsArray.sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return b.timestamp - a.timestamp;
            });

            postsArray.slice(0, 5).forEach(post => {
                const li = document.createElement('li');
                li.className = 'announcement-item';
                const date = new Date(post.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                
                let tagsHtml = '';
                if (post.isPinned) tagsHtml += `<span class="tag tag-pin"><i class="fa-solid fa-thumbtack"></i> Disematkan</span>`;
                tagsHtml += `<span class="tag tag-cat tag-cat-${post.category?.toLowerCase() || 'umum'}">${escapeHTML(post.category || 'Umum')}</span>`;
                if (post.expiresAt) tagsHtml += `<span class="tag tag-expiry">Berakhir: ${post.expiresAt}</span>`;

                li.innerHTML = `
                    <div class="announcement-header">
                        <div class="ann-item-main">
                            <h3 class="ann-item-title">${escapeHTML(post.title)}</h3>
                            <div class="ann-item-meta">${date} | ${escapeHTML(post.author)}</div>
                            <div class="ann-item-tags">${tagsHtml}</div>
                        </div>
                        <i class="fa-solid fa-chevron-down expand-icon"></i>
                    </div>
                    <div class="announcement-content">${post.content || '<em>Tidak ada isi.</em>'}</div>
                `;
                listEl.appendChild(li);
            });
        } else {
            listEl.innerHTML = '<li class="announcement-empty">Tidak ada pengumuman.</li>';
        }
    });

    listEl.addEventListener('click', (e) => {
        const header = e.target.closest('.announcement-header');
        if (header) {
            const content = header.nextElementSibling;
            const icon = header.querySelector('.expand-icon');
            if (content) {
                const isVisible = content.style.display === 'block';
                content.style.display = isVisible ? 'none' : 'block';
                icon.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        }
    });
}

function initTodoWidget() {
    const inputEl = document.getElementById('todo-input');
    const addBtn = document.getElementById('add-todo-btn');
    const listEl = document.getElementById('todo-list');
    let todos = JSON.parse(localStorage.getItem('zeppelinTodos') || '[]');

    function saveAndRender() {
        localStorage.setItem('zeppelinTodos', JSON.stringify(todos));
        listEl.innerHTML = '';
        if (todos.length === 0) listEl.innerHTML = '<li class="todo-empty">Tidak ada tugas.</li>';
        todos.forEach((todo, index) => {
            const li = document.createElement('li');
            li.className = todo.completed ? 'completed' : '';
            li.innerHTML = `<input type="checkbox" data-index="${index}" ${todo.completed ? 'checked' : ''}> <span>${escapeHTML(todo.text)}</span> <button class="delete-todo" data-index="${index}"><i class="fa-solid fa-trash-can"></i></button>`;
            listEl.appendChild(li);
        });
    }

    addBtn.addEventListener('click', () => {
        if (inputEl.value.trim()) {
            todos.push({ text: inputEl.value.trim(), completed: false });
            inputEl.value = '';
            saveAndRender();
        }
    });

    listEl.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') {
            todos[e.target.dataset.index].completed = e.target.checked;
            saveAndRender();
        } else if (e.target.closest('.delete-todo')) {
            todos.splice(e.target.closest('.delete-todo').dataset.index, 1);
            saveAndRender();
        }
    });
    saveAndRender();
}

async function fetchHolidays() {
    try {
        const response = await fetch(`https://api-harilibur.vercel.app/api?year=${new Date().getFullYear()}`);
        const data = await response.json();
        data.forEach(h => { if(h.is_national_holiday) nationalHolidays[h.holiday_date.split('T')[0]] = h.holiday_name; });
        renderCalendar();
    } catch (e) { console.error(e); }
}

function fetchCalendarNotes() {
    onValue(ref(db, 'calendar_notes'), (s) => { calendarNotes = s.val() || {}; renderCalendar(); });
}

let currentDate = new Date();
function initCalendar() {
    document.getElementById('prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
    document.getElementById('calendar-days').addEventListener('click', (e) => {
        const cell = e.target.closest('.day-cell');
        if (cell && !cell.classList.contains('empty')) openCalendarModal(cell.dataset.date);
    });
    initCalendarModal();
    renderCalendar();
}

function renderCalendar() {
    const daysEl = document.getElementById('calendar-days');
    document.getElementById('month-year').textContent = currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    daysEl.innerHTML = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => `<div class="day-name">${d}</div>`).join('');
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for(let i=0; i<firstDay; i++) daysEl.innerHTML += `<div class="day-cell empty"></div>`;
    
    for(let i=1; i<=daysInMonth; i++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        let cls = "day-cell";
        if (i === new Date().getDate() && month === new Date().getMonth()) cls += " today";
        if (nationalHolidays[dateStr]) cls += " is-holiday";
        if (calendarNotes[dateStr]) cls += " has-note";
        daysEl.innerHTML += `<div class="${cls}" data-date="${dateStr}">${i}</div>`;
    }
}

function initCalendarModal() {
    const backdrop = document.getElementById('calendar-modal-backdrop');
    const closeBtn = document.getElementById('modal-close-btn');
    const saveBtn = document.getElementById('save-note-btn');
    const closeModal = () => { backdrop.classList.remove('visible'); document.getElementById('calendar-modal-content').classList.remove('visible'); };
    
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
    saveBtn.addEventListener('click', () => {
        const txt = document.getElementById('note-textarea').value.trim();
        if (txt && currentSelectedDate) {
            saveBtn.disabled = true;
            push(ref(db, 'calendar_notes/' + currentSelectedDate), { user: loggedInUserName, timestamp: new Date().toISOString(), note: txt })
                .then(() => document.getElementById('note-textarea').value = '')
                .finally(() => saveBtn.disabled = false);
        }
    });
}

function openCalendarModal(dateStr) {
    currentSelectedDate = dateStr;
    const notesList = document.getElementById('modal-notes-list');
    document.getElementById('modal-date-title').textContent = new Date(dateStr).toLocaleDateString('id-ID', { fullDate: true });
    
    const holidayInfo = document.getElementById('modal-holiday-info');
    if (nationalHolidays[dateStr]) {
        document.getElementById('modal-holiday-name').textContent = nationalHolidays[dateStr];
        holidayInfo.style.display = 'block';
    } else holidayInfo.style.display = 'none';

    notesList.innerHTML = '';
    const notes = calendarNotes[dateStr];
    if (notes) {
        Object.values(notes).forEach(n => {
            const div = document.createElement('div');
            div.className = 'note-item';
            div.innerHTML = `<p>${escapeHTML(n.note)}</p><div class="note-item-meta">${n.user}</div>`;
            notesList.appendChild(div);
        });
    } else notesList.innerHTML = '<div class="notes-empty">Tidak ada catatan.</div>';
    
    document.getElementById('calendar-modal-backdrop').classList.add('visible');
    document.getElementById('calendar-modal-content').classList.add('visible');
}

function initIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));
}