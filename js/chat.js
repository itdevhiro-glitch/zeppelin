import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue, push, get, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let loggedInUser = null;
let loggedInUserData = null;
let activeChat = { id: null, type: null, name: null };
let usersData = {};
let chatUnsubscribe = null;
const ADMIN_ROOT_UID_KEY = 'Ogy9lUbGHbSu8wYIYx2gQsTtFDF2';

const chatSidebar = document.getElementById('chat-sidebar');
const welcomeScreen = document.getElementById('welcome-screen');
const chatContent = document.getElementById('chat-content');
const messageInput = document.getElementById('message-input');
const chatMessagesEl = document.getElementById('chat-messages');

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth).then(() => window.location.href = 'login.html'));
document.getElementById('mobile-dashboard-btn').addEventListener('click', () => window.location.href = 'dashboard.html');
document.getElementById('sidebar-toggle-btn').addEventListener('click', () => chatSidebar.classList.toggle('open'));

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]));
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        loggedInUser = user;
        get(ref(db, 'users/' + user.uid)).then((snapshot) => {
            const userData = snapshot.val();
            if (user.uid === ADMIN_ROOT_UID_KEY) {
                loggedInUserData = { uid: user.uid, nama: "Admin IT", departemen: "IT", email: user.email };
            } else if (snapshot.exists() && userData.status === 'approved') {
                loggedInUserData = userData;
            } else {
                window.location.href = 'login.html';
                return;
            }
            document.getElementById('user-greeting').innerHTML = `Halo, <span>${loggedInUserData.nama || 'User'}</span>`;
            fetchUsersAndSetupLists();
        });
    } else {
        window.location.href = 'login.html';
    }
});

function fetchUsersAndSetupLists() {
    onValue(ref(db, 'users'), (snapshot) => {
        usersData = {};
        const usersArray = [];
        snapshot.forEach((child) => {
            const u = child.val();
            u.uid = child.key;
            if (u.status === 'approved' && u.uid !== loggedInUser.uid) {
                usersData[u.uid] = u;
                usersArray.push(u);
            }
        });
        renderGroupList();
        renderAdminList();
        renderPrivateList(usersArray);
    });
}

function renderGroupList() {
    const list = document.getElementById('group-chat-list');
    list.innerHTML = '';
    if (loggedInUserData.departemen) {
        const id = loggedInUserData.departemen.toLowerCase().replace(/[^a-z0-9]/g, '');
        list.innerHTML += createChatHTML('group', id, `Divisi ${loggedInUserData.departemen}`, 'fa-users');
    }
    list.innerHTML += createChatHTML('group', 'all_employees', 'Semua Karyawan', 'fa-globe');
}

function renderAdminList() {
    if (loggedInUser.uid !== ADMIN_ROOT_UID_KEY) {
        document.getElementById('admin-chat-list').innerHTML = createChatHTML('admin', ADMIN_ROOT_UID_KEY, 'Admin IT', 'fa-user-secret');
    } else {
        document.getElementById('admin-chat-section').style.display = 'none';
    }
}

function renderPrivateList(users) {
    const list = document.getElementById('private-chat-list');
    list.innerHTML = '';
    users.forEach(u => list.innerHTML += createChatHTML('private', u.uid, u.nama || u.email, 'fa-user'));
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            switchChat(item.dataset.id, item.dataset.type, item.querySelector('h4').textContent);
        });
    });
}

function createChatHTML(type, id, name, icon) {
    let dataId = id;
    if (type === 'admin') dataId = `admin_${id}`;
    if (type === 'group') dataId = `group_${id}`;
    return `<div class="chat-item" data-id="${dataId}" data-type="${type}"><div class="chat-avatar"><i class="fa-solid ${icon}"></i></div><div class="chat-info"><h4>${escapeHTML(name)}</h4><p>Klik untuk chat</p></div></div>`;
}

function switchChat(id, type, name) {
    if (activeChat.id === id) return;
    if (chatUnsubscribe) chatUnsubscribe();
    activeChat = { id, type, name };
    
    document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.chat-item[data-id="${CSS.escape(id)}"]`)?.classList.add('active');
    
    welcomeScreen.style.display = 'none';
    chatContent.style.display = 'flex';
    document.getElementById('active-chat-name').textContent = name;
    
    let path;
    if (type === 'group') path = `chats/group_chats/${id.replace('group_', '')}`;
    else {
        const target = id.replace('admin_', '');
        path = `chats/private_chats/${[loggedInUser.uid, target].sort().join('_')}`;
    }

    const q = query(ref(db, path), orderByChild('timestamp'), limitToLast(50));
    chatMessagesEl.innerHTML = '';
    chatUnsubscribe = onValue(q, (snap) => {
        chatMessagesEl.innerHTML = '';
        snap.forEach(c => renderMessage(c.val(), type));
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    });
    
    if (window.innerWidth <= 900) chatSidebar.classList.remove('open');
}

function renderMessage(msg, type) {
    const isSent = msg.senderId === loggedInUser.uid;
    const div = document.createElement('div');
    div.className = `message-item ${isSent ? 'sent' : 'received'}`;
    const sender = !isSent && type === 'group' ? `<span class="message-sender">${escapeHTML(msg.senderName)}</span>` : '';
    div.innerHTML = `<div class="message-content">${sender}${escapeHTML(msg.text)}<span class="message-time">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>`;
    chatMessagesEl.appendChild(div);
}

document.getElementById('send-button').addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !activeChat.id) return;
    
    let path;
    if (activeChat.type === 'group') path = `chats/group_chats/${activeChat.id.replace('group_', '')}`;
    else path = `chats/private_chats/${[loggedInUser.uid, activeChat.id.replace('admin_', '')].sort().join('_')}`;
    
    push(ref(db, path), {
        senderId: loggedInUser.uid,
        senderName: loggedInUserData.nama,
        text: text,
        timestamp: Date.now()
    });
    messageInput.value = '';
}