import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, set, push, query, orderByChild, equalTo, onValue, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

let currentUserData = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        get(ref(db, 'users/' + user.uid)).then((snapshot) => {
            if (user.email === 'root@zeppelin.center') {
                window.location.href = 'login.html';
                return;
            }
            if (snapshot.exists() && snapshot.val().status === 'approved') {
                currentUserData = snapshot.val();
                currentUserData.uid = user.uid;
                document.getElementById('user-greeting').innerHTML = `Halo, <span>${currentUserData.nama}</span>`;
                document.getElementById('main-content').style.display = 'block';
                document.getElementById('loading-screen').style.display = 'none';
                loadHistory(user.uid);
            } else {
                window.location.href = 'login.html';
            }
        });
    } else {
        window.location.href = 'login.html';
    }
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth).then(() => window.location.href = 'login.html'));

document.getElementById('request-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-button');
    btn.disabled = true;
    
    const data = {
        uid: currentUserData.uid,
        nama: currentUserData.nama,
        departemen: currentUserData.departemen,
        kategori: document.getElementById('req-kategori').value,
        prioritas: document.getElementById('req-prioritas').value,
        detail: document.getElementById('req-detail').value,
        alasan: document.getElementById('req-alasan').value,
        status: 'Pending',
        created_at: new Date().toISOString()
    };
    
    push(ref(db, 'device_requests'), data)
        .then(() => {
            alert('Permintaan terkirim!');
            document.getElementById('request-form').reset();
        })
        .finally(() => btn.disabled = false);
});

function loadHistory(uid) {
    const q = query(ref(db, 'device_requests'), orderByChild('uid'), equalTo(uid));
    const tbody = document.getElementById('history-table-body');
    
    onValue(q, (snapshot) => {
        tbody.innerHTML = '';
        if (snapshot.exists()) {
            const arr = [];
            snapshot.forEach(c => arr.push(c.val()));
            arr.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
            
            arr.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${new Date(r.created_at).toLocaleDateString()}</td><td>${r.kategori}</td><td>${r.detail}</td><td>${r.status}</td><td>${r.admin_notes || '-'}</td>`;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5">Belum ada data.</td></tr>';
        }
    });
}