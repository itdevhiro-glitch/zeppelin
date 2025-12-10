import { auth, db } from './firebase-init.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

function showMessage(elementId, message, isError = true) {
    const msgBox = document.getElementById(elementId);
    msgBox.textContent = message;
    msgBox.className = isError ? 'message-box error' : 'message-box success';
    msgBox.style.display = 'block';
}

function hideMessage(elementId) {
    document.getElementById(elementId).style.display = 'none';
}

const urlParams = new URLSearchParams(window.location.search);
const reason = urlParams.get('reason');
if (reason) {
    let msg = "Silakan login kembali.";
    if (reason === 'pending') msg = "Akun Anda masih menunggu persetujuan Admin.";
    else if (reason === 'rejected') msg = "Akun Anda ditolak. Silakan hubungi Admin.";
    else if (reason === 'no_data' || reason === 'invalid') msg = "Terjadi masalah saat memvalidasi akun Anda.";
    else if (reason === 'db_error') msg = "Gagal terhubung ke database.";
    showMessage('login-msg', msg);
}

const loginContainer = document.getElementById('login-container');
const registerContainer = document.getElementById('register-container');
const showLoginBtn = document.getElementById('show-login');
const showRegisterBtn = document.getElementById('show-register');

showLoginBtn.addEventListener('click', () => {
    registerContainer.style.display = 'none';
    loginContainer.style.display = 'block';
    hideMessage('login-msg');
});

showRegisterBtn.addEventListener('click', () => {
    loginContainer.style.display = 'none';
    registerContainer.style.display = 'block';
    hideMessage('register-msg');
});

const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-button');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    loginButton.disabled = true;
    loginButton.innerText = "Memproses...";
    hideMessage('login-msg');

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            const userRef = ref(db, 'users/' + user.uid);
            
            get(userRef).then((snapshot) => {
                if (snapshot.exists()) {
                    const userData = snapshot.val();
                    if (userData.status === 'approved') {
                        window.location.href = 'dashboard.html';
                    } else {
                        const statusMsg = userData.status === 'pending' ? "Akun menunggu persetujuan." : "Akun ditolak.";
                        showMessage('login-msg', statusMsg);
                        signOut(auth);
                        loginButton.disabled = false;
                        loginButton.innerText = "Masuk";
                    }
                } else {
                    if (user.email === 'root@zeppelin.center') {
                        window.location.href = 'dashboard.html';
                        return;
                    }
                    showMessage('login-msg', "Data user tidak ditemukan.");
                    signOut(auth);
                    loginButton.disabled = false;
                    loginButton.innerText = "Masuk";
                }
            }).catch(() => {
                showMessage('login-msg', "Gagal memverifikasi status.");
                signOut(auth);
                loginButton.disabled = false;
                loginButton.innerText = "Masuk";
            });
        })
        .catch(() => {
            showMessage('login-msg', "Email atau kata sandi salah.");
            loginButton.disabled = false;
            loginButton.innerText = "Masuk";
        });
});

const registerForm = document.getElementById('register-form');
const registerButton = document.getElementById('register-button');

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    hideMessage('register-msg');

    const nameVal = document.getElementById('reg-name').value.trim();
    const deptVal = document.getElementById('reg-dept').value.trim();
    const emailVal = document.getElementById('reg-email').value.trim();
    const passVal = document.getElementById('reg-password').value.trim();

    if (passVal.length < 6) {
        showMessage('register-msg', "Password minimal 6 karakter.");
        return;
    }

    registerButton.disabled = true;
    registerButton.innerText = "Memproses...";

    createUserWithEmailAndPassword(auth, emailVal, passVal)
        .then((userCredential) => {
            const user = userCredential.user;
            set(ref(db, 'users/' + user.uid), {
                uid: user.uid,
                nama: nameVal,
                departemen: deptVal,
                email: emailVal,
                status: 'pending'
            })
            .then(() => {
                showMessage('register-msg', "Registrasi berhasil! Menunggu persetujuan.", false);
                registerForm.reset();
                setTimeout(() => {
                    showLoginBtn.click();
                    hideMessage('register-msg');
                }, 3000);
            });
        })
        .catch((error) => {
            if (error.code === 'auth/email-already-in-use') {
                showMessage('register-msg', "Email sudah terdaftar.");
            } else {
                showMessage('register-msg', "Registrasi gagal.");
            }
            registerButton.disabled = false;
            registerButton.innerText = "Daftar";
        });
});