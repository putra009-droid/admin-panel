// boba-admin-page/admin.js

document.addEventListener('DOMContentLoaded', () => {
    // --- PENGECEKAN LOGIN DI AWAL ---
    if (localStorage.getItem('isAdminLoggedIn') !== 'true') {
        window.location.href = 'login.html'; // Arahkan ke halaman login jika belum login
        return; // Hentikan eksekusi skrip jika belum login
    }

    // --- Tambah tombol logout (atau pastikan sudah ada di admin.html dengan id="logoutButton") ---
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('isAdminLoggedIn');
            localStorage.removeItem('adminAuthToken'); // Jika Anda menggunakan token
            window.location.href = 'login.html';
        });
    } else {
        // Opsi: Buat tombol logout secara dinamis jika tidak ada di HTML
        const headerContainer = document.querySelector('.container h1');
        if (headerContainer && headerContainer.parentElement) {
            const dynLogoutButton = document.createElement('button');
            dynLogoutButton.id = 'dynamicLogoutButton';
            dynLogoutButton.textContent = 'Logout Admin';
            // Anda bisa menambahkan style di sini atau di CSS
            dynLogoutButton.style.cssText = "background-color: #e53e3e; position: absolute; top: 20px; right: 20px; padding: 8px 15px; font-size: 0.9em;";
            dynLogoutButton.addEventListener('click', () => {
                localStorage.removeItem('isAdminLoggedIn');
                localStorage.removeItem('adminAuthToken');
                window.location.href = 'login.html';
            });
            headerContainer.parentElement.style.position = 'relative'; // Diperlukan agar posisi absolute tombol logout dinamis bekerja
            headerContainer.parentElement.insertBefore(dynLogoutButton, headerContainer.nextSibling);
        }
    }

    // --- Elements untuk PESANAN ---
    const ordersTableBody = document.getElementById('ordersTableBody');
    const refreshOrdersButton = document.getElementById('refreshOrdersButton');
    const loadingOrdersMessage = document.getElementById('loadingOrdersMessage');
    const ordersErrorMessage = document.getElementById('ordersErrorMessage');
    const ordersSuccessMessage = document.getElementById('ordersSuccessMessage');

    // --- Elements untuk TOKO ---
    const shopsTableBody = document.getElementById('shopsTableBody');
    const refreshShopsButton = document.getElementById('refreshShopsButton');
    const loadingShopsMessage = document.getElementById('loadingShopsMessage');
    const shopsErrorMessage = document.getElementById('shopsErrorMessage');
    const shopsSuccessMessage = document.getElementById('shopsSuccessMessage');

    const shopForm = document.getElementById('shopForm');
    const shopIdInput = document.getElementById('shopIdInput');
    const shopNameInput = document.getElementById('shopNameInput');
    const shopLatInput = document.getElementById('shopLatInput');
    const shopLngInput = document.getElementById('shopLngInput');
    const menuItemsContainer = document.getElementById('menuItemsContainer');
    const addMenuItemButton = document.getElementById('addMenuItemButton');
    const saveShopButton = document.getElementById('saveShopButton');
    const clearShopFormButton = document.getElementById('clearShopFormButton');

    // --- Elements dan Variabel untuk Peta Admin ---
    const adminMapContainer = document.getElementById('adminMapContainer');
    let adminMap = null;
    let currentMarker = null;
    const defaultAdminMapCenter = [1.4748, 124.8421]; // Pusat Manado
    const defaultAdminMapZoom = 13;

    // --- URLs API ---
    // Menggunakan URL lengkap berdasarkan hasil tes Postman yang berhasil.
    const API_BASE_URL = 'http://159.203.179.29:3002/api'; // <-- PERUBAHAN DI SINI
    // const API_BASE_URL = '/api'; // Baris ini dinonaktifkan
    const API_ORDERS_URL = `${API_BASE_URL}/orders`;
    const API_SHOPS_URL = `${API_BASE_URL}/shops`;

    // --- Konstanta ---
    const POSSIBLE_ORDER_STATUSES = [
        "tertunda", "dikonfirmasi", "sedang_diproses",
        "siap_diambil", "selesai", "dibatalkan"
    ];

    // ========================================================================
    // Fungsi Umum
    // ========================================================================
    function formatRupiah(angka) {
        if (typeof angka !== 'number' || isNaN(angka)) return '-';
        return new Intl.NumberFormat('id-ID', {
            style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
        }).format(angka);
    }

    function formatTanggal(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleString('id-ID', {
            timeZone: 'Asia/Makassar', year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }

    function showMessage(element, message, isError = false, duration = 4000) {
        if (!element) {
            console.warn("Element untuk showMessage tidak ditemukan:", message);
            return;
        }
        element.textContent = message;
        element.className = `message ${isError ? 'error' : 'success'}`;
        element.style.display = 'block';
        setTimeout(() => { if (element) element.style.display = 'none'; }, duration);
    }

    // ========================================================================
    // Inisialisasi Peta Admin
    // ========================================================================
    function initAdminMap(initialLat, initialLng) {
        if (!adminMapContainer) {
            console.error("Container peta admin (#adminMapContainer) tidak ditemukan.");
            return;
        }
        if (typeof L === 'undefined') {
            console.error("Leaflet (L) tidak terdefinisi. Pastikan library Leaflet sudah dimuat sebelum admin.js.");
            showMessage(shopsErrorMessage, "Komponen peta gagal dimuat (Leaflet library missing).", true);
            return;
        }

        const mapCenter = (typeof initialLat === 'number' && typeof initialLng === 'number') ? [initialLat, initialLng] : defaultAdminMapCenter;
        const mapZoom = (typeof initialLat === 'number' && typeof initialLng === 'number') ? 16 : defaultAdminMapZoom;

        if (adminMap && typeof adminMap.remove === 'function') {
            adminMap.remove();
        }
        adminMap = L.map(adminMapContainer).setView(mapCenter, mapZoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(adminMap);

        function placeOrUpdateMarker(latlng) {
            if (shopLatInput && shopLngInput) {
                shopLatInput.value = latlng.lat.toFixed(7);
                shopLngInput.value = latlng.lng.toFixed(7);
            }
            if (currentMarker) {
                currentMarker.setLatLng(latlng);
            } else {
                currentMarker = L.marker(latlng, { draggable: true }).addTo(adminMap);
                currentMarker.on('dragend', function(event) {
                    placeOrUpdateMarker(event.target.getLatLng());
                });
            }
            adminMap.panTo(latlng);
        }

        if (typeof initialLat === 'number' && typeof initialLng === 'number') {
            placeOrUpdateMarker(L.latLng(initialLat, initialLng));
        }

        adminMap.on('click', function(e) {
            placeOrUpdateMarker(e.latlng);
        });
    }

    // ========================================================================
    // Fungsi untuk MANAJEMEN PESANAN
    // ========================================================================
    async function fetchOrders() {
        if (!loadingOrdersMessage || !ordersErrorMessage || !ordersTableBody) return;
        loadingOrdersMessage.style.display = 'block';
        ordersErrorMessage.style.display = 'none';
        ordersTableBody.innerHTML = '';

        try {
            const response = await fetch(API_ORDERS_URL);
            if (!response.ok) {
                throw new Error(`Gagal mengambil data pesanan: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            if (data.orders && data.orders.length > 0) {
                renderOrders(data.orders);
            } else {
                ordersTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Belum ada pesanan.</td></tr>';
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            showMessage(ordersErrorMessage, `Error pesanan: ${error.message}. Pastikan server backend berjalan.`, true);
            ordersTableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Gagal memuat data pesanan.</td></tr>';
        } finally {
            if (loadingOrdersMessage) loadingOrdersMessage.style.display = 'none';
        }
    }

    async function updateOrderStatus(orderId, newStatus, buttonElement) {
        const originalButtonText = buttonElement.textContent;
        buttonElement.disabled = true;
        buttonElement.textContent = 'Updating...';

        try {
            const response = await fetch(`${API_ORDERS_URL}/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            const result = await response.json(); // Coba parse JSON dulu untuk dapat pesan error dari backend
            if (!response.ok) {
                throw new Error(result.message || `Gagal update status: ${response.status} ${response.statusText}`);
            }
            showMessage(ordersSuccessMessage, result.message || `Status Order ID ${orderId} berhasil diupdate menjadi ${newStatus}!`);
            setTimeout(fetchOrders, 1500);
        } catch (error) {
            console.error('Error updating status:', error);
            showMessage(ordersErrorMessage, `Error update status: ${error.message}`, true);
            buttonElement.disabled = false;
            buttonElement.textContent = originalButtonText;
        }
    }

    function renderOrders(orders) {
        if (!ordersTableBody) return;
        ordersTableBody.innerHTML = '';
        const reversedOrders = [...orders].reverse();
        reversedOrders.forEach(order => {
            const row = ordersTableBody.insertRow();
            row.insertCell().textContent = order.orderId || '-';
            row.insertCell().textContent = order.shopName || '-';
            row.insertCell().textContent = formatRupiah(order.totalAmount);
            row.insertCell().textContent = order.status || '-';
            row.insertCell().textContent = formatTanggal(order.timestamp);
            row.insertCell().textContent = formatTanggal(order.receivedAt);
            row.insertCell().textContent = formatTanggal(order.lastUpdatedAt);

            const itemsCell = row.insertCell();
            itemsCell.classList.add('item-details');
            if (order.items && order.items.length > 0) {
                const ul = document.createElement('ul');
                order.items.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = `${item.name} (x${item.quantity}) - ${formatRupiah(item.subtotal)}`;
                    ul.appendChild(li);
                });
                itemsCell.appendChild(ul);
            } else { itemsCell.textContent = '-'; }

            const actionCell = row.insertCell();
            actionCell.style.whiteSpace = "nowrap";
            const statusSelect = document.createElement('select');
            statusSelect.classList.add('status-select');
            POSSIBLE_ORDER_STATUSES.forEach(statusValue => {
                const option = document.createElement('option');
                option.value = statusValue;
                option.textContent = statusValue.charAt(0).toUpperCase() + statusValue.slice(1).replace(/_/g, ' ');
                if (statusValue === order.status) option.selected = true;
                statusSelect.appendChild(option);
            });
            actionCell.appendChild(statusSelect);

            const updateButton = document.createElement('button');
            updateButton.classList.add('update-status-button');
            updateButton.textContent = 'Update';
            updateButton.addEventListener('click', (e) => updateOrderStatus(order.orderId, statusSelect.value, e.target));
            actionCell.appendChild(updateButton);
        });
    }

    // ========================================================================
    // Fungsi untuk MANAJEMEN TOKO
    // ========================================================================
    async function fetchShops() {
        if (!loadingShopsMessage || !shopsErrorMessage || !shopsTableBody) return;
        loadingShopsMessage.style.display = 'block';
        shopsErrorMessage.style.display = 'none';
        shopsTableBody.innerHTML = '';

        try {
            const response = await fetch(API_SHOPS_URL);
            if (!response.ok) throw new Error(`Gagal mengambil data toko: ${response.status} ${response.statusText}`);
            const data = await response.json();
            if (data.shops && Array.isArray(data.shops) && data.shops.length > 0) {
                renderShops(data.shops);
            } else {
                shopsTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Belum ada data toko. Tambahkan toko baru menggunakan form di atas.</td></tr>';
            }
        } catch (error) {
            console.error('Error fetching shops:', error);
            showMessage(shopsErrorMessage, `Error toko: ${error.message}. Pastikan server backend berjalan.`, true);
            shopsTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Gagal memuat data toko.</td></tr>';
        } finally {
            if (loadingShopsMessage) loadingShopsMessage.style.display = 'none';
        }
    }

    function renderShops(shops) {
        if (!shopsTableBody) return;
        shopsTableBody.innerHTML = '';
        shops.forEach(shop => {
            const row = shopsTableBody.insertRow();
            row.insertCell().textContent = shop.id;
            row.insertCell().textContent = shop.name;
            row.insertCell().textContent = shop.position && Array.isArray(shop.position) ? `[${shop.position[0]}, ${shop.position[1]}]` : '-';

            const menuCell = row.insertCell();
            menuCell.classList.add('item-details');
            if (shop.menu && Array.isArray(shop.menu) && shop.menu.length > 0) {
                const ul = document.createElement('ul');
                shop.menu.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = `${item.name || 'N/A'} (ID: ${item.id || 'N/A'}, Harga: ${formatRupiah(item.price)})`;
                    ul.appendChild(li);
                });
                menuCell.appendChild(ul);
            } else { menuCell.textContent = 'Menu kosong'; }

            const actionCell = row.insertCell();
            actionCell.style.whiteSpace = "nowrap";
            const editButton = document.createElement('button');
            editButton.classList.add('edit-shop-button');
            editButton.textContent = 'Edit';
            editButton.onclick = () => populateShopFormForEdit(shop);
            actionCell.appendChild(editButton);

            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-shop-button');
            deleteButton.textContent = 'Hapus';
            deleteButton.onclick = () => handleDeleteShop(shop.id, shop.name);
            actionCell.appendChild(deleteButton);
        });
    }

    function addMenuItemRowDOM(item = { id: '', name: '', price: '' }) {
        if (!menuItemsContainer) return;
        const menuItemDiv = document.createElement('div');
        menuItemDiv.classList.add('menu-item-row');

        const idLabel = document.createElement('label'); idLabel.textContent = "ID:";
        const idInput = document.createElement('input');
        idInput.type = 'text'; idInput.placeholder = 'ID Item Unik'; idInput.value = item.id || ''; idInput.classList.add('menu-item-id');

        const nameLabel = document.createElement('label'); nameLabel.textContent = "Nama:";
        const nameInput = document.createElement('input');
        nameInput.type = 'text'; nameInput.placeholder = 'Nama Item'; nameInput.value = item.name || ''; nameInput.classList.add('menu-item-name');

        const priceLabel = document.createElement('label'); priceLabel.textContent = "Harga:";
        const priceInput = document.createElement('input');
        priceInput.type = 'number'; priceInput.placeholder = 'Harga'; priceInput.value = item.price || ''; priceInput.min = 0; priceInput.classList.add('menu-item-price');

        const removeButton = document.createElement('button');
        removeButton.type = 'button'; removeButton.textContent = 'X'; removeButton.classList.add('remove-menu-item-button');
        removeButton.title = "Hapus item menu ini";
        removeButton.onclick = () => { menuItemDiv.remove(); };

        menuItemDiv.appendChild(idLabel); menuItemDiv.appendChild(idInput);
        menuItemDiv.appendChild(nameLabel); menuItemDiv.appendChild(nameInput);
        menuItemDiv.appendChild(priceLabel); menuItemDiv.appendChild(priceInput);
        menuItemDiv.appendChild(removeButton);
        menuItemsContainer.appendChild(menuItemDiv);
    }

    function populateShopFormForEdit(shop) {
        if (!shopForm || !shopIdInput || !shopNameInput || !shopLatInput || !shopLngInput || !menuItemsContainer) return;
        shopIdInput.value = shop.id;
        shopNameInput.value = shop.name || '';
        let latForMap, lngForMap;

        if (shop.position && Array.isArray(shop.position) && shop.position.length === 2) {
            shopLatInput.value = shop.position[0];
            shopLngInput.value = shop.position[1];
            latForMap = shop.position[0];
            lngForMap = shop.position[1];
        } else {
            shopLatInput.value = '';
            shopLngInput.value = '';
            // Jika tidak ada posisi, gunakan pusat default untuk peta, jangan set latForMap/lngForMap agar initAdminMap pakai default
        }
        
        initAdminMap(latForMap, lngForMap); // Panggil dengan koordinat jika ada, atau tanpa argumen agar pakai default

        menuItemsContainer.innerHTML = '';
        if (shop.menu && Array.isArray(shop.menu) && shop.menu.length > 0) {
            shop.menu.forEach(item => addMenuItemRowDOM(item));
        } else {
            addMenuItemRowDOM(); // Tambah satu baris kosong jika tidak ada menu
        }

        saveShopButton.textContent = 'Update Toko';
        shopNameInput.focus();
        // Sembunyikan pesan sukses/error sebelumnya
        if(shopsSuccessMessage) shopsSuccessMessage.style.display = 'none'; 
        if(shopsErrorMessage) shopsErrorMessage.style.display = 'none';
        window.scrollTo(0, shopForm.offsetTop - 20); // Scroll ke form
    }

    function clearShopForm() {
        if (!shopForm || !shopIdInput || !menuItemsContainer || !shopLatInput || !shopLngInput) return;
        shopForm.reset();
        shopIdInput.value = '';
        shopLatInput.value = ''; 
        shopLngInput.value = ''; 
        menuItemsContainer.innerHTML = '';
        addMenuItemRowDOM(); // Tambah satu baris menu item kosong
        if(saveShopButton) saveShopButton.textContent = 'Simpan Toko Baru';
        
        // Sembunyikan pesan sukses/error sebelumnya
        if(shopsSuccessMessage) shopsSuccessMessage.style.display = 'none';
        if(shopsErrorMessage) shopsErrorMessage.style.display = 'none';
        
        // Reset peta ke kondisi awal
        if (currentMarker && adminMap && typeof adminMap.removeLayer === 'function') {
            adminMap.removeLayer(currentMarker);
            currentMarker = null;
        }
        if(adminMap && typeof adminMap.setView === 'function') {
            adminMap.setView(defaultAdminMapCenter, defaultAdminMapZoom);
        } else {
            // Jika adminMap belum ada, coba inisialisasi (meskipun idealnya sudah ada saat load)
            if (typeof L !== 'undefined' && adminMapContainer) initAdminMap();
        }
    }

    shopForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const originalButtonText = shopIdInput.value ? 'Update Toko' : 'Simpan Toko Baru';
        if (!saveShopButton) return;
        saveShopButton.disabled = true;
        saveShopButton.textContent = 'Menyimpan...';

        const id = shopIdInput.value;
        const name = shopNameInput.value.trim();
        const latString = shopLatInput.value.trim();
        const lngString = shopLngInput.value.trim();

        if (!name || !latString || !lngString) {
            showMessage(shopsErrorMessage, "Nama Toko, Latitude, dan Longitude wajib diisi (pilih lokasi di peta).", true);
            saveShopButton.disabled = false;
            saveShopButton.textContent = originalButtonText;
            return;
        }
        
        const lat = parseFloat(latString);
        const lng = parseFloat(lngString);

        if (isNaN(lat) || isNaN(lng)) {
            showMessage(shopsErrorMessage, "Latitude dan Longitude dari peta tidak valid.", true);
            saveShopButton.disabled = false;
            saveShopButton.textContent = originalButtonText;
            return;
        }

        const menuItems = [];
        const menuItemRows = menuItemsContainer.querySelectorAll('.menu-item-row');
        let menuFormIsValid = true;

        menuItemRows.forEach(row => {
            const itemIdInput = row.querySelector('.menu-item-id');
            const itemNameInput = row.querySelector('.menu-item-name');
            const itemPriceInput = row.querySelector('.menu-item-price');

            const itemId = itemIdInput ? itemIdInput.value.trim() : '';
            const itemName = itemNameInput ? itemNameInput.value.trim() : '';
            const itemPriceString = itemPriceInput ? itemPriceInput.value.trim() : '';
            
            // Hanya proses jika setidaknya satu field di baris menu diisi,
            // dan pastikan semua field yang relevan untuk item tersebut valid.
            if (itemId || itemName || itemPriceString) { 
                if (!itemId || !itemName || !itemPriceString || isNaN(parseFloat(itemPriceString)) || parseFloat(itemPriceString) < 0) {
                    menuFormIsValid = false; // Tandai tidak valid jika salah satu wajib diisi tapi formatnya salah
                } else {
                    menuItems.push({ id: itemId, name: itemName, price: parseFloat(itemPriceString) });
                }
            }
        });

        if (!menuFormIsValid) {
            showMessage(shopsErrorMessage, "Untuk setiap item menu yang ingin ditambahkan, pastikan ID, Nama, dan Harga (angka positif) terisi dengan benar.", true);
            saveShopButton.disabled = false;
            saveShopButton.textContent = originalButtonText;
            return;
        }

        const shopData = { name, position: [lat, lng], menu: menuItems };
        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_SHOPS_URL}/${id}` : API_SHOPS_URL;

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shopData)
            });
            const responseData = await response.json();
            if (!response.ok) {
                throw new Error(responseData.message || `Gagal menyimpan data toko: ${response.status}`);
            }
            showMessage(shopsSuccessMessage, responseData.message || `Toko berhasil ${id ? 'diupdate' : 'disimpan'}!`);
            clearShopForm(); // Bersihkan form setelah sukses
            fetchShops();    // Muat ulang daftar toko
        } catch (error) {
            console.error('Error saving shop:', error);
            showMessage(shopsErrorMessage, `Error: ${error.message}`, true);
        } finally {
            saveShopButton.disabled = false;
            saveShopButton.textContent = originalButtonText;
        }
    });

    async function handleDeleteShop(shopId, shopName) {
        if (!confirm(`Anda yakin ingin menghapus toko "${shopName}" (ID: ${shopId})? Operasi ini tidak bisa dibatalkan.`)) {
            return;
        }
        try {
            const response = await fetch(`${API_SHOPS_URL}/${shopId}`, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) {
                 throw new Error(result.message || `Gagal menghapus toko: ${response.status}`);
            }
            showMessage(shopsSuccessMessage, result.message || `Toko "${shopName}" berhasil dihapus!`);
            fetchShops(); // Muat ulang daftar toko
            // Jika toko yang dihapus sedang diedit di form, bersihkan form
            if (shopIdInput && shopIdInput.value === String(shopId)) {
                clearShopForm();
            }
        } catch (error) {
            console.error('Error deleting shop:', error);
            showMessage(shopsErrorMessage, `Error: ${error.message}`, true);
        }
    }

    // --- Event Listeners ---
    if (refreshOrdersButton) refreshOrdersButton.addEventListener('click', fetchOrders);
    if (refreshShopsButton) refreshShopsButton.addEventListener('click', fetchShops);
    if (clearShopFormButton) clearShopFormButton.addEventListener('click', clearShopForm);
    if (addMenuItemButton) addMenuItemButton.addEventListener('click', () => addMenuItemRowDOM());

    // --- Inisialisasi ---
    if (typeof L !== 'undefined' && adminMapContainer) {
        initAdminMap(); // Inisialisasi peta saat DOM siap
        clearShopForm(); // Panggil setelah peta diinisialisasi untuk set tampilan awal form dan peta
    } else {
        console.error("Leaflet (L) atau #adminMapContainer tidak ditemukan. Peta admin tidak bisa diinisialisasi.");
        if (shopsErrorMessage) showMessage(shopsErrorMessage, "Komponen peta admin gagal dimuat.", true);
    }
    fetchOrders();
    fetchShops();
});