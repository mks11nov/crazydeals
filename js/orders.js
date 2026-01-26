// ===================================
// Orders Page JavaScript
// ===================================

// State
let currentPage = 1;
let currentStatus = 'all';
const ordersPerPage = 10;
let allOrders = [];
let filteredOrders = [];

// ===================================
// Theme Management
// ===================================
function initTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// ===================================
// User Menu
// ===================================
function initUserMenu() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userMenuDropdown = document.getElementById('userMenuDropdown');
    
    if (!userMenuBtn || !userMenuDropdown) return;

    // Check if user is logged in
    const user = Auth.getUser();
    
    if (user) {
        userMenuDropdown.innerHTML = `
            <div class="user-info">
                <strong>${user.firstName} ${user.lastName}</strong>
                <span>${user.email}</span>
            </div>
            <a href="orders.html" class="dropdown-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="21" r="1"/>
                    <circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                My Orders
            </a>
            <button id="logoutBtn" class="dropdown-item">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Logout
            </button>
        `;

        document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    } else {
        userMenuDropdown.innerHTML = `
            <a href="login.html" class="user-menu-item">Login</a>
            <a href="register.html" class="user-menu-item">Register</a>
        `;
    }

    // Toggle dropdown
    userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userMenuDropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        userMenuDropdown.classList.remove('show');
    });
}

async function handleLogout() {
    try {
        await AuthAPI.logout();
        Toast.success('Logged out successfully');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    } catch (error) {
        console.error('Logout error:', error);
        Toast.error('Logout failed');
    }
}


