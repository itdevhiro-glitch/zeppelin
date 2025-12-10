import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, onValue, push, get, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let loggedInUser = null;
let loggedInUserData = null;
let activeChat = { id: null, type: null, name: null };
let chatUnsubscribe = null;
const ADMIN_ROOT_UID_KEY = 'Ogy9lUbGHbSu8wYIYx2gQsTtFDF2';

const chatSidebar = document.getElementById('chat-sidebar');
const welcomeScreen = document.getElementById('welcome-screen');
const chatContent = document.getElementById('chat-content');
const messageInput = document.getElementById('message-input');
const chatMessagesEl = document.getElementById('chat-messages');
const activeChatNameEl = document.getElementById('active-chat-name');
const activeChatAvatarEl = document.getElementById('active-chat-avatar');
const sendButton = document.getElementById('send-button');

document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'login.html');
});

document.getElementById('sidebar-toggle-btn').addEventListener('click', () => {
    chatSidebar.classList.add('open');
});

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (match) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]));
}

messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if(this.value === '') this.style.height = 'auto';
});

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
            const firstName = (loggedInUserData.nama || 'User').split(' ')[0];
            document.getElementById('user-greeting').innerHTML = `Halo, <span>${firstName}</span>`;
            fetchUsersAndSetupLists();
        });
    } else {
        window.location.href = 'login.html';
    }
});

function fetchUsersAndSetupLists() {
    onValue(ref(db, 'users'), (snapshot) => {
        const usersArray = [];
        snapshot.forEach((child) => {
            const u = child.val();
            u.uid = child.key;
            if (u.status === 'approved' && u.uid !== loggedInUser.uid) {
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
        const deptId = loggedInUserData.departemen.toLowerCase().replace(/[^a-z0-9]/g, '');
        list.innerHTML += createChatHTML('group', deptId, `Divisi ${loggedInUserData.departemen}`, 'fa-users');
    }
    list.innerHTML += createChatHTML('group', 'all_employees', 'Semua Karyawan', 'fa-earth-asia');
}

function renderAdminList() {
    if (loggedInUser.uid !== ADMIN_ROOT_UID_KEY) {
        document.getElementById('admin-chat-list').innerHTML = createChatHTML('admin', ADMIN_ROOT_UID_KEY, 'Admin IT Support', 'fa-headset');
    } else {
        document.getElementById('admin-chat-section').style.display = 'none';
    }
}

function renderPrivateList(users) {
    const list = document.getElementById('private-chat-list');
    list.innerHTML = '';
    if (users.length === 0) {
        list.innerHTML = `<div class="chat-item" style="cursor:default; color:#999; font-size:0.9rem; padding:15px;">Belum ada user lain.</div>`;
        return;
    }
    users.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
    users.forEach(u => {
        list.innerHTML += createChatHTML('private', u.uid, u.nama || u.email, 'fa-user');
    });
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.id;
            const type = item.dataset.type;
            const name = item.querySelector('h4').textContent;
            const iconClass = item.querySelector('.chat-avatar i').className;
            switchChat(id, type, name, iconClass);
        });
    });
}

function createChatHTML(type, id, name, icon) {
    let dataId = id;
    if (type === 'admin') dataId = `admin_${id}`;
    if (type === 'group') dataId = `group_${id}`;
    return `
        <div class="chat-item" data-id="${dataId}" data-type="${type}">
            <div class="chat-avatar"><i class="${icon}"></i></div>
            <div class="chat-info"><h4>${escapeHTML(name)}</h4><p>Klik untuk mulai chat</p></div>
        </div>
    `;
}

function switchChat(id, type, name, iconClass) {
    if (activeChat.id === id) return;
    if (chatUnsubscribe) chatUnsubscribe();
    activeChat = { id, type, name };
    
    document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
    const activeItem = document.querySelector(`.chat-item[data-id="${CSS.escape(id)}"]`);
    if(activeItem) activeItem.classList.add('active');
    
    welcomeScreen.style.display = 'none';
    chatContent.style.display = 'flex';
    activeChatNameEl.textContent = name;
    activeChatAvatarEl.innerHTML = `<i class="${iconClass}"></i>`;
    
    let path;
    if (type === 'group') {
        const realId = id.replace('group_', '');
        path = `chats/group_chats/${realId}`;
    } else {
        const targetId = id.replace('admin_', '');
        const combinedId = [loggedInUser.uid, targetId].sort().join('_');
        path = `chats/private_chats/${combinedId}`;
    }

    const q = query(ref(db, path), orderByChild('timestamp'), limitToLast(100));
    chatMessagesEl.innerHTML = '<div style="text-align:center; padding:20px; color:#999;">Memuat pesan...</div>';
    
    chatUnsubscribe = onValue(q, (snapshot) => {
        chatMessagesEl.innerHTML = '';
        const messages = [];
        snapshot.forEach(c => messages.push(c.val()));
        if (messages.length === 0) {
            chatMessagesEl.innerHTML = '<div style="text-align:center; padding:40px; color:#9ca3af; font-size:0.9rem;">Belum ada pesan. Sapa sekarang! 👋</div>';
        } else {
            messages.forEach(msg => renderMessage(msg, type));
        }
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    });
    
    if (window.innerWidth <= 900) chatSidebar.classList.remove('open');
    messageInput.focus();
}

function renderMessage(msg, type) {
    const isSent = msg.senderId === loggedInUser.uid;
    const div = document.createElement('div');
    div.className = `message-item ${isSent ? 'sent' : 'received'}`;
    let senderHtml = '';
    if (!isSent && type === 'group') {
        const senderName = escapeHTML(msg.senderName).split(' ')[0];
        senderHtml = `<span class="message-sender">${senderName}</span>`;
    }
    const time = new Date(msg.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
    div.innerHTML = `<div class="message-content">${senderHtml}${escapeHTML(msg.text).replace(/\n/g, '<br>')}<span class="message-time">${time}</span></div>`;
    chatMessagesEl.appendChild(div);
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !activeChat.id) return;
    
    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.focus();

    let path;
    if (activeChat.type === 'group') {
        const realId = activeChat.id.replace('group_', '');
        path = `chats/group_chats/${realId}`;
    } else {
        const targetId = activeChat.id.replace('admin_', '');
        const combinedId = [loggedInUser.uid, targetId].sort().join('_');
        path = `chats/private_chats/${combinedId}`;
    }
    
    push(ref(db, path), {
        senderId: loggedInUser.uid,
        senderName: loggedInUserData.nama,
        text: text,
        timestamp: Date.now()
    });
}

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
