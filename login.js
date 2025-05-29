// boba-admin-page/login.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const loginErrorMessage = document.getElementById('loginErrorMessage');

    // URL API backend Anda, sesuaikan jika berbeda
    //const API_LOGIN_URL = 'http://159.203.179.29:3002/api/admin/login'; // Akan kita buat di server.js
    // Jika Anda sudah menggunakan HTTPS untuk API via Nginx reverse proxy:
    const API_LOGIN_URL = '/api/admin/login'; // Path relatif

    // Cek apakah sudah login, jika ya, redirect ke admin.html
    if (localStorage.getItem('isAdminLoggedIn') === 'true') {
        window.location.href = 'admin.html';
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';
        loginErrorMessage.style.display = 'none';
        loginErrorMessage.textContent = '';

        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch(API_LOGIN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Simpan status login di localStorage
                localStorage.setItem('isAdminLoggedIn', 'true');
                // Simpan token jika backend mengirimkannya (opsional untuk implementasi sederhana ini)
                if (data.token) {
                    localStorage.setItem('adminAuthToken', data.token);
                }
                window.location.href = 'admin.html'; // Redirect ke halaman admin
            } else {
                throw new Error(data.message || 'Login gagal. Periksa username dan password.');
            }
        } catch (error) {
            console.error('Login error:', error);
            loginErrorMessage.textContent = error.message;
            loginErrorMessage.style.display = 'block';
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });
});