// ===================================
// Check Authentication
// ===================================
function checkAuth() {
    if (!Auth.isLoggedIn()) {
        localStorage.setItem('returnUrl', window.location.pathname);
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// ===================================
// Load Orders
// ===================================
async function loadOrders() {
    const ordersLoading = document.getElementById('ordersLoading');
    const emptyOrders = document.getElementById('emptyOrders');
    const ordersContent = document.getElementById('ordersContent');
    
    ordersLoading.style.display = 'block';
    emptyOrders.style.display = 'none';
    ordersContent.style.display = 'none';

    try {
        const response = await OrderAPI.getOrders(1, 100); // Get all orders
        
        if (response.success) {
            allOrders = response.data.orders || [];
            
            if (allOrders.length === 0) {
                ordersLoading.style.display = 'none';
                emptyOrders.style.display = 'flex';
            } else {
                filterOrders(currentStatus);
                ordersLoading.style.display = 'none';
                ordersContent.style.display = 'block';
            }
        } else {
            ordersLoading.style.display = 'none';
            emptyOrders.style.display = 'flex';
            Toast.error(response.message || 'Failed to load orders');
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        ordersLoading.style.display = 'none';
        emptyOrders.style.display = 'flex';
        Toast.error('Failed to load orders');
    }
}

// ===================================
// Filter Orders
// ===================================
function filterOrders(status) {
    currentStatus = status;
    
    if (status === 'all') {
        filteredOrders = allOrders;
    } else {
        filteredOrders = allOrders.filter(order => order.status === status);
    }
    
    currentPage = 1;
    displayOrders();
    updateFilterButtons();
}

function updateFilterButtons() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        if (btn.dataset.status === currentStatus) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ===================================
// Display Orders
// ===================================
function displayOrders() {
    const ordersList = document.getElementById('ordersList');
    
    if (filteredOrders.length === 0) {
        ordersList.innerHTML = `
            <div class="empty-state">
                <p>No ${currentStatus !== 'all' ? currentStatus : ''} orders found</p>
            </div>
        `;
        document.getElementById('ordersPagination').style.display = 'none';
        return;
    }

    // Calculate pagination
    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const ordersToShow = filteredOrders.slice(startIndex, endIndex);

    // Render orders
    ordersList.innerHTML = '';
    ordersToShow.forEach(order => {
        const orderCard = createOrderCard(order);
        ordersList.appendChild(orderCard);
    });

    // Update pagination
    if (totalPages > 1) {
        updatePagination(currentPage, totalPages);
        document.getElementById('ordersPagination').style.display = 'flex';
    } else {
        document.getElementById('ordersPagination').style.display = 'none';
    }
}

// ===================================
// Create Order Card
// ===================================
function createOrderCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card';
    
    const statusClass = `status-${order.status.toLowerCase()}`;
    const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    card.innerHTML = `
        <div class="order-card-header">
            <div class="order-info">
                <h3>Order #${order.orderNumber}</h3>
                <span class="order-date">${orderDate}</span>
            </div>
            <span class="order-status ${statusClass}">${order.status}</span>
        </div>
        
        <div class="order-card-body">
            <div class="order-items">
                <p class="order-items-count">${order.itemCount} item${order.itemCount > 1 ? 's' : ''}</p>
            </div>
            
            <div class="order-details-grid">
                <div class="order-detail">
                    <span class="label">Total Amount</span>
                    <span class="value">₹${order.total.toFixed(2)}</span>
                </div>
                <div class="order-detail">
                    <span class="label">Payment</span>
                    <span class="value">${order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}</span>
                </div>
                <div class="order-detail">
                    <span class="label">Delivery</span>
                    <span class="value">${order.estimatedDelivery ? new Date(order.estimatedDelivery).toLocaleDateString() : 'TBD'}</span>
                </div>
            </div>
        </div>
        
        <div class="order-card-footer">
            <button class="btn btn-secondary btn-sm" onclick="viewOrderDetails('${order.orderId}')">
                View Details
            </button>
            ${order.status === 'pending' ? `
                <button class="btn btn-danger btn-sm" onclick="cancelOrder('${order.orderId}')">
                    Cancel Order
                </button>
            ` : ''}
        </div>
    `;
    
    return card;
}

// ===================================
// View Order Details
// ===================================
async function viewOrderDetails(orderId) {
    const modal = document.getElementById('orderDetailModal');
    const content = document.getElementById('orderDetailContent');
    
    content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading order details...</p></div>';
    modal.classList.add('show');

    try {
        const response = await OrderAPI.getOrderDetails(orderId);
        
        if (response.success) {
            const order = response.data;
            content.innerHTML = createOrderDetailHTML(order);
        } else {
            content.innerHTML = `<div class="empty-state"><p>${response.message || 'Failed to load order details'}</p></div>`;
            Toast.error(response.message || 'Failed to load order details');
        }
    } catch (error) {
        console.error('Error loading order details:', error);
        content.innerHTML = '<div class="empty-state"><p>Failed to load order details</p></div>';
        Toast.error('Failed to load order details');
    }
}

function calculateOrderSubtotal(items = []) {
    return items.reduce((total, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return total + price * quantity;
    }, 0);
  }

function createOrderDetailHTML(order) {
    const orderDate = new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const statusClass = `status-${order.status.toLowerCase()}`;
    const orderSubTotal = calculateOrderSubtotal(order.items);

    return `
        <div class="order-detail-section">
            <div class="order-detail-header">
                <div>
                    <h3>Order #${order.orderNumber}</h3>
                    <p class="text-muted">${orderDate}</p>
                </div>
                <span class="order-status ${statusClass}">${order.status}</span>
            </div>
        </div>

        <div class="order-detail-section">
            <h4>Order Items</h4>
            <div class="order-items-list">
                ${order.items.map(item => `
                    <div class="order-item-detail">
                        <img src="${item.image}" alt="${item.name}" class="order-item-image">
                        <div class="order-item-info">
                            <h5>${item.name}</h5>
                            <p class="text-muted">Quantity: ${item.quantity}</p>
                        </div>
                        <div class="order-item-price">
                            <span>₹${item.price.toFixed(2)}</span>
                            <span class="text-muted">× ${item.quantity}</span>
                        </div>
                        <div class="order-item-total">
                            ₹${(item.price * item.quantity).toFixed(2)}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="order-detail-section">
            <h4>Shipping Address</h4>
            <div class="address-box">
                <p><strong>${order.shippingAddress.first_name} ${order.shippingAddress.last_name}</strong></p>
                <p>${order.shippingAddress.apartment}</p>
                <p>${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zip_code}</p>
                <p>${order.shippingAddress.country}</p>
                <p>Phone: ${order.shippingAddress.phone}</p>
            </div>
        </div>

        <div class="order-detail-section">
            <h4>Payment Information</h4>
            <div class="payment-info">
                <div class="payment-row">
                    <span>Payment Method:</span>
                    <strong>${order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}</strong>
                </div>
                <div class="payment-row">
                    <span>Payment Status:</span>
                    <strong>${order.paymentStatus}</strong>
                </div>
            </div>
        </div>

        <div class="order-detail-section">
            <h4>Order Summary</h4>
            <div class="order-summary-detail">
                <div class="summary-row">
                    <span>Subtotal:</span>
                    <span>₹${order.pricing.subtotal === undefined ? '' : order.pricing.subtotal.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>Tax:</span>
                    <span>₹${order.pricing.tax === undefined ? '' : order.pricing.tax.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>Shipping:</span>
                    <span>${order.pricing.shipping === 0 || order.pricing.shipping === undefined ? 'FREE' : '₹' + orderpricing.shipping.toFixed(2)}</span>
                </div>
                <div class="summary-row summary-total">
                    <strong>Total:</strong>
                    <strong>₹${order.pricing.total === undefined ? '' : order.pricing.total.toFixed(2)}</strong>
                </div>
            </div>
        </div>

        ${order.timeline && order.timeline.length > 0 ? `
            <div class="order-detail-section">
                <h4>Order Timeline</h4>
                <div class="order-timeline">
                    ${order.timeline.map(event => `
                        <div class="timeline-item">
                            <div class="timeline-dot"></div>
                            <div class="timeline-content">
                                <strong>${event.status}</strong>
                                <p class="text-muted">${new Date(event.timestamp).toLocaleString()}</p>
                                ${event.notes ? `<p>${event.notes}</p>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;
}

// ===================================
// Cancel Order
// ===================================
async function cancelOrder(orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) {
        return;
    }

    const reason = prompt('Please provide a reason for cancellation (optional):');

    try {
        const response = await OrderAPI.cancelOrder(orderId, reason || 'Customer requested cancellation');
        
        if (response.success) {
            Toast.success('Order cancelled successfully');
            loadOrders(); // Reload orders
        } else {
            Toast.error(response.message || 'Failed to cancel order');
        }
    } catch (error) {
        console.error('Error cancelling order:', error);
        Toast.error('Failed to cancel order');
    }
}

// ===================================
// Pagination
// ===================================
function updatePagination(page, totalPages) {
    document.getElementById('pageInfo').textContent = `Page ${page} of ${totalPages}`;
    document.getElementById('prevPage').disabled = page === 1;
    document.getElementById('nextPage').disabled = page === totalPages;
}

function initPagination() {
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayOrders();
        }
    });

    document.getElementById('nextPage')?.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            displayOrders();
        }
    });
}

// ===================================
// Modal
// ===================================
function initModal() {
    const modal = document.getElementById('orderDetailModal');
    const closeBtn = document.getElementById('closeOrderModal');

    closeBtn?.addEventListener('click', () => {
        modal.classList.remove('show');
    });

    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
}

// ===================================
// Filters
// ===================================
function initFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const status = btn.dataset.status;
            filterOrders(status);
        });
    });
}

// ===================================
// Make functions global
// ===================================
window.viewOrderDetails = viewOrderDetails;
window.cancelOrder = cancelOrder;

// ===================================
// Initialize
// ===================================
async function init() {
    initTheme();
    initUserMenu();
    initFilters();
    initPagination();
    initModal();
    
    // Update cart badge
    if (typeof Cart !== 'undefined' && Cart.updateCartBadge) {
        await Cart.updateCartBadge();
    }
    
    // Check authentication and load orders
    if (checkAuth()) {
        await loadOrders();
    }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
