// boba-admin-page/login.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    const loginErrorMessage = document.getElementById('loginErrorMessage');

    // URL API backend Anda, akan diarahkan oleh Nginx
    // Frontend akan mengirim request ke https://admin.boba-maps.xyz/admin-login-api/login
    const API_LOGIN_URL = '/admin-login-api/login';

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
            const response = await fetch(API_LOGIN_URL, { // Menggunakan URL yang sudah didefinisikan
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            // Coba untuk mendapatkan teks respons dulu, untuk debugging jika bukan JSON
            const responseText = await response.text();

            if (!response.ok) {
                // Jika respons tidak OK, coba tampilkan pesan error dari server jika ada,
                // atau pesan error umum jika respons bukan JSON atau tidak ada pesan.
                let errorMessage = `Login gagal: ${response.status} ${response.statusText}`;
                try {
                    const errorData = JSON.parse(responseText); // Coba parse sebagai JSON jika mungkin ada pesan error
                    if (errorData && errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (e) {
                    // Jika parse gagal, berarti respons bukan JSON (mungkin halaman HTML error)
                    // Tampilkan sebagian kecil dari responseText untuk petunjuk (hati-hati dengan info sensitif)
                    console.error("Respons bukan JSON:", responseText.substring(0, 100)); // Tampilkan 100 karakter pertama
                }
                throw new Error(errorMessage);
            }
            
            // Jika respons OK, baru parse sebagai JSON
            const data = JSON.parse(responseText);

            if (data.success) { // Asumsi backend mengirim { success: true, ... }
                localStorage.setItem('isAdminLoggedIn', 'true');
                if (data.token) {
                    localStorage.setItem('adminAuthToken', data.token);
                }
                window.location.href = 'admin.html';
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